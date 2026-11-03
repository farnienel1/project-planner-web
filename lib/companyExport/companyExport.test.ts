import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipSync, strToU8 } from 'fflate'
import { OPERATIONAL_COLLECTION_PATHS } from '../canonical/organizationSettings'
import { canExportCompanyData } from './access'
import { companyExportEntries, companyExportFileName, companyExportZip, organizationSlug } from './archive'
import { CSV_BOM, cellText, escapeCsvCell, flattenRow, toCsv } from './csv'
import { fileReferencesInDocument, storagePathFromValue } from './files'
import {
  EXCLUDED_COLLECTIONS,
  EXPORT_FILES,
  fileForSettingsDocument,
  isExcludedFieldName,
  operationalCollectionNames,
  organizationCollectionReads,
  sanitizeDocument,
} from './sources'
import { exportDocument, exportValue, isoInZone } from './values'

const LONDON = 'Europe/London'

/** A Firestore Timestamp look-alike (the SDK class is recognised by shape). */
function timestamp(iso: string) {
  const ms = Date.parse(iso)
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1_000_000, toDate: () => new Date(ms) }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i += 1
    } else cell += ch
  }
  return rows
}

// ─── Values: timestamps in the organisation zone ─────────────────────────────

test('timestamps become organisation-zone ISO text with the offset (GMT and BST)', () => {
  assert.equal(exportValue(timestamp('2026-11-03T14:05:09.000Z'), LONDON), '2026-11-03T14:05:09+00:00')
  assert.equal(exportValue(timestamp('2026-07-01T23:30:00.000Z'), LONDON), '2026-07-02T00:30:00+01:00')
  assert.equal(exportValue(new Date('2026-07-01T23:30:00Z'), 'Pacific/Auckland'), '2026-07-02T11:30:00+12:00')
  assert.equal(isoInZone(new Date('2026-01-15T09:00:00Z'), 'America/New_York'), '2026-01-15T04:00:00-05:00')
  // A Timestamp that went through JSON keeps only its numbers.
  assert.equal(exportValue({ seconds: 1793664000, nanoseconds: 0 }, LONDON), '2026-11-03T00:00:00+00:00')
  assert.equal(exportValue({ _seconds: 1793664000, _nanoseconds: 0 }, LONDON), '2026-11-03T00:00:00+00:00')
})

test('day keys, GeoPoints, references and nested values are kept plain', () => {
  const data = exportDocument(
    {
      date: '2026-11-03',
      pin: { latitude: 51.5, longitude: -0.12, isEqual: () => true },
      ref: { path: 'organizations/o1', id: 'o1', firestore: {} },
      nested: { at: timestamp('2026-11-03T08:00:00Z'), list: [timestamp('2026-11-03T08:00:00Z'), 2] },
      skip: undefined,
    },
    LONDON
  )
  assert.deepEqual(data, {
    date: '2026-11-03',
    nested: { at: '2026-11-03T08:00:00+00:00', list: ['2026-11-03T08:00:00+00:00', 2] },
    pin: { latitude: 51.5, longitude: -0.12 },
    ref: 'organizations/o1',
  })
})

// ─── CSV ─────────────────────────────────────────────────────────────────────

test('CSV starts with a UTF-8 BOM and survives the zip byte for byte', () => {
  const csv = toCsv([{ name: 'Zoë £5' }])
  assert.ok(csv.startsWith(CSV_BOM))
  const zipped = companyExportZip({ 'a.csv': csv }, new Date('2026-11-03T12:00:00Z'))
  const bytes = unzipSync(zipped)['a.csv']
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf])
  assert.deepEqual([...bytes], [...strToU8(csv)])
})

test('nested maps flatten to dotted columns and arrays join with "; "', () => {
  assert.deepEqual(flattenRow({ a: { b: { c: 1 } }, e: {}, tags: ['x', 'y'] }), {
    'a.b.c': 1,
    e: '',
    tags: ['x', 'y'],
  })
  assert.equal(cellText(['x', 'y', 3, true]), 'x; y; 3; true')
  assert.equal(cellText([{ id: 'r1' }, 'z']), '{"id":"r1"}; z')
  assert.equal(cellText(null), '')
  assert.equal(cellText(12.5), '12.5')
})

test('commas, quotes and newlines are escaped (RFC 4180) and formulas are neutralised', () => {
  assert.equal(escapeCsvCell('plain'), 'plain')
  assert.equal(escapeCsvCell('a,b'), '"a,b"')
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""')
  assert.equal(escapeCsvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(escapeCsvCell('line1\r\nline2'), '"line1\r\nline2"')
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)")
  assert.equal(escapeCsvCell('@cmd'), "'@cmd")
  assert.equal(escapeCsvCell('-2+cmd|x'), "'-2+cmd|x")
  assert.equal(escapeCsvCell('+44 7700 900123'), '+44 7700 900123')
  assert.equal(escapeCsvCell('-12.5'), '-12.5')

  const csv = toCsv([{ note: 'a, "b"\nc', amount: 12.5 }], { leading: ['note'] })
  const rows = parseCsv(csv.slice(1))
  assert.deepEqual(rows, [
    ['note', 'amount'],
    ['a, "b"\nc', '12.5'],
  ])
})

test('CSV columns: leading first, the rest sorted; rows missing a column are blank', () => {
  const rows = parseCsv(toCsv([{ z: 1, documentId: 'd1', a: 'x' }, { documentId: 'd2', m: { n: true } }], { leading: ['documentId'] }).slice(1))
  assert.deepEqual(rows, [
    ['documentId', 'a', 'm.n', 'z'],
    ['d1', 'x', '', '1'],
    ['d2', '', 'true', ''],
  ])
})

test('a map keyed by ids that would make too many columns becomes one JSON column', () => {
  const reviews = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`entry${i}`, { decision: 'approved' }]))
  const rows = parseCsv(toCsv([{ documentId: 's1', reviews, status: 'signed' }], { maxColumns: 10 }).slice(1))
  assert.deepEqual(rows[0], ['documentId', 'reviews', 'status'])
  assert.deepEqual(JSON.parse(rows[1][1]), reviews)
})

// ─── Collection list ─────────────────────────────────────────────────────────

test('every plain OPERATIONAL_COLLECTION_PATHS collection is read; templated ones live in settings', () => {
  const read = organizationCollectionReads({ includeNotifications: false }).map((entry) => entry.collection)
  for (const name of operationalCollectionNames()) assert.ok(read.includes(name), `${name} is read`)
  for (const [key, path] of Object.entries(OPERATIONAL_COLLECTION_PATHS)) {
    const plain = /^organizations\/\{orgId\}\/[A-Za-z]+$/.test(path)
    const inSettings = path.startsWith('organizations/{orgId}/settings/')
    const storageOnly = key === 'healthSafetyEvidence'
    assert.ok(plain || inSettings || storageOnly, `${key} (${path}) is covered`)
  }
  assert.ok(read.includes('settings'))
  for (const name of ['managerSiteBookings', 'operativeDayRateHistory', 'warningResolutions', 'operatives', 'managers']) {
    assert.ok(read.includes(name), `${name} is read`)
  }
  assert.ok(!read.includes('notifications'))
  for (const excluded of Object.keys(EXCLUDED_COLLECTIONS)) assert.ok(!read.includes(excluded))
  assert.equal(new Set(read).size, read.length)
})

test('notifications are read only when chosen; variations fall back to per-job queries', () => {
  const reads = organizationCollectionReads({ includeNotifications: true })
  assert.equal(reads.find((entry) => entry.collection === 'notifications')?.optional, true)
  assert.equal(reads.find((entry) => entry.collection === 'variations')?.perJobFallbackField, 'parentId')
})

test('settings documents are routed to their own files', () => {
  assert.equal(fileForSettingsDocument('timesheet_U1_1793750400'), 'timesheets')
  assert.equal(fileForSettingsDocument('deadlines_projects_ABC'), 'deadlines')
  assert.equal(fileForSettingsDocument('deadlineAssignments'), 'deadlines')
  assert.equal(fileForSettingsDocument('variations_JOB1'), 'variationLogs')
  assert.equal(fileForSettingsDocument('variationItem_V1'), 'variationLogs')
  assert.equal(fileForSettingsDocument('healthSafety_smallWorks_ABC'), 'healthSafety')
  assert.equal(fileForSettingsDocument('jobTypes'), 'settings')
})

// ─── Exclusions ──────────────────────────────────────────────────────────────

test('tokens, secrets, Stripe ids and tax ids are removed at any depth; billing keeps plan status', () => {
  for (const key of ['pushTokens', 'pushTokenUpdatedAt', 'accountConfirmToken', 'apiKey', 'stripeCustomerId', 'vatNumber', 'utrNumber', 'clientSecret']) {
    assert.ok(isExcludedFieldName(key), key)
  }
  for (const key of ['passwordSet', 'dayRate', 'email', 'profilePhotoURL']) assert.ok(!isExcludedFieldName(key), key)

  const user = sanitizeDocument({ email: 'a@b.c', pushTokens: ['t'], passwordSet: true, nested: { fcmToken: 'x', ok: 1 }, rows: [{ apiKey: 'k', name: 'n' }] })
  assert.deepEqual(user, { email: 'a@b.c', passwordSet: true, nested: { ok: 1 }, rows: [{ name: 'n' }] })

  const org = sanitizeDocument(
    {
      name: 'Acme',
      billing: { status: 'active', billingInterval: 'month', stripeCustomerId: 'cus_1', mrrPence: 5000, lastPaymentAt: 'x', currentPeriodEnd: 'y' },
      subscription: { status: 'active', planKey: 'month', stripeSubscriptionId: 'sub_1' },
    },
    'organization'
  )
  assert.deepEqual(org, {
    name: 'Acme',
    billing: { status: 'active', billingInterval: 'month', currentPeriodEnd: 'y' },
    subscription: { status: 'active', planKey: 'month' },
  })
})

// ─── Files ───────────────────────────────────────────────────────────────────

test('uploaded files are found by URL, gs:// address or *Path field', () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/pp.appspot.com/o/organizations%2Fo1%2FuserProfiles%2Fu1%2Fprofile.jpg?alt=media&token=abc'
  assert.deepEqual(storagePathFromValue(url), { storagePath: 'organizations/o1/userProfiles/u1/profile.jpg', url })
  assert.deepEqual(storagePathFromValue('gs://pp.appspot.com/organizations/o1/a.pdf'), { storagePath: 'organizations/o1/a.pdf', url: '' })
  assert.deepEqual(storagePathFromValue('organizations/o1/tasks/t1/x.png', 'storagePath'), { storagePath: 'organizations/o1/tasks/t1/x.png', url: '' })
  assert.equal(storagePathFromValue('organizations/o1', 'name'), null)
  assert.equal(storagePathFromValue('https://example.com/a.png'), null)

  const refs = fileReferencesInDocument('organizations/o1/settings', 'healthSafety_projects_J1', {
    ramsDocuments: [{ fileURL: url, fileName: 'RAMS.pdf' }],
  })
  assert.deepEqual(refs, [
    {
      collectionPath: 'organizations/o1/settings',
      documentId: 'healthSafety_projects_J1',
      field: 'ramsDocuments[0].fileURL',
      storagePath: 'organizations/o1/userProfiles/u1/profile.jpg',
      url,
    },
  ])
})

// ─── Admin gate ──────────────────────────────────────────────────────────────

test('only admins and super admins outside operative mode may export', () => {
  assert.equal(canExportCompanyData({ adminAccess: true }, 'o1'), true)
  assert.equal(canExportCompanyData({ permissions: { adminAccess: true } }, 'o1'), true)
  assert.equal(canExportCompanyData({ isSuperAdmin: true }, 'o1'), true)
  assert.equal(canExportCompanyData({ role: 'admin' }, 'o1'), true)
  // 1.11.0: an admin has no operative mode; a stray flag is ignored.
  assert.equal(canExportCompanyData({ adminAccess: true, operativeMode: true }, 'o1'), true)
  assert.equal(canExportCompanyData({ role: 'manager' }, 'o1'), false)
  assert.equal(canExportCompanyData({ role: 'operative', operativeMode: true }, 'o1'), false)
  assert.equal(canExportCompanyData({ adminAccess: true, isActive: false }, 'o1'), false)
  assert.equal(canExportCompanyData({ adminAccess: true }, ''), false)
  assert.equal(canExportCompanyData(null, 'o1'), false)
})

// ─── The whole zip ───────────────────────────────────────────────────────────

test('the zip holds one CSV per area, files.csv, export.json and README.txt', () => {
  const photo = 'https://firebasestorage.googleapis.com/v0/b/b/o/organizations%2Fo1%2Fbranding%2Flogo.png?alt=media&token=t'
  const entries = companyExportEntries({
    organizationId: 'o1',
    organization: {
      name: 'Acme Ltd',
      countryCode: 'GB',
      currencyCode: 'GBP',
      companyLogoURL: photo,
      billing: { status: 'active', stripeCustomerId: 'cus_secret' },
    },
    documents: [
      { collectionPath: 'users', collection: 'users', id: 'U1', data: { firstName: 'Ann', pushTokens: ['tok-SECRET-1'], vatNumber: 'GB1' } },
      { collectionPath: 'organizations/o1/projects', collection: 'projects', id: 'P1', data: { name: 'Job, one' } },
      { collectionPath: 'organizations/o1/smallWorks', collection: 'smallWorks', id: 'S1', data: { name: 'Small' } },
      { collectionPath: 'organizations/o1/bookings', collection: 'bookings', id: 'B1', data: { date: timestamp('2026-11-03T00:00:00Z'), cost: 120 } },
      { collectionPath: 'organizations/o1/settings', collection: 'settings', id: 'timesheet_U1_1793750400', data: { userId: 'U1' } },
      { collectionPath: 'organizations/o1/notifications', collection: 'notifications', id: 'N1', data: { userId: 'U1' } },
    ],
    problems: [{ collectionPath: 'organizations/o1/payProfiles', message: 'permission denied by the security rules' }],
    includeNotifications: false,
    exportedAt: new Date('2026-07-01T13:00:00Z'),
    rulebookVersion: '1.21.1',
  })

  for (const spec of Object.values(EXPORT_FILES)) {
    if (spec.file === 'notifications.csv') assert.equal(entries[spec.file], undefined)
    else assert.ok(entries[spec.file]?.startsWith(CSV_BOM), spec.file)
  }
  const jobs = parseCsv(entries['jobs.csv'].slice(1))
  assert.deepEqual(jobs[0], ['documentId', 'collectionPath', 'organisationCurrency', 'jobCollection', 'name'])
  assert.deepEqual(jobs[1], ['P1', 'organizations/o1/projects', 'GBP', 'projects', 'Job, one'])
  assert.deepEqual(jobs[2], ['S1', 'organizations/o1/smallWorks', 'GBP', 'smallWorks', 'Small'])

  const bookings = parseCsv(entries['bookings.csv'].slice(1))
  assert.deepEqual(bookings[1], ['B1', 'organizations/o1/bookings', 'GBP', '120', '2026-11-03T00:00:00+00:00'])
  assert.equal(parseCsv(entries['timesheets.csv'].slice(1)).length, 2)

  const all = Object.values(entries).join('\n')
  assert.ok(!all.includes('tok-SECRET-1'), 'push token left out')
  assert.ok(!all.includes('GB1'), 'tax id left out')
  assert.ok(!all.includes('cus_secret'), 'Stripe id left out')

  const files = parseCsv(entries['files.csv'].slice(1))
  assert.deepEqual(files[1], ['organizations', 'o1', 'companyLogoURL', 'organizations/o1/branding/logo.png', photo])

  const json = JSON.parse(entries['export.json'])
  assert.equal(json.exportedAt, '2026-07-01T14:00:00+01:00')
  assert.equal(json.collections['users'].U1.firstName, 'Ann')
  assert.equal(json.collections['organizations'].o1.name, 'Acme Ltd')
  assert.equal(json.collections['organizations/o1/notifications'], undefined)

  const readme = entries['README.txt']
  assert.match(readme, /Organisation: Acme Ltd \(o1\)/)
  assert.match(readme, /Rulebook version: 1\.21\.1/)
  assert.match(readme, /Wednesday 1 July 2026, 14:00:00 \(Europe\/London\)/)
  assert.match(readme, /NOT in this zip/)
  assert.match(readme, /payProfiles: permission denied/)

  const unzipped = unzipSync(companyExportZip(entries, new Date('2026-07-01T13:00:00Z')))
  assert.deepEqual(Object.keys(unzipped).sort(), Object.keys(entries).sort())
})

test('the zip file name uses the organisation slug and the organisation-zone day', () => {
  assert.equal(organizationSlug('Zoë & Sons Ltd.'), 'zoe-sons-ltd')
  assert.equal(organizationSlug('***'), 'company')
  assert.equal(companyExportFileName('Acme', new Date('2026-07-01T23:30:00Z'), LONDON), 'company-data-acme-2026-07-02.zip')
})

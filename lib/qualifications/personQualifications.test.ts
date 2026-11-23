import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Operative, Qualification } from '@/types'
import {
  operativeRowsForPerson,
  personQualificationRows,
} from './personQualifications.ts'
import { qualificationExpiryDate, withQualificationExpiry } from '../canonical/operativeQualifications.ts'
import {
  QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE,
  confirmQualificationWrite,
  persistQualificationsThenCertificates,
  CertificatesNotLinkedError,
} from './certificateUpload.ts'
import { operativeQualificationPatch } from './qualificationPatch.ts'
import { qualificationExpiryOperatives } from '../warnings/generateOrgWarnings.ts'

const QUAL = 'A1B2C3D4-0000-4000-8000-000000000001'

function qual(id: string, name: string, extra: Partial<Qualification> = {}): Qualification {
  const at = new Date('2026-01-01T00:00:00Z')
  return { id, name, hasEndDate: false, createdAt: at, updatedAt: at, ...extra }
}

function row(id: string, extra: Partial<Operative> = {}): Operative {
  const at = new Date('2026-01-01T00:00:00Z')
  return {
    id,
    firstName: 'Pat',
    lastName: 'Smith',
    email: '',
    startDate: at,
    hourlyRate: 0,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: at,
    updatedAt: at,
    ...extra,
  }
}

// ── Issue 19: "No expiry" although an expiry date is set ─────────────────────────────────────────────────────────────

test('issue 19: the expiry is the editor map qualificationExpiryDates[id], not the assignment row endDate', () => {
  // As the editor saves it: the assignment row has no endDate; the date lives in the map.
  const expiry = new Date('2027-05-01T00:00:00Z')
  const rows = personQualificationRows({
    person: { id: 'u1', email: 'pat@test.com' },
    operatives: [row('op1', { email: 'pat@test.com', qualifications: [qual(QUAL, 'CSCS')], qualificationExpiryDates: { [QUAL]: expiry } })],
    roster: [{ id: 'u1', email: 'pat@test.com' }],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].expiry?.toISOString(), expiry.toISOString())
})

test('issue 19: the map key in another letter case (iOS upper-case UUID) is found', () => {
  const expiry = new Date('2027-05-01T00:00:00Z')
  assert.equal(qualificationExpiryDate({ [QUAL]: expiry }, QUAL.toLowerCase())?.toISOString(), expiry.toISOString())
  assert.equal(qualificationExpiryDate({ [QUAL.toLowerCase()]: expiry }, QUAL)?.toISOString(), expiry.toISOString())
  assert.equal(qualificationExpiryDate({ [QUAL]: new Date('nope') }, QUAL), undefined)
  assert.equal(qualificationExpiryDate(undefined, QUAL), undefined)
})

test('issue 19: setting a date leaves one spelling of the id, so the old date cannot keep showing', () => {
  const old = new Date('2026-01-01T00:00:00Z')
  const fresh = new Date('2028-01-01T00:00:00Z')
  const next = withQualificationExpiry({ [QUAL]: old, other: old }, QUAL.toLowerCase(), fresh)
  assert.deepEqual(Object.keys(next).sort(), [QUAL.toLowerCase(), 'other'].sort())
  assert.equal(qualificationExpiryDate(next, QUAL)?.toISOString(), fresh.toISOString())
  assert.deepEqual(Object.keys(withQualificationExpiry({ [QUAL]: old }, QUAL, undefined)), [])
})

test('issue 19: the profile page and the qualifications editor read the expiry with the same function', () => {
  const editor = readFileSync(new URL('../../components/qualifications/OperativeQualificationsEditor.tsx', import.meta.url), 'utf8')
  const summary = readFileSync(new URL('../../components/users/UserProfileSummary.tsx', import.meta.url), 'utf8')
  const helper = readFileSync(new URL('./personQualifications.ts', import.meta.url), 'utf8')
  assert.match(editor, /qualificationExpiryDate\(draft\.qualificationExpiryDates, qual\.id\)/)
  // Rulebook 1.73.0: the rule lives in lib/canonical; the web helper only folds the person's rows and calls it.
  assert.match(helper, /personQualifications\(\{ rows: operativeRowsForPerson\(input\)/)
  assert.doesNotMatch(helper, /export function qualificationExpiryDate/)
  assert.match(editor, /from '@\/lib\/canonical\/operativeQualifications'/)
  assert.match(summary, /personQualificationRows\(/)
  assert.doesNotMatch(summary, /qual\.endDate/)
})

// ── Issue 18: qualifications on every level's profile, from every record of the person ───────────────────────────────

test('issue 18: the profile page shows the Qualifications section for every level (no operative-mode gate)', () => {
  const summary = readFileSync(new URL('../../components/users/UserProfileSummary.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(summary, /permissions\.operativeMode \? \(\s*<section className="pu-card">/)
  assert.match(summary, /<h2>Qualifications<\/h2>/)
  assert.match(summary, /View certificate/)
  assert.match(summary, /safeExternalUrl\(qual\.certificateUrl\)/)
})

test('issue 18: a manager or admin row linked to the account (no email match) is the person\'s', () => {
  const rows = operativeRowsForPerson({
    person: { id: 'mgr1', email: 'boss@test.com' },
    operatives: [row('rowX', { email: '', linkedUserId: 'mgr1', qualifications: [qual(QUAL, 'SMSTS')] }), row('other', { email: 'x@test.com' })],
    roster: [{ id: 'mgr1', email: 'boss@test.com' }],
  })
  assert.deepEqual(rows.map((r) => r.id), ['rowX'])
})

test('issue 18: a ghost (no email) reads its converted row under its own id', () => {
  const rows = operativeRowsForPerson({
    person: { id: 'ghost-1', email: '' },
    operatives: [row('GHOST-1', { qualifications: [qual(QUAL, 'CSCS')] }), row('someone', { email: 's@test.com' })],
    roster: [{ id: 'ghost-1', email: '' }],
  })
  assert.deepEqual(rows.map((r) => r.id), ['GHOST-1'])
})

test('issue 18: rows on a second users document of the same person (same email, former id) all count; quals merge once', () => {
  const expiry = new Date('2027-05-01T00:00:00Z')
  const rows = personQualificationRows({
    person: { id: 'u1', email: 'pat@test.com' },
    operatives: [
      row('opA', { email: 'pat@test.com', qualifications: [qual(QUAL, 'CSCS')] }),
      row('opB', {
        email: 'PAT@test.com ',
        qualifications: [qual(QUAL.toLowerCase(), 'CSCS'), qual('q2', 'IPAF')],
        qualificationExpiryDates: { [QUAL.toLowerCase()]: expiry },
        qualificationCertificateURLs: { q2: 'https://files.test/ipaf.pdf' },
      }),
      row('opOld', { email: '', linkedUserId: 'invite-1', qualifications: [qual('q3', 'First aid')] }),
      row('stranger', { email: 'someone@test.com', qualifications: [qual('q9', 'Nope')] }),
    ],
    roster: [{ id: 'u1', email: 'pat@test.com', formerUserIds: ['invite-1'] }],
    preferredRowId: 'opA',
  })
  assert.deepEqual(rows.map((r) => r.name).sort(), ['CSCS', 'First aid', 'IPAF'])
  const cscs = rows.find((r) => r.name === 'CSCS')
  assert.equal(cscs?.expiry?.toISOString(), expiry.toISOString(), 'the expiry comes from the row that has it')
  assert.equal(rows.find((r) => r.name === 'IPAF')?.certificateUrl, 'https://files.test/ipaf.pdf')
})

test('issue 18: a person with no row shows no qualifications, never another person\'s', () => {
  assert.deepEqual(
    personQualificationRows({
      person: { id: 'admin1', email: 'admin@test.com' },
      operatives: [row('op1', { email: 'pat@test.com', qualifications: [qual(QUAL, 'CSCS')] })],
      roster: [{ id: 'admin1', email: 'admin@test.com' }],
    }),
    []
  )
})

// ── Issue 16: renewing a certificate stuck on "Saving…" ──────────────────────────────────────────────────────────────

test('issue 16: a qualification write the server never confirms stops waiting and says so', async () => {
  const never = new Promise<void>(() => {})
  await assert.rejects(confirmQualificationWrite(never, 20), (error: Error) => error.message === QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE)
  assert.equal(await confirmQualificationWrite(Promise.resolve('ok'), 20), 'ok')
})

test('issue 16: the save does not hang — a stuck assignment write rejects and the certificate is kept for retry', async () => {
  let uploaded = 0
  await assert.rejects(
    persistQualificationsThenCertificates({
      pending: { [QUAL]: { name: 'new.pdf', type: 'application/pdf', size: 1000 } },
      existingUrls: { [QUAL]: 'https://files.test/old.pdf' },
      saveAssignment: () => confirmQualificationWrite(new Promise<void>(() => {}), 20),
      uploadOne: async () => {
        uploaded += 1
        return 'https://files.test/new.pdf'
      },
      saveCertificateUrls: async () => {},
    }),
    (error: Error) => error.message === QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE
  )
  assert.equal(uploaded, 0)
})

function writesText(writes: ReturnType<typeof operativeQualificationPatch>['mapWrites']): string[] {
  return writes
    .map((w) => `${w.field === 'qualificationExpiryDates' ? 'exp' : 'url'}:${'delete' in w ? '-' : '+'}${w.key}${'delete' in w ? '' : `=${w.value instanceof Date ? w.value.toISOString().slice(0, 10) : w.value}`}`)
    .sort()
}

test('issue 16: a renewed certificate sets the new key and deletes the old spelling of that same id; other qualifications untouched', () => {
  const lower = QUAL.toLowerCase()
  const loaded = row('op1', {
    qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')],
    qualificationExpiryDates: { [QUAL]: new Date('2026-05-01T00:00:00Z'), q2: new Date('2027-01-01T00:00:00Z') },
    qualificationCertificateURLs: { [QUAL]: 'https://files.test/old.pdf', q2: 'https://files.test/ipaf.pdf' },
  })
  const draft = row('op1', {
    qualifications: [qual(lower, 'CSCS'), qual('q2', 'IPAF')],
    qualificationExpiryDates: { [lower]: new Date('2029-05-01T00:00:00Z'), q2: new Date('2027-01-01T00:00:00Z') },
    qualificationCertificateURLs: { [lower]: 'https://files.test/new.pdf', q2: 'https://files.test/ipaf.pdf' },
  })
  const patch = operativeQualificationPatch({ baseline: loaded, draft, live: loaded })
  assert.deepEqual(writesText(patch.mapWrites), [
    `exp:+${lower}=2029-05-01`,
    `exp:-${QUAL}`,
    `url:+${lower}=https://files.test/new.pdf`,
    `url:-${QUAL}`,
  ].sort())
  assert.equal(patch.qualificationCertificateURLs[lower], 'https://files.test/new.pdf')
  assert.equal(patch.qualificationCertificateURLs[QUAL], undefined)
  assert.equal(patch.qualificationCertificateURLs.q2, 'https://files.test/ipaf.pdf')
})

test('issue 16: clearing an expiry and removing a certificate delete only the keys the person cleared', () => {
  const loaded = row('op1', {
    qualifications: [qual(QUAL, 'CSCS')],
    qualificationExpiryDates: { [QUAL]: new Date('2026-05-01T00:00:00Z') },
    qualificationCertificateURLs: { [QUAL]: 'https://files.test/old.pdf' },
  })
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS')], qualificationExpiryDates: {}, qualificationCertificateURLs: {} })
  assert.deepEqual(writesText(operativeQualificationPatch({ baseline: loaded, draft, live: loaded }).mapWrites), [`exp:-${QUAL}`, `url:-${QUAL}`])
  const unchanged = operativeQualificationPatch({ baseline: loaded, draft: loaded, live: loaded })
  assert.deepEqual(unchanged.mapWrites, [])
  assert.equal(unchanged.qualificationsChanged, false)
})

test('review #415: removing a certificate stored under another spelling of the id deletes that stored key too', () => {
  const upper = QUAL.toUpperCase()
  const stored = row('op1', {
    qualifications: [qual(QUAL, 'CSCS')],
    qualificationCertificateURLs: { [upper]: 'https://files.test/old.pdf' },
  })
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS')], qualificationCertificateURLs: {} })
  const patch = operativeQualificationPatch({ baseline: stored, draft, live: stored })
  assert.ok(writesText(patch.mapWrites).includes(`url:-${upper}`))
  assert.deepEqual(patch.qualificationCertificateURLs, {})
})

test('review #415: an expiry or certificate another device added after the editor loaded survives the save', () => {
  const loaded = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')] })
  const live = row('op1', {
    qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')],
    qualificationExpiryDates: { q2: new Date('2028-02-02T00:00:00Z') },
    qualificationCertificateURLs: { q2: 'https://files.test/from-phone.pdf' },
  })
  // The person only sets CSCS's date.
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')], qualificationExpiryDates: { [QUAL]: new Date('2029-01-01T00:00:00Z') } })
  const patch = operativeQualificationPatch({ baseline: loaded, draft, live })
  assert.deepEqual(writesText(patch.mapWrites), [`exp:+${QUAL}=2029-01-01`])
  assert.equal(patch.qualificationExpiryDates.q2.toISOString(), '2028-02-02T00:00:00.000Z')
  assert.equal(patch.qualificationCertificateURLs.q2, 'https://files.test/from-phone.pdf')
})

test('review #415: an untouched qualification\'s newer live date is never overwritten by the stale draft', () => {
  const loaded = row('op1', { qualifications: [qual('q2', 'IPAF')], qualificationExpiryDates: { q2: new Date('2026-01-01T00:00:00Z') } })
  const live = row('op1', { qualifications: [qual('q2', 'IPAF')], qualificationExpiryDates: { q2: new Date('2030-01-01T00:00:00Z') } })
  const patch = operativeQualificationPatch({ baseline: loaded, draft: loaded, live })
  assert.deepEqual(patch.mapWrites, [])
  assert.equal(patch.qualificationExpiryDates.q2.toISOString(), '2030-01-01T00:00:00.000Z')
})

test('review #415: an other-spelling key added after load survives when the person did not act on that id', () => {
  const loaded = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')] })
  const live = row('op1', {
    qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')],
    qualificationExpiryDates: { [QUAL.toLowerCase()]: new Date('2028-01-01T00:00:00Z') },
    qualificationCertificateURLs: { [QUAL.toLowerCase()]: 'https://files.test/phone.pdf' },
  })
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')], qualificationExpiryDates: { q2: new Date('2029-01-01T00:00:00Z') } })
  const patch = operativeQualificationPatch({ baseline: loaded, draft, live })
  assert.deepEqual(writesText(patch.mapWrites), ['exp:+q2=2029-01-01'])
  assert.equal(patch.qualificationCertificateURLs[QUAL.toLowerCase()], 'https://files.test/phone.pdf')
})

test('review #415: a removed qualification stays removed; one added on another device after load is kept', () => {
  const loaded = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF')] })
  const live = row('op1', { qualifications: [qual(QUAL, 'CSCS'), qual('q2', 'IPAF'), qual('q3', 'First aid')] })
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS')] })
  const patch = operativeQualificationPatch({ baseline: loaded, draft, live })
  assert.deepEqual(patch.qualifications.map((q) => q.name), ['CSCS', 'First aid'])
  assert.equal(patch.qualificationsChanged, true)
})

test('review #415: an empty key is never written', () => {
  const loaded = row('op1', { qualifications: [qual(QUAL, 'CSCS')] })
  const draft = row('op1', { qualifications: [qual(QUAL, 'CSCS')], qualificationExpiryDates: { ' ': new Date('2029-01-01T00:00:00Z') }, qualificationCertificateURLs: { '': 'https://x.test/a.pdf' } })
  assert.deepEqual(operativeQualificationPatch({ baseline: loaded, draft, live: loaded }).mapWrites, [])
})

test('issue 16: the store writes the person\'s changes with updateDoc field paths against the editor baseline, bounded', () => {
  const store = readFileSync(new URL('../stores/operativeStore.ts', import.meta.url), 'utf8')
  const storage = readFileSync(new URL('../firebase/storageUtils.ts', import.meta.url), 'utf8')
  const editor = readFileSync(new URL('../../components/qualifications/OperativeQualificationsEditor.tsx', import.meta.url), 'utf8')
  const fn = store.slice(store.indexOf('patchOperativeQualifications: async'), store.indexOf('saveManager: async'))
  assert.match(fn, /operativeQualificationPatch\(\{ baseline, draft: operative, live: existing \}\)/)
  assert.match(fn, /new FieldPath\(write\.field, write\.key\)/)
  assert.match(fn, /'delete' in write \? deleteField\(\)/)
  assert.match(fn, /await confirmQualificationWrite\(updateDoc\(ref, firstField, firstValue, \.\.\.rest\)\)/)
  assert.match(fn, /'not-found'[\s\S]*EDIT_OF_MISSING_DOCUMENT_MESSAGE/)
  assert.match(editor, /saveAssignment: \(\) => onSave\(draft, baseline\)/)
  assert.match(storage, /export const UPLOAD_STALL_MS = 60_000/)
  assert.match(storage, /isStoragePermissionError\(first\) \|\| isTimeoutError\(first\)/)
})

test('issue 16: a certificate that uploaded but whose link was not saved is reported with its URL (no second upload)', async () => {
  let uploads = 0
  const attempt = persistQualificationsThenCertificates({
    pending: { [QUAL]: { name: 'new.pdf', type: 'application/pdf', size: 1000 } },
    existingUrls: { q2: 'https://files.test/ipaf.pdf' },
    saveAssignment: async () => {},
    uploadOne: async () => {
      uploads += 1
      return 'https://files.test/new.pdf'
    },
    saveCertificateUrls: () => confirmQualificationWrite(new Promise<void>(() => {}), 20),
  })
  await assert.rejects(attempt, (error: unknown) => {
    assert.ok(error instanceof CertificatesNotLinkedError)
    assert.deepEqual(error.uploadedIds, [QUAL])
    assert.equal(error.certificateUrls[QUAL], 'https://files.test/new.pdf')
    assert.equal(error.certificateUrls.q2, 'https://files.test/ipaf.pdf')
    return true
  })
  // The retry (the editor dropped the uploaded file from the queue): nothing pending, so nothing is uploaded again.
  await persistQualificationsThenCertificates({
    pending: {},
    existingUrls: { [QUAL]: 'https://files.test/new.pdf' },
    saveAssignment: async () => {},
    uploadOne: async () => {
      uploads += 1
      return 'x'
    },
    saveCertificateUrls: async () => {},
  })
  assert.equal(uploads, 1)
  const editor = readFileSync(new URL('../../components/qualifications/OperativeQualificationsEditor.tsx', import.meta.url), 'utf8')
  assert.match(editor, /err instanceof CertificatesNotLinkedError/)
  assert.match(editor, /for \(const uploadedId of err\.uploadedIds\) delete next\[uploadedId\]/)
})

// ── Review of #415: the expiry warnings and the profile agree ───────────────────────────────────────────────────────

test('review #415: the expiry warnings read the expiry without case, as the profile page does', () => {
  const op = row('op1', {
    email: 'pat@test.com',
    qualifications: [qual(QUAL.toLowerCase(), 'CSCS')],
    qualificationExpiryDates: { [QUAL]: new Date('2026-12-01T00:00:00Z') },
  })
  const [input] = qualificationExpiryOperatives([op])
  assert.deepEqual(input.expiries, [{ qualificationId: QUAL.toLowerCase(), name: 'CSCS', expiryIso: '2026-12-01T00:00:00.000Z' }])
})

test('review #415: an inactive duplicate row\'s date never wins over an active row\'s on the profile', () => {
  const rows = personQualificationRows({
    person: { id: 'u1', email: 'pat@test.com' },
    operatives: [
      row('old', { email: 'pat@test.com', isActive: false, qualifications: [qual(QUAL, 'CSCS')], qualificationExpiryDates: { [QUAL]: new Date('2020-01-01T00:00:00Z') } }),
      row('live', { email: 'pat@test.com', qualifications: [qual(QUAL, 'CSCS')], qualificationExpiryDates: { [QUAL]: new Date('2027-01-01T00:00:00Z') } }),
    ],
    roster: [{ id: 'u1', email: 'pat@test.com' }],
    preferredRowId: 'old',
  })
  assert.equal(rows[0].expiry?.toISOString(), '2027-01-01T00:00:00.000Z')
})

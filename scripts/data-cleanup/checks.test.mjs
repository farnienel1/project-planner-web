/**
 * Tests for the clean-up checks (`scripts/data-cleanup/checks.mjs`): each check's pure decision against the packed
 * rulebook, idempotence (the data after a planned change plans nothing), the backup encoding and the dry-run report.
 *
 *   node --test scripts/data-cleanup/checks.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHECKS,
  decodeValue,
  encodeValue,
  formatReport,
  loadRulebook,
  planBookingStatusSpelling,
  planCurrencyLiteralKey,
  planOfficeAddressMap,
  planOrphanInvites,
  planPayrollHistorySeed,
  planPlaceholderDocs,
  plannedPaths,
  shiftDayKey,
} from './checks.mjs'

const rulebook = loadRulebook()

/** The document after a planned update: set fields, removed fields (one-segment paths only, as the checks use). */
function applyUpdate(data, row) {
  const next = { ...data, ...row.set }
  for (const segments of row.remove) {
    assert.equal(segments.length, 1)
    delete next[segments[0]]
  }
  return next
}

const booking = (status, extra = {}) => ({
  operativeId: 'OP-1',
  projectId: 'JOB-1',
  date: '2026-10-05',
  timeSlot: 'FULL DAY',
  status,
  bookedBy: 'Ann',
  ...extra,
})

test('booking-status-spelling: old spellings get the rulebook spelling; canonical, unreadable, tombstoned and placeholder rows are left', () => {
  const input = {
    orgId: 'org1',
    bookings: [
      { id: 'b1', data: booking('confirmed') },
      { id: 'b2', data: booking('canceled') },
      { id: 'b3', data: booking('pending') },
      { id: 'b4', data: booking('Confirmed') },
      { id: 'b5', data: booking('nonsense') },
      { id: 'B6', data: booking('completed') },
      { id: 'INITIAL-PLACEHOLDER', data: booking('confirmed') },
    ],
    tombstoneIds: ['b6'],
  }
  const plan = planBookingStatusSpelling(rulebook, input)
  assert.deepEqual(
    plan.updates.map((row) => [row.path, row.set]),
    [
      ['organizations/org1/bookings/b1', { status: 'Confirmed' }],
      ['organizations/org1/bookings/b2', { status: 'Cancelled' }],
      ['organizations/org1/bookings/b3', { status: 'Tentative' }],
    ]
  )
  assert.equal(plan.deletes.length, 0)
  assert.deepEqual(plan.notes.map((row) => row.path), ['organizations/org1/bookings/B6'])
  assert.ok(plan.updates.every((row) => row.remove.length === 0))

  // Idempotent: the bookings as written plan nothing.
  const after = input.bookings.map((doc) => {
    const row = plan.updates.find((update) => update.path.endsWith(`/${doc.id}`))
    return row ? { id: doc.id, data: applyUpdate(doc.data, row) } : doc
  })
  assert.equal(planBookingStatusSpelling(rulebook, { ...input, bookings: after }).updates.length, 0)
})

test('currency-literal-key: deleted only when another saved field gives the same currency', () => {
  const redundant = { org: { id: 'o', data: { countryCode: 'GB', currencyCode: 'EUR', currency: 'EUR', 'settings.currencyCode': 'EUR' } } }
  const plan = planCurrencyLiteralKey(rulebook, { orgId: 'o', ...redundant })
  assert.equal(plan.updates.length, 1)
  assert.deepEqual(plan.updates[0].set, {})
  assert.deepEqual(plan.updates[0].remove, [['settings.currencyCode']])
  const after = applyUpdate(redundant.org.data, plan.updates[0])
  assert.equal(rulebook.resolveOrganizationCurrency(after), rulebook.resolveOrganizationCurrency(redundant.org.data))
  assert.equal(planCurrencyLiteralKey(rulebook, { orgId: 'o', org: { id: 'o', data: after } }).updates.length, 0)

  // Older iOS wrote a stale literal and a later web save changed the currency: the literal is ignored, so it can go.
  const stale = planCurrencyLiteralKey(rulebook, { orgId: 'o', org: { id: 'o', data: { currencyCode: 'GBP', settings: { currencyCode: 'GBP' }, 'settings.currencyCode': 'USD' } } })
  assert.equal(stale.updates.length, 1)

  // The literal is the only saved currency: kept (deleting it would fall back to the country default).
  const only = planCurrencyLiteralKey(rulebook, { orgId: 'o', org: { id: 'o', data: { countryCode: 'GB', 'settings.currencyCode': 'GBP' } } })
  assert.equal(only.updates.length, 0)
  assert.equal(only.notes.length, 1)

  // No literal field: nothing to do (a nested settings.currencyCode is the real field and is never touched).
  const none = planCurrencyLiteralKey(rulebook, { orgId: 'o', org: { id: 'o', data: { settings: { currencyCode: 'GBP' } } } })
  assert.deepEqual(none, { updates: [], deletes: [], notes: [] })
})

test('office-address-map: removed only when the flat fields already give the same company details', () => {
  const flat = { name: 'Acme', countryCode: 'IE', officeAddressLine1: '1 Old St', officeCity: 'Cork', officeCounty: 'Cork', officePostcode: 'T12' }
  const redundant = { ...flat, officeAddress: { addressLine1: '1 Old St', town: 'Cork', county: 'Cork', postcode: 'T12' } }
  const plan = planOfficeAddressMap(rulebook, { orgId: 'o', org: { id: 'o', data: redundant } })
  assert.equal(plan.updates.length, 1)
  assert.deepEqual(plan.updates[0].remove, [['officeAddress']])
  const after = applyUpdate(redundant, plan.updates[0])
  assert.deepEqual(rulebook.parseCompanyDetails(after), rulebook.parseCompanyDetails(redundant))
  assert.equal(planOfficeAddressMap(rulebook, { orgId: 'o', org: { id: 'o', data: after } }).updates.length, 0)

  // The map still supplies the address: listed, not changed.
  const needed = { name: 'Acme', officeAddress: { addressLine1: '1 Old St', town: 'Cork', addressLine2: 'Unit 4' } }
  const kept = planOfficeAddressMap(rulebook, { orgId: 'o', org: { id: 'o', data: needed } })
  assert.equal(kept.updates.length, 0)
  assert.equal(kept.notes.length, 1)
  assert.match(kept.notes[0].reason, /officeAddressLine1/)

  // Flat fields hold line 1 and town, the map still adds line 2: kept.
  const partly = { ...flat, officeAddress: { addressLine2: 'Unit 4' } }
  assert.equal(planOfficeAddressMap(rulebook, { orgId: 'o', org: { id: 'o', data: partly } }).updates.length, 0)
})

const policyA = { standardDayStart: '07:00', standardDayEnd: '16:00', unpaidBreakMinutes: 30, standardPaidHours: 8.5 }
const policyB = { standardDayStart: '08:00', standardDayEnd: '17:00', unpaidBreakMinutes: 30, standardPaidHours: 8.5 }

test('payroll-history-seed: seeds prior + current from the stored maps and bumps the revision; nothing re-priced', () => {
  const data = { countryCode: 'GB', payrollTimePolicy: policyB, payrollTimePolicyPrior: policyA, payrollTimePolicyEffectiveFrom: '2026-05-01', payrollTimePolicyRevision: 3 }
  const plan = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data } })
  assert.equal(plan.updates.length, 1)
  const row = plan.updates[0]
  assert.deepEqual(row.set.payrollTimePolicyHistory, [
    { effectiveFrom: '1970-01-01', policy: policyA },
    { effectiveFrom: '2026-05-01', policy: policyB },
  ])
  assert.equal(row.set.payrollTimePolicyRevision, 4)
  // The stored maps are written as stored: a pre-1.20 policy gets no `paidHoursDerived`.
  assert.ok(row.set.payrollTimePolicyHistory.every((entry) => !('paidHoursDerived' in entry.policy)))
  const after = applyUpdate(data, row)
  for (const day of ['1970-01-01', '2026-04-30', '2026-05-01', '2027-01-01']) {
    assert.deepEqual(rulebook.effectivePayrollTimePolicy(after, day, 'Europe/London'), rulebook.effectivePayrollTimePolicy(data, day, 'Europe/London'))
  }
  assert.equal(planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: after } }).updates.length, 0)
})

test('payroll-history-seed: current only, an empty stored list, a pending scheduled change; skips no policy and existing history', () => {
  const currentOnly = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: { payrollTimePolicy: policyA } } })
  assert.deepEqual(currentOnly.updates[0].set.payrollTimePolicyHistory, [{ effectiveFrom: '1970-01-01', policy: policyA }])
  assert.equal(currentOnly.updates[0].set.payrollTimePolicyRevision, 1)

  const emptyList = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: { payrollTimePolicy: policyA, payrollTimePolicyEffectiveFrom: '2026-02-02', payrollTimePolicyHistory: [] } } })
  assert.deepEqual(emptyList.updates[0].set.payrollTimePolicyHistory, [{ effectiveFrom: '2026-02-02', policy: policyA }])

  // A pending scheduled change stays pending: it is not history until its day.
  const scheduled = { payrollTimePolicy: policyA, payrollTimePolicyScheduled: { policy: policyB, effectiveFrom: '2099-01-01' } }
  const withScheduled = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: scheduled } })
  assert.deepEqual(withScheduled.updates[0].set.payrollTimePolicyHistory, [{ effectiveFrom: '1970-01-01', policy: policyA }])
  assert.equal(withScheduled.updates[0].set.payrollTimePolicyScheduled, undefined)

  assert.deepEqual(planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: { countryCode: 'GB' } } }), { updates: [], deletes: [], notes: [] })
  const existing = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: { payrollTimePolicy: policyB, payrollTimePolicyHistory: [{ effectiveFrom: '1970-01-01', policy: policyA }] } } })
  assert.deepEqual(existing, { updates: [], deletes: [], notes: [] })
  const garbage = planPayrollHistorySeed(rulebook, { orgId: 'o', org: { id: 'o', data: { payrollTimePolicy: policyB, payrollTimePolicyHistory: 'x' } } })
  assert.equal(garbage.updates.length, 0)
  assert.equal(garbage.notes.length, 1)
})

test('placeholder-docs: deletes the exact INITIAL-PLACEHOLDER in projects, small works and operatives; lists the rest', () => {
  const input = {
    orgId: 'o',
    collections: {
      projects: [{ id: 'INITIAL-PLACEHOLDER', data: {} }, { id: 'real-job', data: {} }],
      smallWorks: [{ id: 'initial-placeholder', data: {} }],
      operatives: [{ id: 'INITIAL-PLACEHOLDER', data: { name: 'Initial operative' } }],
      bookings: [{ id: 'INITIAL-PLACEHOLDER', data: {} }],
      clients: [{ id: 'INITIAL-PLACEHOLDER', data: {} }],
      managers: [{ id: 'INITIAL-PLACEHOLDER', data: {} }],
    },
  }
  const plan = planPlaceholderDocs(rulebook, input)
  assert.deepEqual(plan.deletes.map((row) => row.path), [
    'organizations/o/projects/INITIAL-PLACEHOLDER',
    'organizations/o/operatives/INITIAL-PLACEHOLDER',
  ])
  assert.deepEqual(plan.notes.map((row) => row.path), [
    'organizations/o/smallWorks/initial-placeholder',
    'organizations/o/bookings/INITIAL-PLACEHOLDER',
    'organizations/o/clients/INITIAL-PLACEHOLDER',
    'organizations/o/managers/INITIAL-PLACEHOLDER',
  ])
  assert.equal(plan.updates.length, 0)
  // Idempotent: once deleted, nothing is planned for those collections.
  const after = { ...input.collections, projects: [{ id: 'real-job', data: {} }], operatives: [] }
  assert.equal(planPlaceholderDocs(rulebook, { orgId: 'o', collections: after }).deletes.length, 0)
})

test('orphan-invites: report only — lists pending rows whose email claim is gone, never writes', () => {
  const users = [
    { id: '1B4E28BA-2FA1-11D2-883F-0016D3CCA427', data: { email: 'gone@x.com', firstName: 'Gone', passwordSet: false } },
    { id: 'u-claimed', data: { email: 'kept@x.com', firstName: 'Kept', passwordSet: false } },
    { id: 'u-active', data: { email: 'a@x.com', passwordSet: true, isActive: true } },
    { id: 'u-deleted', data: { email: '', firstName: 'Deleted user' } },
  ]
  const plan = planOrphanInvites(rulebook, { orgId: 'o', users, claimedEmails: ['kept@x.com'] })
  assert.deepEqual(plan.notes.map((row) => row.path), ['users/1B4E28BA-2FA1-11D2-883F-0016D3CCA427'])
  assert.match(plan.notes[0].reason, /invite placeholder id/)
  assert.equal(plan.updates.length + plan.deletes.length, 0)
  // A failed claim read never marks anyone.
  assert.equal(planOrphanInvites(rulebook, { orgId: 'o', users, claimedEmails: null }).notes.length, 0)
})

test('every registered check is report-only or plans partial updates and placeholder deletes only', () => {
  assert.deepEqual(CHECKS.map((check) => check.id), [
    'booking-status-spelling',
    'currency-literal-key',
    'office-address-map',
    'payroll-history-seed',
    'placeholder-docs',
    'orphan-invites',
  ])
  for (const check of CHECKS) assert.equal(typeof check.plan, 'function')
})

test('backup encoding round-trips Firestore types', () => {
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }
    toDate() {
      return new Date(this.seconds * 1000)
    }
  }
  class GeoPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude
      this.longitude = longitude
    }
  }
  class DocumentReference {
    constructor(p) {
      this.path = p
    }
  }
  const data = {
    when: new Timestamp(1700000000, 5),
    pin: new GeoPoint(51.5, -0.1),
    ref: new DocumentReference('organizations/o'),
    nested: { list: [1, 'a', null, new Timestamp(1, 0)] },
    bytes: new Uint8Array([1, 2, 3]),
  }
  const json = JSON.parse(JSON.stringify(encodeValue(data)))
  assert.deepEqual(json.when, { __fs: 'timestamp', seconds: 1700000000, nanoseconds: 5 })
  assert.deepEqual(json.pin, { __fs: 'geopoint', latitude: 51.5, longitude: -0.1 })
  assert.deepEqual(json.ref, { __fs: 'reference', path: 'organizations/o' })
  const back = decodeValue(json, { Timestamp, GeoPoint, reference: (p) => new DocumentReference(p) })
  assert.ok(back.when instanceof Timestamp)
  assert.equal(back.when.nanoseconds, 5)
  assert.ok(back.pin instanceof GeoPoint)
  assert.equal(back.ref.path, 'organizations/o')
  assert.ok(back.nested.list[3] instanceof Timestamp)
  assert.deepEqual([...back.bytes], [1, 2, 3])
})

test('dry-run report: per organisation, counts, sample paths, capped samples and the dry-run footer', () => {
  const plan = planBookingStatusSpelling(rulebook, {
    orgId: 'org1',
    bookings: ['a', 'b', 'c'].map((id) => ({ id, data: booking('confirmed') })),
    tombstoneIds: [],
  })
  const report = formatReport(
    [
      { orgId: 'org1', orgName: 'Acme', checks: [{ id: 'booking-status-spelling', plan }, { id: 'office-address-map', plan: { updates: [], deletes: [], notes: [] } }] },
      { orgId: 'org2', orgName: '', checks: [{ id: 'placeholder-docs', error: 'permission denied' }] },
    ],
    { projectId: 'demo', rulebookVersion: '1.22.0', samples: 2 }
  )
  assert.equal(
    report,
    [
      'Data clean-up — DRY RUN (nothing is written)',
      'Project: demo   Rulebook: 1.22.0   Organisations: 2',
      '',
      '== Organisation org1 (Acme)',
      '  booking-status-spelling: 3 to update',
      '    update organizations/org1/bookings/a — status "confirmed" → "Confirmed"',
      '    update organizations/org1/bookings/b — status "confirmed" → "Confirmed"',
      '    …and 1 more',
      '  office-address-map: nothing to do',
      '',
      '== Organisation org2',
      '  placeholder-docs: could not run — permission denied',
      '',
      'Summary: 3 to update, 0 to delete, 0 to review across 2 organisation(s).',
      'Dry run: nothing was written. Re-run with --apply to make these changes.',
    ].join('\n')
  )
  assert.match(formatReport([], { apply: true, backupDir: '/tmp/b' }), /Backups: \/tmp\/b/)
  assert.deepEqual(plannedPaths(plan), ['organizations/org1/bookings/a', 'organizations/org1/bookings/b', 'organizations/org1/bookings/c'])
})

test('shiftDayKey moves calendar days', () => {
  assert.equal(shiftDayKey('2026-03-01', -1), '2026-02-28')
  assert.equal(shiftDayKey('2024-03-01', -1), '2024-02-29')
  assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isClashGroupApproved,
  leaveCoverageRows,
  managerClashGroups,
  operativeClashGroups,
  resolvedWarningKeys,
  unbookedLabourRows,
  unverifiedOperativeRows,
  warningResolutionRecords,
} from '../canonical/index.ts'
import { warningDismissDocument } from './warningDismiss.ts'
import {
  leaveDismissRequest,
  managerClashDismissRequest,
  materialsDismissRequest,
  operativeClashDismissRequest,
  runWarningDismiss,
  unbookedDayDismissRequest,
  uniqueResolutionKeys,
  unverifiedDismissRequest,
  WARNING_DISMISS_COPY,
  warningRemovedNotice,
} from './warningDismissRequest.ts'

const TZ = 'Europe/London'
const ALLOWED = ['resolutionKey', 'status', 'resolvedByUserId', 'resolvedAt', 'updatedBy', 'updatedFrom', 'updatedAt']

/** What iOS `WarningResolutionStore.dismiss(key)` writes: `warningResolutionWriteFields`, status dismissed. */
function assertIosShape(keys: string[]) {
  for (const key of keys) {
    const write = warningDismissDocument({ resolutionKey: key, dismissedByUserId: 'mgr-1' })
    assert.ok(write, `${key} is writable`)
    assert.equal(write.documentId, key, 'document id is the key, stored case kept')
    assert.deepEqual(write.fields, {
      resolutionKey: key,
      status: 'dismissed',
      resolvedByUserId: 'mgr-1',
      updatedBy: 'mgr-1',
      updatedFrom: 'web',
    })
    for (const field of Object.keys(write.fields)) assert.ok(ALLOWED.includes(field), `${field} allowed by the rules`)
  }
}

function resolvedAfter(keys: string[]) {
  return resolvedWarningKeys(
    warningResolutionRecords(
      keys.map((key) => {
        const write = warningDismissDocument({ resolutionKey: key, dismissedByUserId: 'mgr-1' })!
        return { id: write.documentId, data: write.fields }
      }),
      TZ
    )
  )
}

const EMPTY = {
  clashWarnings: [],
  managerClashWarnings: [],
  unbookedWarnings: [],
  leaveWarnings: [],
  materialWarnings: [],
  qualificationWarnings: [],
  unverifiedWarnings: [],
}
const NO_DECISIONS = { acceptedClashes: [], dismissedQualificationKeys: new Set<string>() }

async function countsBeforeAfter(result: Record<string, unknown>, keys: string[]) {
  const { activeOrgWarnings } = await import('./generateOrgWarnings.ts')
  const before = activeOrgWarnings({ ...EMPTY, ...result } as never, { ...NO_DECISIONS, resolvedKeys: [] })
  const after = activeOrgWarnings({ ...EMPTY, ...result } as never, { ...NO_DECISIONS, resolvedKeys: resolvedAfter(keys) })
  return { before: before.coreCount, after: after.coreCount }
}

const at = new Date('2026-10-22T00:00:00.000Z')

test('operative clash (two bookings): writes the iOS key, the group key, and the row leaves the count', async () => {
  const people = { accounts: [{ id: 'U1', email: 'u1@example.com' }], operatives: [] }
  const [group] = operativeClashGroups({
    people,
    operativeBookings: [
      { id: 'b1', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'AM' },
      { id: 'b2', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'FULL DAY' },
    ],
  })
  const warning = {
    resolutionKey: group.resolutionKey,
    pairs: group.pairs.map((pair) => ({ bookingAId: pair.bookingAId, bookingBId: pair.bookingBId })),
    operativeName: 'Sam',
    date: at,
    entries: [],
  }
  const request = operativeClashDismissRequest(warning, TZ)
  assert.deepEqual(request.keys, [group.resolutionKey], 'two bookings: exactly the one key iOS writes')
  assertIosShape(request.keys)
  const { before, after } = await countsBeforeAfter({ clashWarnings: [{ id: group.pairKey, ...warning }] }, request.keys)
  assert.equal(before, 1)
  assert.equal(after, 0)
})

test('operative clash cluster (three bookings): every overlapping pair is dismissed so the cluster leaves', async () => {
  const people = { accounts: [{ id: 'U1', email: 'u1@example.com', formerIds: ['OLD'] }], operatives: [{ id: 'O1', email: 'U1@example.com' }] }
  const [group] = operativeClashGroups({
    people,
    operativeBookings: [
      { id: 'b3', operativeId: 'O1', dayKey: '2026-10-22', timeSlot: 'FULL DAY' },
      { id: 'b1', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'AM' },
      { id: 'b2', operativeId: 'old', dayKey: '2026-10-22', timeSlot: 'PM' },
    ],
  })
  const pairs = group.pairs.map((pair) => ({ bookingAId: pair.bookingAId, bookingBId: pair.bookingBId }))
  const request = operativeClashDismissRequest(
    { resolutionKey: group.resolutionKey, pairs, operativeName: 'Sam', date: at, entries: [] },
    TZ
  )
  // The iOS key (b1|b2, not an overlapping pair) plus each overlapping pair.
  assert.deepEqual(request.keys, ['b1|b2', 'b1|b3', 'b2|b3'])
  assertIosShape(request.keys)
  // The iOS key alone does not hide the cluster (isClashGroupApproved needs every pair): the web write does.
  assert.equal(isClashGroupApproved(group, { resolvedKeys: resolvedAfter([group.resolutionKey]), acceptedClashes: [] }), false)
  assert.equal(isClashGroupApproved(group, { resolvedKeys: resolvedAfter(request.keys), acceptedClashes: [] }), true)
})

test('manager clash: writes the managerClashGroups key iOS writes; the row leaves', async () => {
  const [group] = managerClashGroups({
    managerIds: ['M1'],
    people: { accounts: [{ id: 'M1', email: 'm@example.com' }], operatives: [] },
    managerBookings: [{ id: 'MB', userId: 'M1', dayKey: '2026-10-22', timeSlot: 'AM' }],
    operativeBookings: [{ id: 'OB', operativeId: 'M1', dayKey: '2026-10-22', timeSlot: 'FULL DAY', status: 'Confirmed' }],
  })
  assert.ok(group.resolutionKey.startsWith('mgr-clash-M1-2026-10-22-'))
  const request = managerClashDismissRequest({ resolutionKey: group.resolutionKey, personName: 'Max', date: at, entries: [] }, TZ)
  assert.deepEqual(request.keys, [group.resolutionKey])
  assertIosShape(request.keys)
  const { before, after } = await countsBeforeAfter(
    {
      managerClashWarnings: [
        { id: group.resolutionKey, resolutionKey: group.resolutionKey, bookingAId: group.bookingAId, bookingBId: group.bookingBId },
      ],
    },
    request.keys
  )
  assert.equal(before, 1)
  assert.equal(after, 0)
})

test('unbooked labour day card: every person row of the day (iOS warningsToDismiss); the count drops by all', async () => {
  const person = (id: string, name: string) => ({
    id,
    email: `${id}@site.test`,
    name,
    isActive: true,
    passwordSet: true,
    isOperativeMode: true,
    isManager: false,
    isAdmin: false,
    isSuperAdmin: false,
  })
  const rows = unbookedLabourRows({
    timeZone: TZ,
    startDayKey: '2026-10-22',
    endDayKey: '2026-10-22',
    includeWeekends: false,
    standardPaidHours: 8,
    people: [person('u-a', 'Ann'), person('u-b', 'Bob')],
    operatives: [],
    bookings: [],
    holidays: [],
  })
  assert.equal(rows.length, 2)
  const people = rows.map((row) => ({ id: row.id, operativeName: row.operativeName }))
  const request = unbookedDayDismissRequest(at, people, TZ)
  assert.deepEqual(request.keys, rows.map((row) => row.id))
  assertIosShape(request.keys)
  const { before, after } = await countsBeforeAfter({ unbookedWarnings: rows.map((row) => ({ id: row.id })) }, request.keys)
  assert.equal(before, 2)
  assert.equal(after, 0)
})

test('half-day leave not covered: writes the leaveCoverageRows id; the row leaves', async () => {
  const rows = leaveCoverageRows({
    timeZone: TZ,
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-12',
    day: { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    includeWeekends: false,
    people: [{ personKey: 'U-SAM', name: 'Sam Site', userId: 'U-SAM', operativeIds: [] }],
    leave: [{ id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'AM', approved: true }],
    bookings: [],
  })
  assert.equal(rows.length, 1)
  const row = rows[0]
  const request = leaveDismissRequest({ ...row, date: at }, TZ)
  assert.deepEqual(request.keys, [row.id])
  assert.match(request.detail, /Sam Site on .*Missing/)
  assertIosShape(request.keys)
  const { before, after } = await countsBeforeAfter({ leaveWarnings: [{ id: row.id, kind: row.kind }] }, request.keys)
  assert.equal(before, 1)
  assert.equal(after, 0)
})

test('unverified account and materials: the rulebook row id; the row leaves', async () => {
  const rows = unverifiedOperativeRows({
    referenceIso: '2026-09-25T11:00:00.000Z',
    operatives: [{ id: 'OP-PAT', email: 'pat@site.test', name: 'Pat Pending' }],
    people: [
      { email: 'pat@site.test', passwordSet: false, createdAtIso: '2026-09-16T11:00:00.000Z', isOperativeMode: true },
    ],
  })
  assert.equal(rows.length, 1)
  const request = unverifiedDismissRequest(rows[0])
  assert.deepEqual(request.keys, [rows[0].id])
  assertIosShape(request.keys)
  const materials = materialsDismissRequest({
    id: 'materials-Job-C646-2026-11-18',
    title: 'Material order not placed',
    projectLabel: 'C646 · Site',
    message: 'No material lines.',
  })
  assert.deepEqual(materials.keys, ['materials-Job-C646-2026-11-18'])
  assert.equal(materials.detail, 'Material order not placed: C646 · Site. No material lines.')
  const { before, after } = await countsBeforeAfter(
    { unverifiedWarnings: [{ id: rows[0].id }], materialWarnings: [{ id: materials.keys[0] }] },
    [...request.keys, ...materials.keys]
  )
  assert.equal(before, 2)
  assert.equal(after, 0)
})

test('nothing is written without a key or a user; keys are deduplicated ignoring case', () => {
  assert.deepEqual(uniqueResolutionKeys(['', '  ', null, undefined, 'A|B', 'a|b', 'c']), ['A|B', 'c'])
  assert.equal(warningDismissDocument({ resolutionKey: 'x', dismissedByUserId: '' }), null)
  assert.deepEqual(unbookedDayDismissRequest(at, [{ id: '', operativeName: 'X' }], TZ).keys, [])
})

test('confirm: a refused write keeps the card (error back, no admin notice); success notifies after the write', async () => {
  const order: string[] = []
  const refused = await runWarningDismiss({
    request: { keys: ['k1'] },
    write: async () => {
      order.push('write')
      throw new Error('Missing or insufficient permissions.')
    },
    notify: async () => {
      order.push('notify')
    },
  })
  assert.deepEqual(refused, { ok: false, error: 'Missing or insufficient permissions.' })
  assert.deepEqual(order, ['write'], 'no notice after a refused write')

  order.length = 0
  let written: string[] = []
  let relatedId: string | null = 'unset'
  const ok = await runWarningDismiss({
    request: { keys: ['k1', 'K1', 'k2'] },
    write: async (keys) => {
      written = keys
      order.push('write')
    },
    notify: async (id) => {
      order.push('notify')
      relatedId = id
      throw new Error('inbox down')
    },
  })
  assert.deepEqual(ok, { ok: true }, 'a failed notice never undoes the saved dismissal')
  assert.deepEqual(written, ['k1', 'k2'])
  assert.deepEqual(order, ['write', 'notify'])
  assert.equal(relatedId, 'k1', 'warning_removed relatedId is the warning key (rulebook §13)')

  const nothing = await runWarningDismiss({
    request: { keys: [] },
    write: async () => {
      throw new Error('should not write')
    },
    notify: async () => undefined,
  })
  assert.deepEqual(nothing, { ok: false, error: WARNING_DISMISS_COPY.failed })
})

test('the admin notice is the iOS text (notifyWarningRemoved)', () => {
  const notice = warningRemovedNotice({
    actorName: 'Max Manager',
    request: { kind: 'unbooked', detail: 'Unbooked labour on Thu 22 Oct 2026: Ann, Bob. 2 people are not booked.' },
  })
  assert.equal(notice.title, 'Warning dismissed by Max Manager')
  assert.equal(
    notice.message,
    'Max Manager dismissed a unbooked labour warning. Dismissed warnings do not reappear.\n\nUnbooked labour on Thu 22 Oct 2026: Ann, Bob. 2 people are not booked.'
  )
})

test('the sheet wording matches the iOS WarningDismissConfirmationSheet', () => {
  assert.equal(WARNING_DISMISS_COPY.title, 'Dismiss this warning?')
  assert.equal(
    WARNING_DISMISS_COPY.body,
    'Are you sure you would like to dismiss this warning? Any warnings that are dismissed will not reappear again.'
  )
  assert.equal(
    WARNING_DISMISS_COPY.notice,
    'All admins will get a notification with who dismissed it and what was dismissed. It also appears in the notification centre on Home.'
  )
  assert.equal(WARNING_DISMISS_COPY.confirm, 'Dismiss permanently')
  assert.equal(WARNING_DISMISS_COPY.cancel, 'Keep warning')
})

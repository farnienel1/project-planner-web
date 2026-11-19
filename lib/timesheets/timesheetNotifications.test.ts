import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  notifyTimesheetPendingManagerSignoff,
  notifyTimesheetSignedByManager,
  timesheetNoticeId,
  timesheetNotificationHref,
  timesheetPeerNoticeKey,
  timesheetRevisionToSignLinkFields,
  type InboxSave,
} from './timesheetNotifications.ts'
import type { User } from '../../types/index.ts'
import { notificationDestination } from '../canonical/index.ts'
import { dayKey } from '../ios-parity/londonTime.ts'

test('pending sign-off notifications open the user’s timesheet for the manager', () => {
  const weekStart = new Date('2026-09-16T00:00:00Z')
  const href = timesheetNotificationHref({
    type: 'timesheet_pending_manager_signoff',
    deepLinkUserId: 'op-1',
    deepLinkWeekStart: weekStart,
  })
  assert.equal(
    href,
    `/dashboard/timesheets/team?tab=awaiting&user=op-1&period=${dayKey(weekStart)}`
  )
})

test('manager-signed notifications open My Timesheets for that pay run', () => {
  const weekStart = new Date('2026-09-16T00:00:00Z')
  const href = timesheetNotificationHref({
    type: 'timesheet_signed_by_manager',
    deepLinkUserId: 'op-1',
    deepLinkWeekStart: weekStart,
  })
  assert.equal(href, `/dashboard/timesheets/mine?period=${dayKey(weekStart)}`)
})

test('peer line-manager updates open the signed timesheet', () => {
  const weekStart = new Date('2026-09-16T00:00:00Z')
  const href = timesheetNotificationHref({
    type: 'line_manager_peer_update',
    deepLinkUserId: 'op-1',
    deepLinkWeekStart: weekStart,
  })
  assert.equal(
    href,
    `/dashboard/timesheets/team?tab=signed&user=op-1&period=${dayKey(weekStart)}`
  )
})

test('submission reminders open My Timesheets', () => {
  const weekStart = new Date('2026-10-20T00:00:00Z')
  const href = timesheetNotificationHref({
    type: 'timesheet_submission_reminder',
    deepLinkWeekStart: weekStart,
  })
  assert.equal(href, `/dashboard/timesheets/mine?period=${dayKey(weekStart)}`)
})

test('other notification types do not deep-link into timesheets', () => {
  assert.equal(timesheetNotificationHref({ type: 'client_created' }), null)
})

test('1.55.0 review of #344 (L4): REV N notices are not swallowed as duplicates of the original', async () => {
  const weekStart = new Date('2026-10-31T23:00:00Z')
  const base = { subjectId: 'op-1', weekStart, timeZone: 'Europe/London' }
  const pending = (revision?: number) => timesheetNoticeId({ ...base, type: 'timesheet_pending_manager_signoff', recipientId: 'lm-1', revision })
  const signed = (revision?: number) => timesheetNoticeId({ ...base, type: 'timesheet_signed_by_manager', revision })
  assert.notEqual(await pending(1), await pending())
  assert.notEqual(await pending(2), await pending(1))
  assert.notEqual(await signed(1), await signed())
  assert.equal(await signed(), await signed(0), 'the original keeps its id')
})

test('1.60.1 (owner report 17 Nov): a re-sign of the same pay run is a new line-manager notice id', async () => {
  const weekStart = new Date('2026-10-31T23:00:00Z')
  const base = { subjectId: 'op-1', weekStart, timeZone: 'Europe/London', type: 'timesheet_pending_manager_signoff', recipientId: 'lm-1' }
  const first = new Date('2026-11-05T09:00:00Z')
  const again = new Date('2026-11-07T15:00:00Z')
  assert.notEqual(await timesheetNoticeId({ ...base, signedAt: first }), await timesheetNoticeId({ ...base, signedAt: again }))
  assert.equal(await timesheetNoticeId({ ...base, signedAt: first }), await timesheetNoticeId({ ...base, signedAt: new Date(first) }))
  assert.notEqual(await timesheetNoticeId({ ...base, signedAt: first }), await timesheetNoticeId(base))
})

test('1.60.1: a counter-sign again is a new signed notice id and a new peer notice key', async () => {
  const weekStart = new Date('2026-10-31T23:00:00Z')
  const base = { subjectId: 'op-1', weekStart, timeZone: 'Europe/London', type: 'timesheet_signed_by_manager' }
  const first = new Date('2026-11-06T10:00:00Z')
  const again = new Date('2026-11-09T11:00:00Z')
  assert.notEqual(await timesheetNoticeId({ ...base, signedAt: first }), await timesheetNoticeId({ ...base, signedAt: again }))
  assert.equal(await timesheetNoticeId({ ...base, signedAt: first }), await timesheetNoticeId({ ...base, signedAt: new Date(first) }))
  const peer = { signedByName: 'Lee', operativeName: 'Sam', periodLine: '1–15 Nov', peerId: 'lm-2' }
  assert.equal(timesheetPeerNoticeKey({ ...peer, signedAt: null }), "lmPeer|Lee|Sam's timesheet (1–15 Nov)|lm-2|signed", 'older key unchanged')
  assert.equal(timesheetPeerNoticeKey({ ...peer, signedAt: first }), `lmPeer|Lee|Sam's timesheet (1–15 Nov)|lm-2|signed|sig${first.getTime()}`)
  assert.notEqual(timesheetPeerNoticeKey({ ...peer, signedAt: first }), timesheetPeerNoticeKey({ ...peer, signedAt: again }))
})

test('review of iOS #243 (L5): a revision-to-sign notice carries dayKey, the pay run\'s first day in the organisation zone', () => {
  const london = timesheetRevisionToSignLinkFields('op-1', new Date('2026-11-01T00:00:00Z'), 'Europe/London')
  assert.equal(london.dayKey, '2026-11-01')
  assert.equal(london.deepLinkUserId, 'op-1')
  // Auckland midnight of 1 Nov is 31 Oct 11:00Z: the key is the organisation's day, never the UTC date.
  const auckland = timesheetRevisionToSignLinkFields('op-1', new Date('2026-10-31T11:00:00Z'), 'Pacific/Auckland')
  assert.equal(auckland.dayKey, '2026-11-01')
  assert.equal(
    notificationDestination({ type: 'timesheet_revision_to_sign', dayKey: london.dayKey, deepLinkUserId: 'op-1', role: 'operative' } as never)?.dayKey,
    '2026-11-01',
  )
})

// Review of #375 (2): the real notify paths with a stubbed save — a second signature writes a second row id, a retry of
// the same signature writes the same id.
function person(id: string, extra: Record<string, unknown>): User {
  return {
    id,
    email: `${id}@example.test`,
    firstName: id,
    surname: 'Test',
    organizationId: 'org-1',
    isActive: true,
    passwordSet: true,
    permissions: {},
    ...extra,
  } as unknown as User
}
const roster = [
  person('op-1', { role: 'operative', permissions: { operativeMode: true }, assignedManagerUserIds: ['lm-1', 'lm-2'] }),
  person('lm-1', { role: 'manager', permissions: { manager: true } }),
  person('lm-2', { role: 'manager', permissions: { manager: true } }),
]
function recorder() {
  const rows: Array<{ id?: string; type: string; userId?: string | null }> = []
  const save: InboxSave = async (input) => {
    rows.push({ id: input.id, type: input.type, userId: input.userId })
  }
  return { rows, save }
}
const periodStart = new Date('2026-10-31T23:00:00Z')

test('1.60.1 call path: the owner sign writes one line-manager row per signature', async () => {
  const sign = async (signedAt: Date) => {
    const { rows, save } = recorder()
    await notifyTimesheetPendingManagerSignoff({
      organizationId: 'org-1', signedByUser: roster[0], users: roster, weekStart: periodStart,
      timeZone: 'Europe/London', revision: null, signedAt, save,
    })
    return rows
  }
  const first = await sign(new Date('2026-11-05T09:00:00Z'))
  const retry = await sign(new Date('2026-11-05T09:00:00Z'))
  const again = await sign(new Date('2026-11-07T15:00:00Z'))
  assert.deepEqual(first.map((row) => row.userId).sort(), ['lm-1', 'lm-2'])
  assert.ok(first.every((row) => row.type === 'timesheet_pending_manager_signoff' && row.id))
  assert.deepEqual(retry.map((row) => row.id), first.map((row) => row.id), 'a retry of the same signature: the same rows')
  for (let i = 0; i < first.length; i++) assert.notEqual(again[i].id, first[i].id, 'a second signature: new rows')
})

test('1.60.1 call path: the counter-sign writes one signed row and one peer row per counter-signature', async () => {
  const counterSign = async (signedAt: Date) => {
    const { rows, save } = recorder()
    await notifyTimesheetSignedByManager({
      organizationId: 'org-1', subjectUser: roster[0], signedByName: 'lm-1 Test', signedByUserId: 'lm-1', users: roster,
      weekStart: periodStart, weekEnd: new Date('2026-11-15T00:00:00Z'), timeZone: 'Europe/London', revision: null,
      signedAt, save,
    })
    return rows
  }
  const first = await counterSign(new Date('2026-11-06T10:00:00Z'))
  const retry = await counterSign(new Date('2026-11-06T10:00:00Z'))
  const again = await counterSign(new Date('2026-11-09T11:00:00Z'))
  const ids = (rows: typeof first, type: string) => rows.filter((row) => row.type === type).map((row) => row.id)
  for (const type of ['timesheet_signed_by_manager', 'line_manager_peer_update']) {
    assert.equal(ids(first, type).length, 1, type)
    assert.deepEqual(ids(retry, type), ids(first, type), `${type}: a retry is the same row`)
    assert.notDeepEqual(ids(again, type), ids(first, type), `${type}: a counter-sign again is a new row`)
  }
})

test('1.60.1 call sites: TimesheetPeriodPage passes the signature instants to both notices', () => {
  const page = readFileSync(new URL('../../components/timesheets/TimesheetPeriodPage.tsx', import.meta.url), 'utf8')
  const call = (name: string) => {
    // Called through afterPrimaryWrite (the notice never holds the save), so no `await` in front.
    const start = page.indexOf(`${name}({`)
    assert.ok(start > 0, name)
    return page.slice(start, page.indexOf('})', start))
  }
  assert.match(call('notifyTimesheetPendingManagerSignoff'), /\n\s*signedAt,\n/)
  assert.match(call('notifyTimesheetSignedByManager'), /\n\s*signedAt: managerSignedAt,\n/)
  assert.match(page, /operativeSignedAt: signedAt,/)
  assert.match(page, /managerSignedAt,\n\s*managerSignedByName/)
})

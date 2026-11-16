import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timesheetNoticeId, timesheetNotificationHref, timesheetRevisionToSignLinkFields } from './timesheetNotifications.ts'
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

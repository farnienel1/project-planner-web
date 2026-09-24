import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timesheetNotificationHref } from './timesheetNotifications.ts'
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

test('other notification types do not deep-link into timesheets', () => {
  assert.equal(timesheetNotificationHref({ type: 'client_created' }), null)
})

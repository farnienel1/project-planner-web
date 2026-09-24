import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIMESHEETS_HUB_PATH,
  legacyTimesheetRedirect,
  timesheetSurfaceFromPath,
  timesheetLinkShouldHardReset,
  timesheetsMineHref,
  timesheetsTeamHref,
} from './timesheetRoutes.ts'

test('timesheet paths keep the hub distinct from user timesheets', () => {
  assert.equal(timesheetSurfaceFromPath('/dashboard/timesheets'), 'hub')
  assert.equal(timesheetSurfaceFromPath('/dashboard/timesheets/mine'), 'mine')
  assert.equal(timesheetSurfaceFromPath('/dashboard/timesheets/team'), 'team')
  assert.equal(timesheetsMineHref(), '/dashboard/timesheets/mine')
  assert.equal(timesheetsMineHref('2026-09-01'), '/dashboard/timesheets/mine?period=2026-09-01')
  assert.equal(
    timesheetsTeamHref({ tab: 'awaiting', user: 'op-1', period: '2026-09-01' }),
    '/dashboard/timesheets/team?tab=awaiting&user=op-1&period=2026-09-01'
  )
  assert.equal(timesheetsTeamHref({ tab: 'awaiting' }), '/dashboard/timesheets/team?tab=awaiting')
})

test('legacy surface query redirects onto the nested path and drops surface', () => {
  assert.equal(
    legacyTimesheetRedirect('team', '?surface=team&tab=awaiting&user=op-1&period=2026-09-01'),
    '/dashboard/timesheets/team?tab=awaiting&user=op-1&period=2026-09-01'
  )
  assert.equal(legacyTimesheetRedirect('mine', 'surface=mine&period=2026-09-01'), '/dashboard/timesheets/mine?period=2026-09-01')
  assert.equal(legacyTimesheetRedirect(null, ''), null)
})

test('same-pathname timesheet links hard-reset so the query cannot stick', () => {
  assert.equal(
    timesheetLinkShouldHardReset(TIMESHEETS_HUB_PATH, '?surface=team&tab=awaiting', TIMESHEETS_HUB_PATH),
    true
  )
  assert.equal(timesheetLinkShouldHardReset(TIMESHEETS_HUB_PATH, '', TIMESHEETS_HUB_PATH), false)
  assert.equal(
    timesheetLinkShouldHardReset('/dashboard/timesheets/team', '?tab=awaiting&user=op-1', '/dashboard/timesheets'),
    false
  )
  assert.equal(
    timesheetLinkShouldHardReset(
      '/dashboard/timesheets/team',
      '?tab=awaiting&user=op-1',
      '/dashboard/timesheets/team?tab=awaiting'
    ),
    true
  )
  assert.equal(
    timesheetLinkShouldHardReset('/dashboard/timesheets/team', '?tab=awaiting', '/dashboard/timesheets/team?tab=signed'),
    true
  )
})

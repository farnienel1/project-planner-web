import type { UserTimesheetQueueInput } from './userTimesheetQueue'

/**
 * 1.66.0 §8: the shared Awaiting sign-off scenario. Its cases are in `parity-fixture.json`, which web
 * (`canonical.test.ts`) and iOS (`CanonicalParityFixtureTests`) both run through the packed script, so both apps
 * count the same rows for the same data.
 */
export const ADMIN_ROLE = { isSuperAdmin: false, isAdmin: true, isManager: true, isOperativeMode: false }
export const MANAGER_ROLE = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
export const OPERATIVE_ROLE = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }

const SIGNED = Date.parse('2026-10-20T10:00:00Z')
const COUNTER = Date.parse('2026-10-21T10:00:00Z')
const EXPORTED = Date.parse('2026-10-22T10:00:00Z')
export const awaiting = { operativeSignedAt: SIGNED, operativeSignedByName: 'Worker' }
const signedOff = { ...awaiting, managerSignedAt: COUNTER, managerSignedByName: 'Admin' }
const exported = { ...signedOff, exportedAt: EXPORTED }

/** The shared scenario (also in parity-fixture.json, run by both apps): one admin viewer, every edge case. */
export function awaitingQueueScenario(): UserTimesheetQueueInput {
  return {
    viewer: { id: 'admin', formerIds: [], aliasIds: [], role: ADMIN_ROLE },
    timeZone: 'Europe/London',
    members: [
      { id: 'admin', email: 'admin@example.com', isActive: true, role: ADMIN_ROLE, employmentType: 'self_employed', hasNoLineManager: true },
      // One person, three ids: their users document, a former invite id and a second users document on their email.
      { id: 'OP-1', email: 'worker@example.com', isActive: true, role: OPERATIVE_ROLE, employmentType: 'self_employed', assignedManagerUserIds: ['admin'], formerUserIds: ['old-invite-1'] },
      { id: 'op-1b', email: 'Worker@Example.com', isActive: true, role: OPERATIVE_ROLE, employmentType: 'self_employed', assignedManagerUserIds: ['admin'] },
      // PAYE for the whole run: no sheet.
      { id: 'paye-1', email: 'paye@example.com', isActive: true, role: OPERATIVE_ROLE, employmentType: 'paye', assignedManagerUserIds: ['admin'] },
      // PAYE until 1 Oct 2026, self-employed from then.
      {
        id: 'op-3',
        email: 'three@example.com',
        isActive: true,
        role: MANAGER_ROLE,
        employmentType: 'self_employed',
        employmentTypeTransitionFrom: 'paye',
        employmentTypeEffectiveAt: Date.parse('2026-09-30T23:00:00Z'),
        assignedManagerUserIds: ['admin'],
      },
      // Inactive: never listed.
      { id: 'gone', email: 'gone@example.com', isActive: false, role: OPERATIVE_ROLE, employmentType: 'self_employed', assignedManagerUserIds: ['admin'] },
    ],
    sheets: [
      // 10 months old and still waiting: listed.
      { userId: 'OP-1', startDayKey: '2026-01-01', endDayKey: '2026-01-15', data: awaiting, documentId: 'timesheet_OP-1_1767225600', hasActivity: true },
      // One run under two of the person's ids: one row.
      { userId: 'old-invite-1', startDayKey: '2026-02-01', endDayKey: '2026-02-15', data: awaiting, documentId: 'timesheet_old-invite-1_1769904000', hasActivity: true },
      { userId: 'op-1b', startDayKey: '2026-02-01', endDayKey: '2026-02-15', data: {}, documentId: 'timesheet_op-1b_1769904000' },
      { userId: 'op-1', startDayKey: '2026-03-01', endDayKey: '2026-03-15', data: signedOff, documentId: 'timesheet_op-1_1772323200', hasActivity: true },
      { userId: 'OP-1', startDayKey: '2026-04-01', endDayKey: '2026-04-15', data: exported, documentId: 'timesheet_OP-1_1775001600', hasActivity: true },
      // An exported original and its open revision: the revision decides (awaiting).
      { userId: 'OP-1', startDayKey: '2026-05-01', endDayKey: '2026-05-15', data: exported, documentId: 'timesheet_OP-1_1777590000', hasActivity: true },
      { userId: 'OP-1', startDayKey: '2026-05-01', endDayKey: '2026-05-15', data: awaiting, documentId: 'timesheet_OP-1_1777590000_rev1', hasActivity: true },
      // Stored without userId: matched by its document id.
      { startDayKey: '2026-06-16', endDayKey: '2026-06-30', data: awaiting, documentId: 'timesheet_OP-1_1781564400', hasActivity: true },
      { userId: 'paye-1', startDayKey: '2026-06-01', endDayKey: '2026-06-15', data: awaiting, documentId: 'timesheet_paye-1_1780268400', hasActivity: true },
      { userId: 'op-3', startDayKey: '2026-09-01', endDayKey: '2026-09-15', data: awaiting, documentId: 'timesheet_op-3_1788217200', hasActivity: true },
      { userId: 'op-3', startDayKey: '2026-10-16', endDayKey: '2026-10-31', data: awaiting, documentId: 'timesheet_op-3_1792105200', hasActivity: true },
      // The viewer's own sheet: never listed.
      { userId: 'admin', startDayKey: '2026-10-16', endDayKey: '2026-10-31', data: awaiting, documentId: 'timesheet_admin_1792105200', hasActivity: true },
      { userId: 'gone', startDayKey: '2026-10-16', endDayKey: '2026-10-31', data: awaiting, documentId: 'timesheet_gone_1792105200', hasActivity: true },
      // 1.66.0: an old signed-off run whose bookings are not loaded (no bookingsChange) with a late extra waiting for the
      // line manager: the late extras in the stored sheet decide alone — Awaiting (§8 1.54.0).
      {
        userId: 'OP-1',
        startDayKey: '2026-07-01',
        endDayKey: '2026-07-15',
        data: { ...signedOff, lateExtras: [{ id: 'late-1', kind: 'expense', title: 'Parking', amount: 12, date: '2026-07-03' }] },
        documentId: 'timesheet_OP-1_1782860400',
      },
      // 1.66.0: two copies of one run, neither flagged: the one with activity (here only a signed snapshot,
      // `timesheetSheetHasActivity`) is picked over the empty one stored first.
      { userId: 'op-1b', startDayKey: '2026-08-01', endDayKey: '2026-08-15', data: {}, documentId: 'timesheet_op-1b_1785538800' },
      { userId: 'OP-1', startDayKey: '2026-08-01', endDayKey: '2026-08-15', data: { weeklyReportOverride: { lines: [] } }, documentId: 'timesheet_OP-1_1785538800' },
      // Signed off, but a booking changed and the person must sign again: neither Awaiting nor Signed off.
      { userId: 'OP-1', startDayKey: '2026-11-01', endDayKey: '2026-11-15', data: signedOff, documentId: 'timesheet_OP-1_1793491200', hasActivity: true, bookingsChange: { reopened: true, waitingFor: 'person' } },
      // Signed by the person, changed, signed again: Awaiting the counter-signature again.
      { userId: 'op-3', startDayKey: '2026-11-01', endDayKey: '2026-11-15', data: signedOff, documentId: 'timesheet_op-3_1793491200', hasActivity: true, bookingsChange: { reopened: true, waitingFor: 'lineManager' } },
    ],
  }
}


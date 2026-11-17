/**
 * 17 Nov owner test (Farnie Nel, Raccord MEP, C646 · 1 Carnaby Street, £225/day): the bugs found, each reproduced first.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { draftFromFirestoreMap, draftToFirestoreMap } from './timesheetStorage.ts'
import { invoiceLinesForTimesheet, invoiceLinesTotal } from './timesheetExport.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import { draftBookingChanges, draftSignedBookingRecord } from './timesheetBookingChanges.ts'
import { wrapPdfText } from './invoicePdf.ts'
import { runTimesheetExport } from './timesheetExportRun.ts'
import { userIdsSharingEmail } from './timesheetWeekUtils.ts'

const farnie = {
  id: 'u1',
  email: 'farnie@x.com',
  firstName: 'Farnie',
  surname: 'Nel',
  organizationId: 'org',
  role: 'operative',
  passwordSet: true,
  isActive: true,
  permissions: { operativeMode: true },
  dayRate: 225,
  payBasis: 'day',
  employmentType: 'self_employed',
  assignedManagerUserId: 'mgr',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as unknown as User
// A second users document on Farnie's email (an earlier invite placeholder): bookings filed under it are Farnie's.
const farnieSameEmail = { ...farnie, id: 'u1-copy', passwordSet: false } as unknown as User
const testAdmin = { ...farnie, id: 'mgr', email: 'admin@x.com', firstName: 'Test', surname: 'Admin', role: 'admin', assignedManagerUserId: undefined, permissions: { adminAccess: true } } as unknown as User
const users = [farnie, testAdmin, farnieSameEmail]
const carnaby = { id: 'p1', jobNumber: 'C646', siteName: '1 Carnaby Street', isLive: true, createdAt: new Date(), updatedAt: new Date(), startDate: new Date(), endDate: new Date() } as unknown as Project
const tz = 'Europe/London'
const start = new Date('2026-11-01T00:00:00Z')
const end = new Date('2026-11-15T00:00:00Z')
const written = new Date('2026-11-10T09:00:00Z')

function booking(id: string, day: string, extra: Partial<Booking> = {}): Booking {
  return { id, operativeId: 'u1-copy', projectId: 'p1', date: new Date(`${day}T00:00:00Z`), timeSlot: 'FULL DAY', bookedBy: 'Test Admin', status: 'Confirmed', createdAt: written, updatedAt: written, ...extra } as Booking
}

const common = {
  user: farnie,
  users,
  weekStart: start,
  weekEnd: end,
  managerSiteBookings: [],
  operatives: [] as Operative[],
  projects: [carnaby],
  smallWorks: [],
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  timeZone: tz,
}

/** What the period page shows: the collector with the person's same-email ids. */
function screenLines(bookings: Booking[]) {
  return collectTimesheetPayroll({
    ...common,
    periodStart: start,
    periodEnd: end,
    bookings,
    history: undefined as never,
    scheduleOptions: undefined as never,
    aliasUserIds: userIdsSharingEmail(farnie, users),
  }).lineItems
}

/** The sheet saved and read back (Firestore shape). */
function stored(draft: TimesheetDraft): TimesheetDraft {
  const map = draftToFirestoreMap(draft) as Record<string, unknown>
  map.userId = 'u1'
  if (draft.operativeSignedBookingsAtPending) map.operativeSignedBookingsAt = Timestamp.fromDate(new Date())
  return draftFromFirestoreMap(map, { sheetDocId: 'timesheet_u1_1793491200', timeZone: tz })
}

function changes(draft: TimesheetDraft, bookings: Booking[]) {
  return draftBookingChanges({ draft, lines: screenLines(bookings), bookings, managerSiteBookings: [], timeZone: tz, personIds: ['u1', 'u1-copy'], liveLoaded: true, selfSigned: false })
}

function personSigns(draft: TimesheetDraft, bookings: Booking[], at: Date): TimesheetDraft {
  return {
    ...draft,
    operativeSignedAt: at,
    operativeSignedByName: 'Farnie Nel',
    operativeSignedBookings: draftSignedBookingRecord({ lines: screenLines(bookings), bookings, managerSiteBookings: [], timeZone: tz }),
    operativeSignedBookingsAt: null,
    operativeSignedBookingsAtPending: true,
    operativeSignedBookingsSignedAt: at,
  }
}

const priceWork = {
  id: 'pw1',
  title: 'TEST price workk',
  details: '',
  jobNumber: 'C646',
  agreedManagerName: 'Test Admin',
  startDate: new Date('2026-11-14T00:00:00Z'),
  endDate: null,
  amount: 195,
  managerDecision: 'pending' as const,
  managerRevisedAmount: null,
}

test('(a)/(f) re-sign and counter-sign after a booking change: the invoice keeps every booking line, not only the price work', () => {
  let bookings = [booking('b1', '2026-11-10'), booking('b2', '2026-11-11')]
  const first = new Date(Date.now() - 3_600_000)
  let draft: TimesheetDraft = personSigns({ ...emptyTimesheetDraft(), priceWorkEntries: [priceWork] }, bookings, first)
  draft = stored(applyWeeklyReportOverride({ ...common, bookings, draft }))
  // The line manager counter-signs (the period page's persist passes no `aliasUserIds`).
  draft = stored(
    applyWeeklyReportOverride({
      ...common,
      bookings,
      draft: { ...draft, managerSignedAt: new Date(Date.now() - 3_000_000), managerSignedByName: 'Test Admin', managerSignedByUserId: 'mgr' },
    })
  )
  // Before the fix the snapshot held no labour: the bookings are filed under Farnie's same-email document.
  assert.deepEqual(draft.weeklyReportOverride?.lines.map((line) => line.id).sort(), ['op-b1-normal', 'op-b2-normal'])

  // A booking changes; Farnie signs again; the line manager counter-signs again (the snapshot is rebuilt).
  bookings = [booking('b1', '2026-11-10'), booking('b2', '2026-11-11', { timeSlot: 'CUSTOM_HOURS' as Booking['timeSlot'], workStartTime: '07:00', workEndTime: '18:00', updatedAt: new Date() })]
  assert.equal(changes(draft, bookings)?.waitingFor, 'person')
  draft = stored(applyWeeklyReportOverride({ ...common, bookings, draft: personSigns(draft, bookings, new Date()) }))
  const afterSign = changes(draft, bookings)
  assert.equal(afterSign?.waitingFor, 'lineManager')
  draft = stored(
    applyWeeklyReportOverride({
      ...common,
      bookings,
      rebuildSnapshot: afterSign?.reopened === true,
      draft: { ...draft, managerSignedAt: new Date(Date.now() + 1000), managerSignedByName: 'Test Admin', managerSignedByUserId: 'mgr' },
    })
  )
  assert.equal(changes(draft, bookings)?.reopened, false)
  const invoice = invoiceLinesForTimesheet({ payroll: { lineItems: screenLines(bookings) } as never, draft, timeZone: tz, extrasMode: 'export', standardDayHours: 8, currencyCode: 'GBP' })
  assert.deepEqual(
    invoice.map((line) => line.projectName),
    ['1 Carnaby Street', '1 Carnaby Street', '1 Carnaby Street (Overtime)', 'Price work']
  )
  assert.ok(invoiceLinesTotal(invoice) > 195 + 2 * 225 - 0.01)
  // (g) the price work row shows its title, never "0h · rate not set".
  assert.equal(invoice[3].details, 'TEST price workk')
})

test('(g) a signed snapshot that lacks a booking the person signed is stale: the line manager counter-signs again', () => {
  const bookings = [booking('b1', '2026-11-10'), booking('mon', '2026-11-11', { operativeId: 'u1' })]
  // The person signed both bookings; the snapshot (built by an older web build) lacks b1, filed under the same-email id.
  const signed = personSigns({ ...emptyTimesheetDraft() }, bookings, new Date(Date.now() - 60_000))
  const snapshot = applyWeeklyReportOverride({
    ...common,
    aliasUserIds: ['u1'],
    bookings,
    draft: { ...signed, managerSignedAt: new Date(Date.now() - 30_000), managerSignedByName: 'Test Admin', managerSignedByUserId: 'mgr' },
  })
  assert.deepEqual(snapshot.weeklyReportOverride?.lines.map((line) => line.id), ['op-mon-normal'])
  const draft = stored(snapshot)
  const unexported = changes(draft, bookings)
  assert.equal(unexported?.reopened, true)
  assert.equal(unexported?.waitingFor, 'lineManager')
  assert.deepEqual(unexported?.addedBookingIds, ['b1'])
  // Exported: the sheet stays frozen and a revision becomes due.
  const exported = changes({ ...draft, exportedAt: new Date(), exportedAtStored: true }, bookings)
  assert.equal(exported?.exported, true)
  assert.equal(exported?.changed, true)
})

test('(g) invoice details wrap instead of being cut off with "…"', () => {
  const details = '06:00–07:00 + 16:00–17:30 · 0.29 days × £337.50/day = £99.26 · OT 2.5h × 1.5 = 3.75h'
  const lines = wrapPdfText(details, 190, 9.5)
  assert.ok(lines.length > 1)
  assert.equal(lines.join(' '), details)
  assert.ok(lines.every((line) => !line.endsWith('…')))
  assert.deepEqual(wrapPdfText('', 190, 9.5), [''])
})

test('(c) export finishes once the sheets are stamped; delivery runs on in the background', async () => {
  let release: () => void = () => undefined
  const deliveryGate = new Promise<void>((resolve) => {
    release = resolve
  })
  let delivered = false
  const run = await runTimesheetExport({
    members: ['a', 'b', 'c'],
    memberId: (member) => member,
    memberName: (member) => member,
    gateReady: () => true,
    prepare: async (member) => ({ member }),
    stamp: async () => true,
    forgetHistory: () => undefined,
    deliverInBackground: true,
    deliver: async () => {
      await deliveryGate
      delivered = true
    },
  })
  assert.deepEqual(run.stamped.map((row) => row.name), ['a', 'b', 'c'])
  assert.equal(delivered, false)
  assert.ok(run.delivery)
  release()
  await run.delivery
  assert.equal(delivered, true)
})

test('(c) sheets are prepared a few at a time, in member order', async () => {
  let inFlight = 0
  let most = 0
  const run = await runTimesheetExport({
    members: ['a', 'b', 'c', 'd', 'e'],
    memberId: (member) => member,
    memberName: (member) => member,
    gateReady: () => true,
    prepare: async (member) => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return member === 'c' ? null : { member }
    },
    stamp: async () => true,
    forgetHistory: () => undefined,
    deliver: async () => undefined,
  })
  assert.ok(most > 1)
  assert.deepEqual(run.stamped.map((row) => row.name), ['a', 'b', 'd', 'e'])
})

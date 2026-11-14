import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOOKING_REPLACE_LABEL,
  bookingReplaceOffer,
  bookingReplaceWrites,
  offlineAvailability,
  resolveBookingPerson,
  scheduleDayCell,
} from './index'

// MARK: - 1.41.0 §21 one tile per person-day (owner option a)

test('1.41.0 scheduleDayCell: two bookings read the day total and the count, standard and overtime underneath', () => {
  const cell = scheduleDayCell({
    bookings: [
      { paidHours: 8, overtimeHours: 0, timeSlot: 'FULL DAY' },
      { paidHours: 18, overtimeHours: 8, timeSlot: 'CUSTOM', overtime: { clockHours: 4, multiplier: 2, breakHours: 0 } },
    ],
  })
  assert.ok(cell)
  assert.equal(cell.headline, '26h · 2 bookings')
  assert.equal(cell.hoursText, '26h')
  assert.equal(cell.countText, '2 bookings')
  assert.equal(cell.bookingCount, 2)
  assert.equal(cell.tone, 'split')
  assert.equal(cell.standardText, '18h Std')
  assert.equal(cell.overtimeText, '8h OT')
  assert.deepEqual(cell.overtimeLines, ['4h × 2 = 8h'])
  assert.equal(cell.caption, null)
})

test('1.41.0 scheduleDayCell: one booking keeps its own tile and slot colour, no count', () => {
  const full = scheduleDayCell({ bookings: [{ paidHours: 7.25, overtimeHours: 0, timeSlot: 'FULL DAY' }] })
  assert.equal(full?.headline, '7.25h')
  assert.equal(full?.countText, null)
  assert.equal(full?.tone, 'standard')
  assert.equal(full?.caption, 'Std')
  const am = scheduleDayCell({ bookings: [{ paidHours: 4, overtimeHours: 0, timeSlot: 'AM' }] })
  assert.equal(am?.tone, 'halfDay')
  assert.equal(am?.caption, 'AM')
  const ot = scheduleDayCell({ bookings: [{ paidHours: 13, overtimeHours: 13, overtime: { clockHours: 6.5, multiplier: 2, breakHours: 0.5 } }] })
  assert.equal(ot?.tone, 'otOnly')
  assert.equal(ot?.caption, 'OT')
  assert.deepEqual(ot?.overtimeLines, ['6.5h × 2 − 0.5h break = 12.5h'])
})

test('1.41.0 scheduleDayCell: an AM slot decides the colour only when it is the day\'s one booking', () => {
  const cell = scheduleDayCell({ bookings: [{ paidHours: 4, overtimeHours: 0, timeSlot: 'AM' }, { paidHours: 4, overtimeHours: 0, timeSlot: 'PM' }] })
  assert.equal(cell?.tone, 'standard')
  assert.equal(cell?.headline, '8h · 2 bookings')
})

test('1.41.0 scheduleDayCell: overtime at one rate is added together, different rates listed apart', () => {
  const cell = scheduleDayCell({
    bookings: [
      { paidHours: 10, overtimeHours: 3, overtime: { clockHours: 2, multiplier: 1.5 } },
      { paidHours: 3, overtimeHours: 3, overtime: { clockHours: 2, multiplier: 1.5 } },
      { paidHours: 4, overtimeHours: 4, overtime: { clockHours: 2, multiplier: 2 } },
    ],
  })
  assert.deepEqual(cell?.overtimeLines, ['4h × 1.5 = 6h', '2h × 2 = 4h'])
  assert.equal(cell?.headline, '17h · 3 bookings')
})

test('1.41.0 scheduleDayCell: on a leave day the Std / OT words are dropped so the figures fit (owner yes)', () => {
  const cell = scheduleDayCell({
    onLeave: true,
    bookings: [{ paidHours: 10, overtimeHours: 2, overtime: { clockHours: 1, multiplier: 2 } }],
  })
  assert.equal(cell?.standardText, '8h')
  assert.equal(cell?.overtimeText, '2h')
  assert.equal(cell?.caption, null)
  const std = scheduleDayCell({ onLeave: true, bookings: [{ paidHours: 4, overtimeHours: 0 }] })
  assert.equal(std?.caption, null)
  const half = scheduleDayCell({ onLeave: true, bookings: [{ paidHours: 4, overtimeHours: 0, timeSlot: 'PM' }] })
  assert.equal(half?.caption, 'PM', 'AM / PM stay: they are not the Std / OT words')
})

test('1.41.0 scheduleDayCell: no booking is no tile; a 0h booking is still a tile', () => {
  assert.equal(scheduleDayCell({ bookings: [] }), null)
  assert.equal(scheduleDayCell(null), null)
  const zero = scheduleDayCell({ bookings: [{ paidHours: 0, overtimeHours: 0 }] })
  assert.equal(zero?.headline, '0h')
  assert.equal(zero?.tone, 'standard')
})

// MARK: - 1.41.0 §5 Replace existing booking

test('1.41.0 bookingReplaceOffer: offered only when the viewer may delete every overlapping booking', () => {
  assert.deepEqual(
    bookingReplaceOffer({ clashing: [{ bookingId: 'B1', collection: 'bookings', mayDelete: true }, { bookingId: 'm1', collection: 'managerSiteBookings', mayDelete: true }] }),
    { offered: true, bookings: [{ collection: 'bookings', bookingId: 'B1' }, { collection: 'managerSiteBookings', bookingId: 'm1' }] }
  )
  assert.equal(bookingReplaceOffer({ clashing: [{ bookingId: 'B1', collection: 'bookings', mayDelete: true }, { bookingId: 'B2', collection: 'bookings', mayDelete: false }] }).offered, false)
  assert.equal(bookingReplaceOffer({ clashing: [{ bookingId: 'B1', collection: 'bookings' }] }).offered, false, 'unknown permission withholds it')
  assert.equal(bookingReplaceOffer({ clashing: [{ bookingId: 'S1', collection: 'subcontractorBookings', mayDelete: true }] }).offered, false)
  assert.equal(bookingReplaceOffer({ clashing: [] }).offered, false)
  assert.equal(bookingReplaceOffer(null).offered, false)
  assert.equal(bookingReplaceOffer({ clashing: [{ bookingId: 'a/b', collection: 'bookings', mayDelete: true }] }).offered, false)
  assert.deepEqual(
    bookingReplaceOffer({ clashing: [{ bookingId: 'ABC', collection: 'bookings', mayDelete: true }, { bookingId: 'abc', collection: 'bookings', mayDelete: true }] }).bookings,
    [{ collection: 'bookings', bookingId: 'ABC' }],
    'the same booking without case once, stored spelling kept'
  )
  assert.equal(BOOKING_REPLACE_LABEL, 'Replace')
})

test('1.41.0 bookingReplaceWrites: the new booking, each replaced delete and its tombstone in one plan', () => {
  const plan = bookingReplaceWrites({
    organizationId: 'ORG1',
    booking: { collection: 'bookings', bookingId: 'NEW1' },
    replaced: [
      { collection: 'bookings', bookingId: 'old1' },
      { collection: 'managerSiteBookings', bookingId: 'OLD2' },
      { collection: 'bookings', bookingId: 'OLD1' },
    ],
    deletedBy: 'uid-1',
    deletedFrom: 'web',
  })
  assert.ok(plan)
  assert.equal(plan.bookingPath, 'organizations/ORG1/bookings/NEW1')
  assert.deepEqual(
    plan.deletes.map((d) => [d.path, d.tombstonePath]),
    [
      ['organizations/ORG1/bookings/old1', 'organizations/ORG1/deletedBookings/old1'],
      ['organizations/ORG1/managerSiteBookings/OLD2', 'organizations/ORG1/deletedBookings/OLD2'],
    ]
  )
  assert.deepEqual(plan.deletes[0].tombstone, { bookingId: 'old1', collection: 'bookings', deletedBy: 'uid-1', deletedFrom: 'web' })
  assert.deepEqual(plan.deletes[1].tombstone, { bookingId: 'OLD2', collection: 'managerSiteBookings', deletedBy: 'uid-1', deletedFrom: 'web' })
})

test('1.41.0 bookingReplaceWrites: refuses anything that would half apply or delete the wrong thing', () => {
  const base = { organizationId: 'ORG1', booking: { collection: 'bookings', bookingId: 'NEW1' }, deletedBy: 'u', deletedFrom: 'ios' }
  assert.equal(bookingReplaceWrites({ ...base, replaced: [] }), null, 'nothing to replace')
  assert.equal(bookingReplaceWrites({ ...base, replaced: [{ collection: 'bookings', bookingId: 'new1' }] }), null, 'never itself')
  assert.equal(bookingReplaceWrites({ ...base, replaced: [{ collection: 'subcontractorBookings', bookingId: 'S' }] }), null)
  assert.equal(bookingReplaceWrites({ ...base, deletedBy: '', replaced: [{ collection: 'bookings', bookingId: 'X' }] }), null)
  assert.equal(bookingReplaceWrites({ ...base, deletedFrom: 'desktop', replaced: [{ collection: 'bookings', bookingId: 'X' }] }), null)
  assert.equal(bookingReplaceWrites({ ...base, organizationId: '', replaced: [{ collection: 'bookings', bookingId: 'X' }] }), null)
  assert.equal(bookingReplaceWrites({ ...base, booking: { collection: 'bookings', bookingId: '' }, replaced: [{ collection: 'bookings', bookingId: 'X' }] }), null)
  assert.ok(bookingReplaceWrites({ ...base, booking: { collection: 'managerSiteBookings', bookingId: 'M' }, replaced: [{ collection: 'bookings', bookingId: 'X' }] }))
})

test('1.41.0 Replace is online only on iOS and Android', () => {
  assert.equal(offlineAvailability('booking.replace'), 'onlineOnly')
  assert.equal(offlineAvailability('booking.create'), 'allowedOffline', 'book both / drop still work offline')
})

// MARK: - 1.41.0 a booked person is never unknown (guardrail 1)

test('1.41.0 resolveBookingPerson: former ids, same-email ids, operatives rows and ghosts all resolve', () => {
  const input = {
    accounts: [
      { id: 'uid-farnie', email: 'farnie@example.test', formerIds: ['old-invite'], aliasIds: ['uid-farnie-2'] },
      { id: 'uid-ghost', email: '' },
    ],
    operatives: [
      { id: 'OP-1', email: 'Farnie@Example.test' },
      { id: 'OP-catalogue', email: '' },
    ],
  }
  assert.equal(resolveBookingPerson('OLD-INVITE', input).accountId, 'uid-farnie', 'a former invite id, any case')
  assert.equal(resolveBookingPerson('uid-farnie-2', input).accountId, 'uid-farnie', 'a same-email document id')
  assert.equal(resolveBookingPerson('op-1', input).accountId, 'uid-farnie', 'an operatives row on their email')
  assert.equal(resolveBookingPerson('uid-ghost', input).accountId, 'uid-ghost', 'a ghost with no email')
  const catalogue = resolveBookingPerson('OP-catalogue', input)
  assert.equal(catalogue.accountId, null)
  assert.equal(catalogue.operativeId, 'OP-catalogue', 'a catalogue row with no account still names someone')
  const stray = resolveBookingPerson('nobody', input)
  assert.deepEqual(stray, { accountId: null, operativeId: null, email: null }, 'only an id that names nothing is unresolved')
})

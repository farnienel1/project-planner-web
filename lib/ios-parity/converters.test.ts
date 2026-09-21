/**
 * iOS parity source: FirebaseBackend.swift bookingFromFirestoreDocument / saveBooking
 * Spec: docs/ios-parity/01-data-model.md
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBooking, serializeBooking, serializeManager, serializeOperative, serializeProject } from './converters.ts'
import { IosWriteValidationError } from './firestoreCodec.ts'
import { normalizeBookingStatus, normalizeEmploymentType } from './enums.ts'

test('parseBooking skips lowercase status that is not aliased? wait — aliases confirmed → Confirmed', () => {
  const result = parseBooking('ID', {
    operativeId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    projectId: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    date: new Date('2026-09-16T00:00:00Z'),
    timeSlot: 'FULL DAY',
    bookedBy: 'Farnie',
    status: 'confirmed',
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.value.status, 'Confirmed')
})

test('parseBooking accepts missing bookedBy and Full Day aliases', () => {
  const result = parseBooking('ID', {
    operativeId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    projectId: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    date: new Date('2026-09-16T00:00:00Z'),
    timeSlot: 'Full Day',
    status: 'Confirmed',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.timeSlot, 'FULL DAY')
    assert.equal(result.value.bookedBy, '')
  }
})

test('serializeOperative and serializeManager write iOS empty-string fields', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const op = serializeOperative({
    id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    firstName: 'Ada',
    lastName: 'Booked',
    email: 'ada@x.com',
    startDate: now,
    hourlyRate: 12,
    dayRate: 100,
    skills: [],
    qualifications: [],
    isActive: true,
    organizationId: 'org1',
    createdAt: now,
    updatedAt: now,
  })
  assert.equal(op.name, 'Ada Booked')
  assert.equal(op.phone, '')
  assert.equal(op.currencySymbol, '£')
  assert.equal(op.dayRate, 100)
  assert.equal(op.organizationId, 'org1')
  assert.deepEqual(op.qualificationCertificateURLs, {})
  assert.ok(op.qualificationExpiryDates && typeof op.qualificationExpiryDates === 'object')

  const mgr = serializeManager({
    id: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    firstName: 'Pat',
    lastName: 'Boss',
    email: 'pat@x.com',
    isActive: true,
    organizationId: 'org1',
    createdAt: now,
    updatedAt: now,
  })
  assert.equal(mgr.mobileNumber, '')
  assert.equal(mgr.department, '')
  assert.equal(mgr.notes, '')
})

test('parseBooking skips missing operativeId', () => {
  const result = parseBooking('ID', {
    projectId: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    date: new Date(),
    timeSlot: 'AM',
    bookedBy: 'X',
    status: 'Confirmed',
  })
  assert.equal(result.ok, false)
})

test('serializeBooking writes Title-Case status and rejects empty bookedBy', () => {
  assert.equal(normalizeBookingStatus('pending'), 'Tentative')
  const payload = serializeBooking({
    id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    operativeId: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    projectId: 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    date: new Date(),
    timeSlot: 'FULL DAY',
    bookedBy: 'Farnie',
    status: 'confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  assert.equal(payload.status, 'Confirmed')
  assert.equal(payload.timeSlot, 'FULL DAY')
  assert.throws(
    () =>
      serializeBooking({
        id: 'A',
        operativeId: 'B',
        projectId: 'C',
        date: new Date(),
        timeSlot: 'AM',
        bookedBy: '',
        status: 'Confirmed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    IosWriteValidationError
  )
})

test('employmentType writes self_employed and reads selfEmployed', () => {
  assert.equal(normalizeEmploymentType('selfEmployed'), 'self_employed')
  assert.equal(normalizeEmploymentType('paye'), 'paye')
})

test('serializeProject writes manager Custom and omits notes', () => {
  const payload = serializeProject({
    id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    organizationId: 'ORG',
    jobNumber: '100',
    siteName: 'Hall',
    addressLine1: '1 High St',
    townCity: 'London',
    postcode: 'SW1A 1AA',
    client: { id: 'C', name: 'Acme', createdAt: new Date(), updatedAt: new Date() },
    startDate: new Date(),
    endDate: new Date(),
    jobType: 'CAT A',
    isLive: true,
  })
  assert.equal(payload.manager, 'Custom')
  assert.equal('notes' in payload, false)
  assert.equal('id' in payload, false)
})

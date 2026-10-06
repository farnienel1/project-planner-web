import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  exclusiveRates,
  money,
  payForHours,
  payLineDisplay,
  readStoredRates,
  resolveHistoryPayRow,
} from './payBasis.ts'

test('hourly 15 minutes is 0.25 hours at £20', () => {
  const pay = payForHours({
    payBasis: 'hourly',
    hourlyRate: 20,
    paidHours: 0.25,
    standardDayHours: 8,
  })
  const line = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 0.25,
    standardDayHours: 8,
    rate: 20,
    pay,
  })
  assert.equal(pay, 5)
  assert.equal(line.rateType, 'Hourly')
  assert.equal(line.equation, '0.25 hours × £20.00/hr = £5.00')
  assert.equal(line.quantityText.includes('day'), false)
})

test('hourly three 8-hour days stay in hours', () => {
  const pay = payForHours({
    payBasis: 'hourly',
    hourlyRate: 20,
    paidHours: 24,
    standardDayHours: 8,
  })
  const line = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 24,
    standardDayHours: 8,
    rate: 20,
    pay,
  })
  assert.equal(pay, 480)
  assert.equal(line.equation, '24.00 hours × £20.00/hr = £480.00')
  assert.equal(line.quantityText.includes('day'), false)
})

test('hourly £18 for 7.25 hours is £130.50', () => {
  const pay = payForHours({
    payBasis: 'hourly',
    hourlyRate: 18,
    paidHours: 7.25,
    standardDayHours: 8,
  })
  assert.equal(pay, 130.5)
  assert.equal(money(pay), '£130.50')
})

test('day rate uses the organisation day length, including 7.5', () => {
  const eight = payLineDisplay({
    payBasis: 'day',
    paidHours: 8,
    standardDayHours: 8,
    rate: 200,
    pay: payForHours({ payBasis: 'day', dayRate: 200, paidHours: 8, standardDayHours: 8 }),
  })
  assert.equal(eight.equation, '1.00 day × £200.00/day = £200.00')

  const seven = payLineDisplay({
    payBasis: 'day',
    paidHours: 7.5,
    standardDayHours: 7.5,
    rate: 150,
    pay: payForHours({ payBasis: 'day', dayRate: 150, paidHours: 7.5, standardDayHours: 7.5 }),
  })
  assert.equal(seven.equation, '1.00 day × £150.00/day = £150.00')

  const hourlySameDay = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 7.5,
    standardDayHours: 7.5,
    rate: 20,
    pay: payForHours({ payBasis: 'hourly', hourlyRate: 20, paidHours: 7.5, standardDayHours: 7.5 }),
  })
  assert.equal(hourlySameDay.equation, '7.50 hours × £20.00/hr = £150.00')
})

test('mixed organisation total is hourly £130.50 plus day £200', () => {
  const hourly = payForHours({ payBasis: 'hourly', hourlyRate: 18, paidHours: 7.25, standardDayHours: 8 })
  const day = payForHours({ payBasis: 'day', dayRate: 200, paidHours: 8, standardDayHours: 8 })
  assert.equal(Math.round((hourly + day) * 100) / 100, 330.5)
})

test('overtime labels keep the basis', () => {
  const hourly = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 2,
    standardDayHours: 8,
    rate: 30,
    pay: 60,
    isOvertime: true,
    otMultiplier: 1.5,
  })
  assert.equal(hourly.rateType, 'Hourly OT x1.5')
  const day = payLineDisplay({
    payBasis: 'day',
    paidHours: 4,
    standardDayHours: 8,
    rate: 300,
    pay: 150,
    isOvertime: true,
    otMultiplier: 1.5,
  })
  assert.equal(day.rateType, 'Day OT x1.5')
})

test('history keeps Monday on the day rate after Tuesday switches to hourly', () => {
  const rows = [
    {
      dayRate: 200,
      payBasis: 'day',
      effectiveAt: new Date('2026-10-05T00:00:00Z'),
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      dayRate: 25,
      payBasis: 'hourly',
      effectiveAt: new Date('2026-10-06T00:00:00Z'),
      createdAt: new Date('2026-10-06T09:00:00Z'),
    },
  ]
  const dayOf = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const monday = resolveHistoryPayRow(rows, new Date('2026-10-05T12:00:00Z'), 'hourly', dayOf)
  const tuesday = resolveHistoryPayRow(rows, new Date('2026-10-06T12:00:00Z'), 'hourly', dayOf)
  assert.equal(monday?.payBasis, 'day')
  assert.equal(monday?.dayRate, 200)
  const mondayPay = payForHours({
    payBasis: 'day',
    dayRate: monday?.dayRate,
    paidHours: 8,
    standardDayHours: 8,
  })
  const mondayLine = payLineDisplay({
    payBasis: 'day',
    paidHours: 8,
    standardDayHours: 8,
    rate: 200,
    pay: mondayPay,
  })
  assert.equal(mondayLine.equation, '1.00 day × £200.00/day = £200.00')
  const tuesdayPay = payForHours({
    payBasis: 'hourly',
    hourlyRate: tuesday?.dayRate,
    paidHours: 7.25,
    standardDayHours: 8,
  })
  const tuesdayLine = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 7.25,
    standardDayHours: 8,
    rate: 25,
    pay: tuesdayPay,
  })
  assert.equal(tuesdayLine.equation, '7.25 hours × £25.00/hr = £181.25')
})

test('a day-rate row later the same day does not cancel an hourly row', () => {
  const rows = [
    {
      dayRate: 25,
      payBasis: 'hourly',
      effectiveAt: new Date('2026-10-06T08:00:00Z'),
      createdAt: new Date('2026-10-06T08:00:00Z'),
    },
    {
      dayRate: 200,
      payBasis: 'day',
      effectiveAt: new Date('2026-10-06T18:00:00Z'),
      createdAt: new Date('2026-10-06T18:00:00Z'),
    },
  ]
  const dayOf = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const row = resolveHistoryPayRow(rows, new Date('2026-10-06T20:00:00Z'), 'hourly', dayOf)
  assert.equal(row?.payBasis, 'hourly')
  assert.equal(row?.dayRate, 25)
})

test('legacy zero pair without a basis is unset, and both positive amounts are a day rate', () => {
  assert.deepEqual(readStoredRates({ dayRate: 0, hourlyRate: 0 }), {
    payBasis: null,
    dayRate: null,
    hourlyRate: null,
  })
  assert.deepEqual(readStoredRates({ dayRate: 200, hourlyRate: 200 }), {
    payBasis: 'day',
    dayRate: 200,
    hourlyRate: null,
  })
  assert.deepEqual(exclusiveRates({ dayRate: 0, hourlyRate: null, payBasis: 'day' }), {
    payBasis: 'day',
    dayRate: 0,
    hourlyRate: null,
  })
  assert.deepEqual(readStoredRates({ payBasis: 'hourly', hourlyRate: 0 }), {
    payBasis: 'hourly',
    dayRate: null,
    hourlyRate: 0,
  })
})

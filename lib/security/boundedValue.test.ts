import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPlausibleDayKey,
  parseBoundedInteger,
  parseBoundedLatitude,
  parseBoundedLongitude,
  parseBoundedNumber,
} from './boundedValue.ts'

test('parseBoundedNumber keeps ordinary rates and rejects garbage', () => {
  assert.equal(parseBoundedNumber('18.50', { min: 0, max: 1_000_000 }), 18.5)
  assert.equal(parseBoundedNumber(250, { min: 0, max: 1_000_000 }), 250)
  assert.equal(parseBoundedNumber('1,5', { min: 0, max: 100 }), 1.5)
  assert.equal(parseBoundedNumber('', { min: 0, max: 10 }), null)
  assert.equal(parseBoundedNumber('abc', { min: 0, max: 10 }), null)
  assert.equal(parseBoundedNumber(Number.POSITIVE_INFINITY, { min: 0, max: 10 }), null)
  assert.equal(parseBoundedNumber(-1, { min: 0, max: 10 }), null)
  assert.equal(parseBoundedNumber(11, { min: 0, max: 10 }), null)
  assert.equal(parseBoundedNumber('1e20', { min: 0, max: 10_000_000 }), null)
})

test('parseBoundedInteger truncates inside the range', () => {
  assert.equal(parseBoundedInteger('8.9', { min: 1, max: 12 }), 8)
  assert.equal(parseBoundedInteger(0, { min: 1, max: 12 }), null)
})

test('isPlausibleDayKey accepts real calendar days only', () => {
  assert.equal(isPlausibleDayKey('2026-10-16'), true)
  assert.equal(isPlausibleDayKey('2026-02-29'), false)
  assert.equal(isPlausibleDayKey('1969-12-31'), false)
  assert.equal(isPlausibleDayKey('2101-01-01'), false)
  assert.equal(isPlausibleDayKey('not-a-date'), false)
  assert.equal(isPlausibleDayKey(''), false)
})

test('lat/lng stay on earth', () => {
  assert.equal(parseBoundedLatitude('51.5'), 51.5)
  assert.equal(parseBoundedLatitude('91'), null)
  assert.equal(parseBoundedLongitude('-0.1'), -0.1)
  assert.equal(parseBoundedLongitude('181'), null)
})

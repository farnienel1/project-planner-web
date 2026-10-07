import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduleBookingClientLine } from './siteAddress.ts'

test('schedule booking card joins the client and site without a dangling separator', () => {
  assert.equal(
    scheduleBookingClientLine({
      client: { name: 'Scott Osborn' },
      addressLine1: '51 Broadwick Street',
      townCity: 'London',
      postcode: 'W1F 9QJ',
    }),
    'Scott Osborn · 51 Broadwick Street, London, W1F 9QJ'
  )
  assert.equal(
    scheduleBookingClientLine({
      client: { name: 'Scott Osborn' },
      usesMapPinForLocation: true,
      latitude: 51.51278,
      longitude: -0.13805,
    }),
    'Scott Osborn · 51.51278, -0.13805'
  )
  assert.equal(scheduleBookingClientLine({ client: { name: 'Scott Osborn' } }), 'Scott Osborn')
})

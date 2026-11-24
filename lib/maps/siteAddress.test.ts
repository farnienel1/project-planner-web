import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectLocalityText, scheduleBookingClientLine } from './siteAddress.ts'

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

test('Book labour locality shows a stored UK postcode as "SW1X 9HR"', () => {
  assert.equal(projectLocalityText({ townCity: 'London', postcode: 'Sw1× 9Hr' }), 'London SW1X 9HR')
  assert.equal(projectLocalityText({ townCity: ' ', postcode: 'ec4m7ju' }), 'EC4M 7JU')
  assert.equal(projectLocalityText({ siteAddress: '1 High St, sw1x9hr' }), '1 High St, SW1X 9HR')
  assert.equal(projectLocalityText({}), ' ')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appleMapsUrlForProject,
  googleMapsUrlForProject,
  hasValidSiteLocation,
  locationDisplayText,
  materialStatusLabel,
  materialSendRequestType,
} from '../maps/siteLocation.ts'

test('hasValidSiteLocation accepts address or coordinates', () => {
  assert.equal(hasValidSiteLocation({ siteAddress: 'Site Location not available' }), false)
  assert.equal(hasValidSiteLocation({ addressLine1: '1 High St', townCity: 'London', postcode: 'E1 1AA' }), true)
  assert.equal(hasValidSiteLocation({ latitude: 51.5, longitude: -0.1 }), true)
  assert.equal(hasValidSiteLocation({}), false)
})

test('locationDisplayText prefers address then 5dp coords', () => {
  assert.equal(
    locationDisplayText({ addressLine1: '1 High St', townCity: 'London' }),
    '1 High St, London'
  )
  assert.equal(locationDisplayText({ latitude: 51.507351, longitude: -0.127758 }), '51.50735, -0.12776')
})

test('maps URLs match iOS web fallbacks', () => {
  assert.equal(
    googleMapsUrlForProject({ latitude: 51.5, longitude: -0.12 }),
    'https://www.google.com/maps/search/?api=1&query=51.5,-0.12'
  )
  assert.ok(appleMapsUrlForProject({ latitude: 51.5, longitude: -0.12, siteName: 'Yard' })?.includes('maps.apple.com'))
})

test('address mode ignores a leftover pin so the map follows the typed location', () => {
  const project = {
    addressLine1: '10 New St',
    townCity: 'Leeds',
    postcode: 'LS1 1AA',
    latitude: 51.5,
    longitude: -0.12,
    usesMapPinForLocation: false as const,
  }
  assert.equal(locationDisplayText(project), '10 New St, Leeds, LS1 1AA')
  const google = googleMapsUrlForProject(project)
  assert.ok(google)
  assert.equal(google.includes('51.5'), false)
  assert.ok(google.includes('10%20New%20St') || google.includes(encodeURIComponent('10 New St')))
})

test('material status labels and send request types match iOS raw values', () => {
  assert.equal(materialStatusLabel('draft'), 'Draft')
  assert.equal(materialStatusLabel('sentForQuote'), 'Sent for quote')
  assert.equal(materialStatusLabel('ordered'), 'Ordered')
  assert.equal(materialSendRequestType('quote'), 'Quote')
  assert.equal(materialSendRequestType('order'), 'Order')
})

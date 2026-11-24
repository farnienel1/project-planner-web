import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractUkPostcode,
  formatPostcodeForDisplay,
  formatPostcodeForSave,
  formatUkPostcode,
  isUkPostcode,
  normalizeUkPostcode,
  postcodeInputValue,
  postcodeLookalikesToX,
  tidyUkPostcodesInText,
} from './ukPostcode.ts'
import { formatSiteAddress } from './siteAddress.ts'
import { siteMapPostcode } from './siteMapPlacement.ts'
import { buildGeocodeCandidates } from './geocodingCandidates.ts'

// Owner bug 24 Nov: a stored postcode "Sw1× 9Hr" (a multiplication sign for the letter x).
const STORED = 'Sw1× 9Hr'

test('x look-alikes read as the letter x', () => {
  assert.equal(postcodeLookalikesToX(STORED), 'Sw1x 9Hr')
  assert.equal(postcodeLookalikesToX('sw1✕ 9hr'), 'sw1x 9hr')
  assert.equal(postcodeLookalikesToX('SW1Х 9HR'), 'SW1X 9HR')
  assert.equal(postcodeLookalikesToX('2 × 4h'), '2 x 4h')
})

test('a stored "Sw1× 9Hr" displays as SW1X 9HR', () => {
  assert.equal(formatPostcodeForDisplay(STORED), 'SW1X 9HR')
  assert.equal(formatPostcodeForDisplay(' sw1x9hr '), 'SW1X 9HR')
  assert.equal(formatPostcodeForDisplay('ec4m  7ju'), 'EC4M 7JU')
  assert.equal(formatPostcodeForDisplay('W1F 9QJ'), 'W1F 9QJ')
  assert.equal(formatPostcodeForDisplay(''), '')
  assert.equal(formatPostcodeForDisplay(undefined), '')
})

test('a non-UK postcode is shown as stored (trimmed), never forced into UK form', () => {
  assert.equal(formatPostcodeForDisplay(' D02 X285 '), 'D02 X285')
  assert.equal(formatPostcodeForDisplay('10001'), '10001')
  assert.equal(isUkPostcode('D02 X285'), false)
})

test('lookups find the postcode under a look-alike', () => {
  assert.equal(extractUkPostcode(`6 Lowndes Square, London, ${STORED}`), 'SW1X 9HR')
  assert.equal(normalizeUkPostcode(STORED), 'SW1X 9HR')
  assert.equal(formatUkPostcode('sw1×9hr'), 'SW1X 9HR')
  assert.equal(siteMapPostcode({ postcode: STORED }), 'SW1X 9HR')
  assert.ok(buildGeocodeCandidates({ postcode: STORED, townCity: 'London' }).includes('SW1X 9HR'))
})

test('the site address shows the tidied postcode, from the fields and from a stored siteAddress', () => {
  const job = { addressLine1: '6 Lowndes Square', townCity: 'London', postcode: STORED }
  assert.equal(formatSiteAddress(job), '6 Lowndes Square, London, SW1X 9HR')
  assert.equal(formatSiteAddress({ siteAddress: `6 Lowndes Square, London, ${STORED}` }), '6 Lowndes Square, London, SW1X 9HR')
  assert.equal(tidyUkPostcodesInText('Unit 2 × 3, Leeds LS1 4AP'), 'Unit 2 × 3, Leeds LS1 4AP')
  assert.equal(tidyUkPostcodesInText('Flat 2, sw1x9hr'), 'Flat 2, SW1X 9HR')
})

test('typing: look-alikes become x and letters upper case; a save writes the display form', () => {
  assert.equal(postcodeInputValue('sw1× 9'), 'SW1X 9')
  assert.equal(formatPostcodeForSave(STORED), 'SW1X 9HR')
  assert.equal(formatPostcodeForSave('  '), '')
})

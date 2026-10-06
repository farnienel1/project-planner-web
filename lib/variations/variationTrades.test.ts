import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergedVariationTradeOptions, VARIATION_TRADES } from './variationModel.ts'

test('variation trades keep the iOS standard order and sort custom names', () => {
  const options = mergedVariationTradeOptions(['Welder', '  zulu fitter  ', 'Alpha mate', 'Electrician', ''])
  assert.equal(options[0], 'Electrician')
  assert.equal(options[VARIATION_TRADES.length - 1], 'Labourer')
  assert.deepEqual(options.slice(VARIATION_TRADES.length), ['Alpha mate', 'zulu fitter'])
})

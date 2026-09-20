import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MULTIPLE_WHOLESALER_ORDER_MESSAGE,
  buildRecipientSnapshots,
  orderBlockedForMultipleWholesalers,
  parseOneOffRecipient,
  partitionMaterialsForResend,
  quantityLabel,
  resendHeadline,
  supplierGreeting,
} from './sendListLogic.ts'

const wholesalers = [
  {
    id: 'w1',
    name: 'CEF',
    contacts: [
      { id: 'c1', name: 'Alex Smith', email: 'alex@cef.example' },
      { id: 'c2', name: 'Pat Jones', email: 'pat@cef.example' },
    ],
  },
  {
    id: 'w2',
    name: 'City Electrical',
    contacts: [{ id: 'c3', name: 'Sam Lee', email: 'sam@city.example' }],
  },
]

test('quantityLabel matches iOS MaterialUnit labels', () => {
  assert.equal(quantityLabel('Number', 1), 'Number')
  assert.equal(quantityLabel('Number', 2), 'Numbers')
  assert.equal(quantityLabel('Box', 1), 'Box')
  assert.equal(quantityLabel('box', 4), 'Boxes')
  assert.equal(quantityLabel('m', 3), 'm')
})

test('orders cannot go to contacts at two wholesalers', () => {
  assert.equal(orderBlockedForMultipleWholesalers('order', wholesalers, ['c1', 'c3']), true)
  assert.equal(orderBlockedForMultipleWholesalers('order', wholesalers, ['c1', 'c2']), false)
  assert.equal(orderBlockedForMultipleWholesalers('quote', wholesalers, ['c1', 'c3']), false)
  assert.equal(MULTIPLE_WHOLESALER_ORDER_MESSAGE, 'Orders can only go to one wholesaler at a time.')
})

test('resend dialog only for previously quoted/ordered lines', () => {
  const lines = [
    { id: 'a', status: 'draft' },
    { id: 'b', status: 'sentForQuote' },
    { id: 'c', status: 'ordered' },
  ]
  const quote = partitionMaterialsForResend(lines, 'quote')
  assert.equal(quote.needsDialog, true)
  assert.deepEqual(quote.alreadyQuoted.map((row) => row.id), ['b'])
  const freshQuote = partitionMaterialsForResend([{ id: 'a', status: 'draft' }], 'quote')
  assert.equal(freshQuote.needsDialog, false)
  const order = partitionMaterialsForResend(lines, 'order')
  assert.equal(order.needsDialog, true)
  assert.equal(resendHeadline(1, 1), 'Some items have been quoted and some have been ordered')
})

test('one-off recipient requires name and an email with @', () => {
  assert.equal(parseOneOffRecipient('', 'pat@example.com'), null)
  assert.equal(parseOneOffRecipient('Pat', 'not-an-email'), null)
  assert.deepEqual(parseOneOffRecipient('  Pat  ', ' pat@example.com '), {
    id: 'oneoff-pat@example.com',
    name: 'Pat',
    email: 'pat@example.com',
  })
})

test('recipient snapshots keep wholesaler name and one-off emails', () => {
  const rows = buildRecipientSnapshots(wholesalers, ['c1'], [
    { id: 'oneoff-custom@example.com', name: 'Custom', email: 'custom@example.com' },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].wholesalerName, 'CEF')
  assert.equal(rows[1].name, 'Custom')
  assert.equal(rows[1].wholesalerName, undefined)
})

test('plain-text greeting uses the full contact name', () => {
  assert.equal(supplierGreeting('Alex Smith', true), 'Alex Smith')
  assert.equal(supplierGreeting('Alex Smith', false), 'Alex')
  assert.equal(supplierGreeting('  ', false), 'there')
})

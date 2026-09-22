import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMaterialWhatsAppMessage, formatWhatsAppOrderItems, WHATSAPP_ITEM_LIMIT } from './whatsappOrder.ts'

const base = {
  organisationName: "Smith & Sons",
  requestingUserName: 'Farnie Nel',
  contactName: "John O'Brien",
  supplierName: 'M&E Supplies Ltd.',
  jobNumber: 'PP-10452',
  projectName: 'Alpha House',
  projectAddress: '12 King Street, London',
  deliveryDate: new Date('2026-09-22T09:00:00'),
  materials: [
    { material: '2.5mm Twin & Earth Cable', quantity: 10, unit: 'Number' },
    { material: '20A RCBO', quantity: 5, unit: 'Number', brand: 'Schneider', productCode: 'A9F' },
  ],
} as const

test('order message uses material-order wording and live line items', () => {
  const message = buildMaterialWhatsAppMessage({ ...base, requestType: 'order' })
  assert.match(message, /Hi John O'Brien/)
  assert.match(message, /material order from Smith & Sons/)
  assert.match(message, /MATERIAL ORDER/)
  assert.match(message, /Job: PP-10452/)
  assert.match(message, /Project: Alpha House/)
  assert.match(message, /• 10 × 2\.5mm Twin & Earth Cable/)
  assert.match(message, /• 5 × 20A RCBO — Schneider · Code A9F/)
  assert.doesNotMatch(message, /undefined|null|\{/)
  assert.doesNotMatch(message, /View the full order/)
})

test('missing delivery date is To be confirmed and quote copy stays a request', () => {
  const message = buildMaterialWhatsAppMessage({
    ...base,
    requestType: 'quote',
    deliveryDate: null,
    projectAddress: '',
  })
  assert.match(message, /QUOTE REQUEST/)
  assert.match(message, /Required delivery: To be confirmed/)
  assert.match(message, /only a quote request/)
  assert.doesNotMatch(message, /Project address/)
})

test('long lists truncate after the readable item cap', () => {
  const materials = Array.from({ length: WHATSAPP_ITEM_LIMIT + 4 }, (_, index) => ({
    material: `Item ${index + 1}`,
    quantity: 1,
    unit: 'Number',
  }))
  const text = formatWhatsAppOrderItems(materials)
  assert.match(text, /and 4 more items/)
  assert.equal(text.split('\n').filter((line) => line.startsWith('• Item') || line.startsWith('• 1 ×')).length, WHATSAPP_ITEM_LIMIT)
})

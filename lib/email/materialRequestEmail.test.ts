import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMaterialRequestEmail,
  buildPlainTextEmail,
  orderSubject,
  quoteSubject,
} from './materialRequestEmail.ts'

const context = {
  supplierName: 'Alex Smith',
  userName: 'Farnie',
  userEmail: 'farnie@example.com',
  userPhone: '07700 900123',
  userCompany: 'Acme Electrical',
  jobNumber: 'P-104',
  siteName: 'City Hall',
  deliveryAddress: '1 High Street, London',
  materials: [
    {
      material: '2.5mm T&E',
      quantity: 2,
      unit: 'Drum',
      brand: 'Prysmian',
      productCode: 'TE25',
      notes: 'Blue sheath',
    },
  ],
  sentAt: new Date('2026-09-20T10:00:00'),
}

test('quote and order subjects match iOS wording', () => {
  assert.equal(quoteSubject('P-104', 'Acme Electrical'), 'Quote request — P-104 — Acme Electrical')
  assert.equal(
    orderSubject('P-104', 'Acme Electrical'),
    'Material order request — P-104 — Acme Electrical'
  )
})

test('plain-text quote includes site, custom notes, and greeting name', () => {
  const body = buildPlainTextEmail({ ...context, supplierName: 'Alex Smith' }, true)
  assert.match(body, /Hi Alex Smith,/)
  assert.match(body, /Can I get a quote for the items below\?/)
  assert.match(body, /Site: City Hall/)
  assert.match(body, /Site address: 1 High Street, London/)
  assert.match(body, /2\.5mm T&E — qty 2 Drums/)
  assert.match(body, /Brand: Prysmian; Code: TE25; Details: Blue sheath/)
  assert.match(body, /this is only a quote request/)
  assert.match(body, /My number is 07700 900123/)
})

test('HTML email greets the first name and lists manufacturer', () => {
  const { html, subject } = buildMaterialRequestEmail({
    context,
    isQuote: true,
    sendAsPlainText: false,
    contactName: 'Alex Smith',
  })
  assert.equal(subject, 'Quote request — P-104 — Acme Electrical')
  assert.match(html, /Hi Alex,/)
  assert.match(html, /Manufacturer: <span[^>]*>Prysmian/)
  assert.match(html, /Part: <span[^>]*>TE25/)
  assert.match(html, /Blue sheath/)
  assert.match(html, /2 Drums/)
})

test('plain-text option wraps the list in a pre block', () => {
  const { html } = buildMaterialRequestEmail({
    context,
    isQuote: false,
    sendAsPlainText: true,
    contactName: 'Alex Smith',
  })
  assert.match(html, /<pre /)
  assert.match(html, /Hi Alex Smith,/)
  assert.match(html, /Please can I place an order/)
  assert.doesNotMatch(html, /Manufacturer:/)
})

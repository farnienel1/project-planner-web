import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  billingPurchaseEmailSubject,
  billingTermsParagraphHtml,
  buildBillingPurchaseEmailHtml,
  buildTrialWillEndEmailHtml,
} from './billingPurchaseEmail.ts'

test('purchase email repeats price, VAT, auto-renew and Settings → Billing', () => {
  const html = buildBillingPurchaseEmailHtml({
    to: 'ada@acme.test',
    firstName: '<script>alert(1)</script>',
    organizationName: 'Acme & Co',
    interval: 'month',
  })
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true)
  assert.equal(html.includes('Acme &amp; Co'), true)
  assert.equal(html.includes('£149 a month or £1,490 a year'), true)
  assert.equal(html.includes('VAT is not charged'), true)
  assert.equal(html.includes('renews automatically'), true)
  assert.equal(html.includes('Settings → Billing'), true)
  assert.equal(html.includes('You chose £149 a month'), true)
  assert.equal(html.includes('Confirm my account'), false)
  assert.equal(html.includes('/confirm-account'), false)
})

test('purchase subject cannot carry injected headers', () => {
  assert.equal(billingPurchaseEmailSubject('Acme\r\nBcc: x@y.com').includes('\n'), false)
})

test('billing terms paragraph keeps both published prices', () => {
  const html = billingTermsParagraphHtml('year')
  assert.equal(html.includes('£1,490 a year'), true)
  assert.equal(html.includes('£149 a month or £1,490 a year'), true)
})

test('trial-will-end email names the amount, VAT, auto-renew and cancel path', () => {
  const html = buildTrialWillEndEmailHtml('19/10/2026', 'year')
  assert.equal(html.includes('19/10/2026'), true)
  assert.equal(html.includes('£1,490 a year'), true)
  assert.equal(html.includes('VAT is not charged'), true)
  assert.equal(html.includes('renews automatically'), true)
  assert.equal(html.includes('Settings → Billing'), true)
})

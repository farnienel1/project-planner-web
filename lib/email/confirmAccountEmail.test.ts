import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConfirmAccountEmailHtml,
  confirmAccountEmailSubject,
} from './confirmAccountEmail.ts'

test('confirm-account email HTML escapes names and org titles', () => {
  const html = buildConfirmAccountEmailHtml({
    to: 'user@example.com',
    firstName: '<script>alert(1)</script>',
    organizationName: 'Acme & Co',
    confirmationToken: '550e8400-e29b-41d4-a716-446655440000',
  })
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true)
  assert.equal(html.includes('Acme &amp; Co'), true)
  assert.equal(html.includes('/confirm-account?token='), true)
  assert.equal(html.includes('Confirm my account'), true)
})

test('confirm-account subject cannot carry injected headers', () => {
  assert.equal(confirmAccountEmailSubject('Acme\r\nBcc: x@y.com').includes('\n'), false)
})

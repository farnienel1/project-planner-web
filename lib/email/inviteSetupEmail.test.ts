import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInviteSetupEmailHtml, inviteSetupEmailSubject } from './inviteSetupEmail.ts'
import { buildOrgAdditionEmailHtml, orgAdditionEmailSubject } from './orgAdditionEmail.ts'

test('invite email HTML escapes names and org titles', () => {
  const html = buildInviteSetupEmailHtml({
    to: 'user@example.com',
    firstName: '<script>alert(1)</script>',
    organizationName: 'Acme & Co',
    invitationId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'manager',
  })
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true)
  assert.equal(html.includes('Acme &amp; Co'), true)
})

test('email subjects cannot carry injected headers', () => {
  assert.equal(inviteSetupEmailSubject('Acme\r\nBcc: x@y.com').includes('\n'), false)
  assert.equal(orgAdditionEmailSubject('Acme\r\nBcc: x@y.com').includes('\r'), false)
})

test('org addition email HTML escapes untrusted text', () => {
  const html = buildOrgAdditionEmailHtml({
    to: 'user@example.com',
    firstName: 'Jo<img src=x>',
    organizationName: 'Org "quoted"',
  })
  assert.equal(html.includes('<img'), false)
  assert.equal(html.includes('&lt;img src=x&gt;'), true)
  assert.equal(html.includes('&quot;quoted&quot;'), true)
})

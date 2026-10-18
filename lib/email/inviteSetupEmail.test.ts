import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInviteSetupEmailHtml,
  buildInviteSetupEmailText,
  inviteSetupEmailSubject,
  inviteSetupPasswordUrl,
} from './inviteSetupEmail.ts'
import { resolveInviteSetupIdentity } from './inviteSetupEmailFields.ts'
import { buildOrgAdditionEmailHtml, orgAdditionEmailSubject } from './orgAdditionEmail.ts'

const invite = {
  to: 'morgan@acme.test',
  firstName: 'Morgan',
  organizationName: 'Acme Construction Ltd',
  invitationId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'manager' as const,
}

test('invite identity prefers invitation first name and organization document name', () => {
  const identity = resolveInviteSetupIdentity({
    invitationFirstName: 'Morgan',
    fallbackFirstName: 'Wrong',
    organization: { name: 'Acme Construction Ltd' },
    fallbackOrganizationName: 'Wrong Co',
  })
  assert.deepEqual(identity, {
    firstName: 'Morgan',
    organizationName: 'Acme Construction Ltd',
  })
  assert.equal(
    resolveInviteSetupIdentity({
      invitationFirstName: '',
      fallbackFirstName: '',
      organization: { name: '  ' },
      fallbackOrganizationName: '',
    }),
    null
  )
})

test('invite email HTML fills pack tokens from the supplied name, org, and setup URL', () => {
  const setupUrl = inviteSetupPasswordUrl(invite.invitationId)
  const html = buildInviteSetupEmailHtml(invite)

  assert.equal(html.includes('Welcome aboard, Morgan.'), true)
  assert.equal(html.includes('Acme Construction Ltd has invited you'), true)
  assert.equal(html.includes(`href="${setupUrl}"`), true)
  assert.equal(html.includes(setupUrl), true)
  assert.equal(html.includes('This email was sent to morgan@acme.test'), true)
  assert.equal(html.includes('{{FirstName}}'), false)
  assert.equal(html.includes('{{CompanyName}}'), false)
  assert.equal(html.includes('{{SetupLink}}'), false)
  assert.equal(html.includes('{{RecipientEmail}}'), false)
  assert.equal(html.includes('https://www.projectplanner.us/email-assets/pp-email-logo.png'), true)
  assert.equal(html.includes('Set up your password'), true)
})

test('invite email plaintext fills the same pack tokens', () => {
  const setupUrl = inviteSetupPasswordUrl(invite.invitationId)
  const text = buildInviteSetupEmailText(invite)

  assert.equal(text.includes('Welcome aboard, Morgan.'), true)
  assert.equal(text.includes('Acme Construction Ltd has invited you'), true)
  assert.equal(text.includes(`Set up your password:\n${setupUrl}`), true)
  assert.equal(text.includes('This email was sent to morgan@acme.test'), true)
  assert.equal(text.includes('{{'), false)
})

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

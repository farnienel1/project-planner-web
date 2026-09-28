import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loginEmailFixMessage } from './loginEmailFix.ts'

test('login email fix email names the organisation, person, both emails and the note', () => {
  const message = loginEmailFixMessage({
    organizationName: 'North Site Ltd',
    organizationId: 'ORG-1',
    userName: 'Sam Taylor',
    userId: 'USER-1',
    oldEmail: 'old@site.co.uk',
    newEmail: 'new@site.co.uk',
    note: 'Typed the wrong address',
  })
  assert.equal(message.subject, 'Login email change — North Site Ltd')
  assert.match(message.html, /North Site Ltd \(ORG-1\)/)
  assert.match(message.html, /Sam Taylor \(USER-1\)/)
  assert.match(message.html, /old@site\.co\.uk/)
  assert.match(message.html, /new@site\.co\.uk/)
  assert.match(message.html, /Typed the wrong address/)
})

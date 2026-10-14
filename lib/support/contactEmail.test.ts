import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supportContactMessage } from './contactEmail.ts'

test('support HTML escapes the name and message', () => {
  const message = supportContactMessage({
    name: '<script>Ada</script>',
    email: 'ada@example.com',
    topic: 'Technical support',
    message: 'Hello <b>there</b>',
    website: '',
  })
  assert.match(message.subject, /Technical support/)
  assert.doesNotMatch(message.html, /<script>/)
  assert.match(message.html, /&lt;script&gt;Ada&lt;\/script&gt;/)
  assert.match(message.html, /Hello &lt;b&gt;there&lt;\/b&gt;/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, sanitizeEmailHeader } from './htmlEscape.ts'

test('escapeHtml encodes markup characters', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('xss')"> & "quotes"`),
    '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &quot;quotes&quot;'
  )
})

test('sanitizeEmailHeader strips CR/LF and trims length', () => {
  assert.equal(sanitizeEmailHeader('Acme\r\nBcc: attacker@example.com'), 'Acme Bcc: attacker@example.com')
  assert.equal(sanitizeEmailHeader('a'.repeat(250), 20).length, 20)
})

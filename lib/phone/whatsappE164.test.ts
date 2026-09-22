import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWhatsAppClickToChatUrl, toWhatsAppDigits } from './whatsappE164.ts'

test('UK national mobiles become 44… wa.me digits', () => {
  const result = toWhatsAppDigits('07700 900123', 'GB')
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.digits, '447700900123')
})

test('already-international UK numbers keep country code and drop punctuation', () => {
  const plus = toWhatsAppDigits('+44 7700 900123', 'GB')
  assert.equal(plus.ok, true)
  if (plus.ok) assert.equal(plus.digits, '447700900123')
  const zeros = toWhatsAppDigits('0044 7700 900123', 'IE')
  assert.equal(zeros.ok, true)
  if (zeros.ok) assert.equal(zeros.digits, '447700900123')
})

test('Irish national numbers use 353 from the organisation country', () => {
  const result = toWhatsAppDigits('087 123 4567', 'IE')
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.digits, '353871234567')
})

test('US numbers in +1 form stay international', () => {
  const result = toWhatsAppDigits('+1 (415) 555-2671', 'GB')
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.digits, '14155552671')
})

test('missing or landline UK numbers are rejected with a useful reason', () => {
  assert.equal(toWhatsAppDigits('', 'GB').ok, false)
  const landline = toWhatsAppDigits('020 7946 0958', 'GB')
  assert.equal(landline.ok, false)
  if (!landline.ok) assert.match(landline.reason, /landline/i)
})

test('wa.me URLs encode spaces, line breaks, currency and punctuation', () => {
  const message = "Hi O'Brien &\nTotal: £12.50 #1"
  const url = buildWhatsAppClickToChatUrl('447700900123', message)
  assert.equal(url.startsWith('https://wa.me/447700900123?text='), true)
  assert.equal(url.includes(' '), false)
  const encoded = url.slice('https://wa.me/447700900123?text='.length)
  assert.equal(decodeURIComponent(encoded), message)
})

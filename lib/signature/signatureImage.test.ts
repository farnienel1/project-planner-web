import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasSignatureInk, signaturePngSrc, stripPngDataUrl } from './signatureImage.ts'

test('stripPngDataUrl keeps raw iOS payloads and strips web data URLs', () => {
  assert.equal(stripPngDataUrl('abc123'), 'abc123')
  assert.equal(stripPngDataUrl('data:image/png;base64,abc123'), 'abc123')
})

test('signaturePngSrc prefixes raw PNG base64 for <img> and PDF', () => {
  assert.equal(signaturePngSrc(null), null)
  assert.equal(signaturePngSrc('  '), null)
  assert.equal(signaturePngSrc('iVBORw0KGgo'), 'data:image/png;base64,iVBORw0KGgo')
  assert.equal(signaturePngSrc('data:image/png;base64,iVBORw0KGgo'), 'data:image/png;base64,iVBORw0KGgo')
})

test('hasSignatureInk is true when typed-name or drawn PNG was saved', () => {
  assert.equal(hasSignatureInk(null), false)
  assert.equal(hasSignatureInk('iVBOR'), true)
})

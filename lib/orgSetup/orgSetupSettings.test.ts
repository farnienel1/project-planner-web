import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOGO_MAX_BYTES, validateLogoFile } from './orgSetupSettings.ts'

test('logo cap matches storage.rules 5MB image-or-PDF write', () => {
  assert.equal(LOGO_MAX_BYTES, 5 * 1024 * 1024)
  assert.equal(validateLogoFile({ name: 'mark.png', type: 'image/png', size: 1024 }), null)
  assert.equal(validateLogoFile({ name: 'mark.pdf', type: 'application/pdf', size: 1024 }), null)
  assert.equal(
    validateLogoFile({ name: 'mark.png', type: 'image/png', size: LOGO_MAX_BYTES }),
    null
  )
  assert.equal(
    validateLogoFile({ name: 'mark.png', type: 'image/png', size: LOGO_MAX_BYTES + 1 }),
    'Logo must be 5 MB or smaller.'
  )
  assert.equal(
    validateLogoFile({ name: 'notes.txt', type: 'text/plain', size: 1024 }),
    'Logo must be a JPEG, PNG or PDF file.'
  )
})

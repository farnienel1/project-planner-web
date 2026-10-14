import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appCheckTokenFromRequest,
  readAppCheckClaims,
  shouldRequireAppCheck,
  verifyAppCheckJwt,
} from './verifyAppCheckToken.ts'

test('App Check is required only in production', () => {
  assert.equal(shouldRequireAppCheck('production'), true)
  assert.equal(shouldRequireAppCheck('development'), false)
  assert.equal(shouldRequireAppCheck('test'), false)
})

test('App Check header is read from X-Firebase-AppCheck', () => {
  const request = new Request('https://example.test', {
    headers: { 'X-Firebase-AppCheck': '  token-1  ' },
  })
  assert.equal(appCheckTokenFromRequest(request), 'token-1')
})

test('malformed App Check tokens fail verification', async () => {
  assert.equal(await verifyAppCheckJwt('not-a-jwt', { projectNumber: '980527300983' }), false)
  assert.equal(readAppCheckClaims('abc.def'), null)
})

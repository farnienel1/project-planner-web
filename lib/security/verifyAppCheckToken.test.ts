import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import {
  appCheckTokenFromRequest,
  enforceAppCheck,
  enforceAppCheckOnAuthGate,
  readAppCheckClaims,
  shouldRequireAppCheck,
  shouldRequireAppCheckOnAuthGate,
  verifyAppCheckJwt,
} from './verifyAppCheckToken.ts'

test('App Check is required only in production', () => {
  assert.equal(shouldRequireAppCheck('production'), true)
  assert.equal(shouldRequireAppCheck('development'), false)
  assert.equal(shouldRequireAppCheck('test'), false)
})

test('auth password gates do not require App Check while enforcement is off', async () => {
  assert.equal(shouldRequireAppCheckOnAuthGate(), false)
  const request = new NextRequest('https://example.test/api/auth/public-gate', { method: 'POST' })
  assert.equal(await enforceAppCheckOnAuthGate(request, 'production'), null)
})

test('public forms still require App Check in production', async () => {
  const request = new NextRequest('https://example.test/api/interest/register', { method: 'POST' })
  const blocked = await enforceAppCheck(request, 'production')
  assert.ok(blocked)
  assert.equal(blocked!.status, 401)
  assert.deepEqual(await blocked!.json(), { error: 'App Check is required.' })
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

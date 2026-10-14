import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MFA_OK_COOKIE_HOST,
  MFA_OK_COOKIE_LEGACY,
  cookieOptions,
  mfaCookieNames,
  readMfaCookie,
  requestUsesHttps,
  shouldSecureMfaCookies,
  writeMfaCookie,
} from './mfaCookiePolicy.ts'

function request(input: { protocol?: string; proto?: string | null; cookie?: Record<string, string> }) {
  return {
    nextUrl: { protocol: input.protocol || 'http:' },
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-proto') return input.proto ?? null
        return null
      },
    },
    cookies: {
      get(name: string) {
        const value = input.cookie?.[name]
        return value ? { value } : undefined
      },
    },
  }
}

test('HTTPS and x-forwarded-proto force Secure and the __Host- names', () => {
  assert.equal(requestUsesHttps(request({ protocol: 'https:' })), true)
  assert.equal(requestUsesHttps(request({ protocol: 'http:', proto: 'https' })), true)
  assert.equal(requestUsesHttps(request({ protocol: 'http:', proto: 'http' })), false)
  assert.equal(shouldSecureMfaCookies(request({ protocol: 'https:' })), true)
  assert.equal(mfaCookieNames(true).ok, MFA_OK_COOKIE_HOST)
  assert.equal(mfaCookieNames(false).ok, MFA_OK_COOKIE_LEGACY)
  const opts = cookieOptions(12 * 60 * 60 * 1000, true)
  assert.equal(opts.httpOnly, true)
  assert.equal(opts.secure, true)
  assert.equal(opts.sameSite, 'lax')
  assert.equal(opts.path, '/')
  assert.equal(opts.maxAge, 12 * 60 * 60)
})

test('HTTPS reads only the __Host- cookie; a leftover pp_mfa_ok does not count', () => {
  const https = request({
    protocol: 'https:',
    cookie: { [MFA_OK_COOKIE_LEGACY]: 'stale', [MFA_OK_COOKIE_HOST]: 'host-ok' },
  })
  assert.equal(readMfaCookie(https, 'ok'), 'host-ok')
  const http = request({
    protocol: 'http:',
    cookie: { [MFA_OK_COOKIE_LEGACY]: 'dev-ok', [MFA_OK_COOKIE_HOST]: 'host-ok' },
  })
  if (shouldSecureMfaCookies(http)) return
  assert.equal(readMfaCookie(http, 'ok'), 'dev-ok')
})

test('HTTPS write uses __Host- and expires the old Secure pp_mfa_ok cookie', () => {
  const set: Array<{ name: string; value: string; secure: boolean; maxAge: number }> = []
  writeMfaCookie(
    {
      set(name, value, options) {
        set.push({ name, value, secure: options.secure, maxAge: options.maxAge })
      },
    },
    request({ protocol: 'https:' }),
    'ok',
    'signed',
    12 * 60 * 60 * 1000
  )
  assert.deepEqual(set[0], {
    name: MFA_OK_COOKIE_HOST,
    value: 'signed',
    secure: true,
    maxAge: 12 * 60 * 60,
  })
  assert.equal(set[1]?.name, MFA_OK_COOKIE_LEGACY)
  assert.equal(set[1]?.value, '')
  assert.equal(set[1]?.secure, true)
  assert.equal(set[1]?.maxAge, 0)
})

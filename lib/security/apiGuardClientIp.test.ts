import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { clientIp, looksLikeIpAddress } from './apiGuard.ts'

function req(headers: Record<string, string>) {
  return new NextRequest('https://example.test/api/x', { headers })
}

test('final check of #348: looksLikeIpAddress accepts IPv4 and IPv6 only', () => {
  for (const ok of ['198.18.0.7', '0.0.0.0', '2001:db8::1', '::1', '::', 'fe80::1:2:3:4', '::ffff:192.0.2.1', '1:2:3:4:5:6:7:8']) {
    assert.equal(looksLikeIpAddress(ok), true, ok)
  }
  for (const bad of ['', 'unknown', '256.1.1.1', '1.2.3', '1.2.3.4:80', '[::1]', '1::2::3', '1:2:3:4:5:6:7:8:9', 'abc', '198.18.0.7 x', 'g::1']) {
    assert.equal(looksLikeIpAddress(bad), false, bad)
  }
})

test('final check of #348: clientIp takes the last part of x-nf-client-connection-ip when it is an address', () => {
  assert.equal(clientIp(req({ 'x-nf-client-connection-ip': '203.0.113.9' })), '203.0.113.9')
  assert.equal(clientIp(req({ 'x-nf-client-connection-ip': '10.0.0.1, 203.0.113.9' })), '203.0.113.9')
  assert.equal(clientIp(req({ 'x-nf-client-connection-ip': ' 2001:db8::5 ' })), '2001:db8::5')
  assert.equal(
    clientIp(req({ 'x-nf-client-connection-ip': '203.0.113.9, junk', 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })),
    '198.51.100.2',
    'a last part that is not an address falls back'
  )
  assert.equal(clientIp(req({ 'x-nf-client-connection-ip': 'nope', 'x-real-ip': '198.51.100.3' })), '198.51.100.3')
  assert.equal(clientIp(req({})), 'unknown')
})

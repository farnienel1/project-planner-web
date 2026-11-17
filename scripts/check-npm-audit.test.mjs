import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateAudit, validateAllowlist } from './check-npm-audit.mjs'

const fixture = JSON.parse(readFileSync(new URL('./check-npm-audit.fixture.json', import.meta.url), 'utf8'))
const PICOMATCH = { id: 'GHSA-fc5q-39xc-vjpf', reason: 'dev-only', expires: '2026-12-17' }

test('without an allowlist every package reaching the high advisory blocks', () => {
  const result = evaluateAudit(fixture, [], '2026-11-17')
  assert.equal(result.ok, false)
  assert.deepEqual(
    result.blocking.map((row) => row.name).sort(),
    ['express-ish', 'fast-glob', 'loop-a', 'loop-b', 'micromatch', 'picomatch', 'tinyglobby'],
  )
  assert.equal(result.blocking.find((row) => row.name === 'qs'), undefined, 'a moderate advisory never blocks')
})

test('an allowlisted advisory clears the package and every package flagged only through it', () => {
  const result = evaluateAudit(fixture, [PICOMATCH], '2026-11-17')
  assert.equal(result.ok, true)
  assert.deepEqual(result.blocking, [])
  assert.deepEqual(result.allowed, ['ghsa-fc5q-39xc-vjpf'])
  assert.deepEqual(result.unused, [])
  assert.deepEqual(result.expired, [])
})

test('allowlist ids match without case; the entry counts on its expiry day', () => {
  const result = evaluateAudit(fixture, [{ ...PICOMATCH, id: 'ghsa-FC5Q-39XC-VJPF' }], '2026-12-17')
  assert.equal(result.ok, true)
})

test('an expired entry fails and no longer clears its advisory', () => {
  const result = evaluateAudit(fixture, [PICOMATCH], '2026-12-18')
  assert.equal(result.ok, false)
  assert.deepEqual(result.expired.map((row) => row.id), ['GHSA-fc5q-39xc-vjpf'])
  assert.ok(result.blocking.some((row) => row.name === 'micromatch'))
})

test('an entry that matches no advisory is reported as unused and does not fail on its own', () => {
  const stale = { id: 'GHSA-aaaa-bbbb-cccc', reason: 'old', expires: '2027-01-01' }
  const result = evaluateAudit(fixture, [PICOMATCH, stale], '2026-11-17')
  assert.equal(result.ok, true)
  assert.deepEqual(result.unused.map((row) => row.id), ['GHSA-aaaa-bbbb-cccc'])
})

test('a package with an allowlisted and a separate blocking advisory still blocks', () => {
  const audit = structuredClone(fixture)
  audit.vulnerabilities['other-bad'] = {
    name: 'other-bad',
    severity: 'critical',
    via: [{ source: 9, url: 'https://github.com/advisories/GHSA-zzzz-yyyy-xxxx', severity: 'critical' }],
  }
  audit.vulnerabilities['express-ish'].via.push('other-bad')
  const result = evaluateAudit(audit, [PICOMATCH], '2026-11-17')
  assert.equal(result.ok, false)
  assert.deepEqual(result.blocking.map((row) => row.name).sort(), ['express-ish', 'other-bad'])
  assert.deepEqual(result.blocking.find((row) => row.name === 'express-ish').advisories, ['GHSA-zzzz-yyyy-xxxx'])
})

test('an empty audit passes; an audit error is thrown', () => {
  assert.equal(evaluateAudit({ vulnerabilities: {} }, [], '2026-11-17').ok, true)
  assert.throws(() => evaluateAudit({ error: { summary: 'network' } }, [], '2026-11-17'), /npm audit failed/)
})

test('allowlist entries need an id, a reason and a YYYY-MM-DD expiry', () => {
  assert.throws(() => validateAllowlist({}))
  assert.throws(() => validateAllowlist([{ id: 'X', reason: '', expires: '2026-12-17' }]))
  assert.throws(() => validateAllowlist([{ id: 'X', reason: 'r', expires: '17/12/2026' }]))
  assert.doesNotThrow(() => validateAllowlist(JSON.parse(readFileSync(new URL('./npm-audit-allowlist.json', import.meta.url), 'utf8'))))
})

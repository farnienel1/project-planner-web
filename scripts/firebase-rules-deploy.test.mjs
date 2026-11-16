import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareRuleset, missingCiChecks, planTargets, readServiceAccountKey, REQUIRED_CI_CHECKS, TARGET_PLANS } from './firebase-rules-deploy.mjs'

test('every target maps to rules, storage rules or indexes only — never functions or hosting', () => {
  for (const plan of Object.values(TARGET_PLANS)) {
    for (const part of plan.only.split(',')) assert.ok(['firestore:rules', 'firestore:indexes', 'storage'].includes(part), part)
  }
  assert.equal(planTargets('all-rules').only, 'firestore:rules,firestore:indexes,storage')
  assert.deepEqual(planTargets('firestore-rules'), { only: 'firestore:rules', firestore: true, storage: false, indexes: false })
  assert.equal(planTargets('storage-rules').only, 'storage')
  assert.equal(planTargets('indexes').storage, false)
})

test('an unknown or padded target is refused', () => {
  for (const bad of ['functions', 'firestore', '', ' all-rules', 'all-rules;rm -rf /', undefined, 'constructor', '__proto__']) {
    assert.throws(() => planTargets(bad), /Unknown target/)
  }
})

const ruleset = (content, name = 'projects/p1/rulesets/abc') => ({ name, source: { files: [{ name: 'firestore.rules', content }] } })

test('the live ruleset must equal the local file byte for byte', () => {
  assert.equal(compareRuleset({ ruleset: ruleset('rules_version = "2";\n'), localContent: 'rules_version = "2";\n', projectId: 'p1' }).ok, true)
  assert.equal(compareRuleset({ ruleset: ruleset('rules_version = "2";\n'), localContent: 'rules_version = "2";', projectId: 'p1' }).ok, false)
})

test('a ruleset of another project, with no files or with two files never passes', () => {
  assert.equal(compareRuleset({ ruleset: ruleset('x', 'projects/other/rulesets/abc'), localContent: 'x', projectId: 'p1' }).ok, false)
  assert.equal(compareRuleset({ ruleset: { name: 'projects/p1/rulesets/a', source: { files: [] } }, localContent: '', projectId: 'p1' }).ok, false)
  assert.equal(compareRuleset({ ruleset: { name: 'projects/p1/rulesets/a' }, localContent: '', projectId: 'p1' }).ok, false)
  const two = { name: 'projects/p1/rulesets/a', source: { files: [{ content: 'x' }, { content: 'y' }] } }
  assert.equal(compareRuleset({ ruleset: two, localContent: 'x', projectId: 'p1' }).ok, false)
})

test('a bad key file never puts its contents in the error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-'))
  try {
    const secret = '-----BEGIN PRIVATE KEY-----SECRETMATERIAL'
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, `{"type":"service_account","private_key":"${secret}",,}`)
    assert.throws(() => readServiceAccountKey(bad, 'p1'), (error) => !error.message.includes('SECRETMATERIAL') && /not valid JSON/.test(error.message))
    const other = join(dir, 'other.json')
    writeFileSync(other, JSON.stringify({ type: 'service_account', client_email: 'a@b', private_key: secret, project_id: 'p2' }))
    assert.throws(() => readServiceAccountKey(other, 'p1'), (error) => !error.message.includes('SECRETMATERIAL'))
    const good = join(dir, 'good.json')
    writeFileSync(good, JSON.stringify({ type: 'service_account', client_email: 'a@b', private_key: secret, project_id: 'p1' }))
    assert.equal(readServiceAccountKey(good, 'p1').client_email, 'a@b')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CI gate: every required check must have its latest run successful', () => {
  const ok = (name, at = '2026-11-16T10:00:00Z') => ({ name, status: 'completed', conclusion: 'success', started_at: at })
  assert.deepEqual(missingCiChecks(REQUIRED_CI_CHECKS.map((n) => ok(n)), REQUIRED_CI_CHECKS), [])
  assert.deepEqual(missingCiChecks([ok('build-and-test'), ok('rules-typecheck')], REQUIRED_CI_CHECKS), ['rulebook-check'])
  const failedLater = [...REQUIRED_CI_CHECKS.map((n) => ok(n)), { name: 'rules-typecheck', status: 'completed', conclusion: 'failure', started_at: '2026-11-16T11:00:00Z' }]
  assert.deepEqual(missingCiChecks(failedLater, REQUIRED_CI_CHECKS), ['rules-typecheck'])
  const pending = [ok('build-and-test'), ok('rulebook-check'), { name: 'rules-typecheck', status: 'in_progress', conclusion: null, started_at: '2026-11-16T10:00:00Z' }]
  assert.deepEqual(missingCiChecks(pending, REQUIRED_CI_CHECKS), ['rules-typecheck'])
  assert.deepEqual(missingCiChecks([], REQUIRED_CI_CHECKS), [...REQUIRED_CI_CHECKS])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareRuleset, latestPushRuns, missingCiJobs, planTargets, readServiceAccountKey, TARGET_PLANS } from './firebase-rules-deploy.mjs'

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

const SHA = 'abc123'
const wfRun = (id, file, { event = 'push', branch = 'main', at = '2026-11-16T10:00:00Z', status = 'completed', sha = SHA } = {}) =>
  ({ id, path: `.github/workflows/${file}`, event, head_branch: branch, head_sha: sha, created_at: at, status })
const job = (name, conclusion = 'success') => ({ name, status: 'completed', conclusion })
const goodJobs = () => new Map([[1, [job('build-and-test'), job('rules-typecheck')]], [2, [job('rulebook-check')]]])
const gate = (runs, jobs) => missingCiJobs(latestPushRuns(runs, { sha: SHA }), jobs)

test('CI gate: push-to-main runs of web-ci.yml and rulebook.yml with every job successful pass', () => {
  assert.deepEqual(gate([wfRun(1, 'web-ci.yml'), wfRun(2, 'rulebook.yml')], goodJobs()), [])
})

test('CI gate: a later scheduled rulebook run with rulebook-check skipped does not block', () => {
  const runs = [wfRun(1, 'web-ci.yml'), wfRun(2, 'rulebook.yml'), wfRun(3, 'rulebook.yml', { event: 'schedule', at: '2026-11-17T06:17:00Z' })]
  const jobs = goodJobs()
  jobs.set(3, [{ name: 'rulebook-check', status: 'completed', conclusion: 'skipped' }])
  assert.deepEqual(gate(runs, jobs), [])
  // A later manual dispatch of web-ci does not count either.
  const dispatched = [...runs, wfRun(4, 'web-ci.yml', { event: 'workflow_dispatch', at: '2026-11-17T07:00:00Z' })]
  jobs.set(4, [job('build-and-test', 'failure')])
  assert.deepEqual(gate(dispatched, jobs), [])
})

test('CI gate: a later failed push run of the same workflow blocks', () => {
  const runs = [wfRun(1, 'web-ci.yml'), wfRun(2, 'rulebook.yml'), wfRun(5, 'web-ci.yml', { at: '2026-11-16T12:00:00Z' })]
  const jobs = goodJobs()
  jobs.set(5, [job('build-and-test'), job('rules-typecheck', 'failure')])
  assert.deepEqual(gate(runs, jobs), ['web-ci.yml: rules-typecheck'])
})

test('CI gate: missing runs, missing jobs, unfinished runs and skipped jobs block', () => {
  assert.deepEqual(gate([], new Map()), ['web-ci.yml: build-and-test', 'web-ci.yml: rules-typecheck', 'rulebook.yml: rulebook-check'])
  assert.deepEqual(gate([wfRun(1, 'web-ci.yml'), wfRun(2, 'rulebook.yml')], new Map([[1, [job('build-and-test')]], [2, [job('rulebook-check')]]])), ['web-ci.yml: rules-typecheck'])
  assert.deepEqual(gate([wfRun(1, 'web-ci.yml', { status: 'in_progress' }), wfRun(2, 'rulebook.yml')], goodJobs()), ['web-ci.yml: build-and-test', 'web-ci.yml: rules-typecheck'])
  const skipped = goodJobs()
  skipped.set(2, [{ name: 'rulebook-check', status: 'completed', conclusion: 'skipped' }])
  assert.deepEqual(gate([wfRun(1, 'web-ci.yml'), wfRun(2, 'rulebook.yml')], skipped), ['rulebook.yml: rulebook-check'])
})

test('CI gate: a job of the same name in another workflow, another branch or another commit never counts', () => {
  const runs = [wfRun(1, 'web-ci.yml'), wfRun(6, 'other.yml'), wfRun(7, 'rulebook.yml', { branch: 'feature' }), wfRun(8, 'rulebook.yml', { sha: 'zzz' })]
  const jobs = goodJobs()
  jobs.set(6, [job('rulebook-check')]); jobs.set(7, [job('rulebook-check')]); jobs.set(8, [job('rulebook-check')])
  assert.deepEqual(gate(runs, jobs), ['rulebook.yml: rulebook-check'])
})

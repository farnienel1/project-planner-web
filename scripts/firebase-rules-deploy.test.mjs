import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareRuleset, planTargets, TARGET_PLANS } from './firebase-rules-deploy.mjs'

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

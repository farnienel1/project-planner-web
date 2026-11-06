import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { measure, measureCompileCost } from './check-rules-budget.mjs'

function fixture(firestoreBytes, storageBytes) {
  const root = mkdtempSync(join(tmpdir(), 'rules-budget-'))
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'firestore.rules'), 'x'.repeat(firestoreBytes))
  writeFileSync(join(root, 'storage.rules'), 'x'.repeat(storageBytes))
  return root
}

test('rules within the budget pass; one byte over fails', () => {
  const budget = { firestoreRulesMaxBytes: 100, storageRulesMaxBytes: 50 }
  assert.deepEqual(measure(fixture(100, 50), budget).map((row) => row.over), [false, false])
  assert.deepEqual(measure(fixture(101, 50), budget).map((row) => row.over), [true, false])
  assert.deepEqual(measure(fixture(10, 51), budget).map((row) => row.over), [false, true])
})

test('a missing or non-numeric budget is refused', () => {
  assert.throws(() => measure(fixture(1, 1), { firestoreRulesMaxBytes: 100 }))
  assert.throws(() => measure(fixture(1, 1), { firestoreRulesMaxBytes: '100', storageRulesMaxBytes: 50 }))
})

test('the committed budget holds for the repo', () => {
  assert.ok(measure().every((row) => !row.over))
})

function rulesFixture(source) {
  const root = mkdtempSync(join(tmpdir(), 'rules-cost-'))
  mkdirSync(join(root, 'scripts'))
  writeFileSync(join(root, 'firestore.rules'), source)
  return root
}

test('compile cost: a helper counts once per call site plus once on its own', () => {
  const source = [
    'service cloud.firestore {',
    '  function f() { return request.auth != null; }',
    '  match /a/{d} { allow read: if f(); allow write: if f() && f(); }',
    '}',
  ].join('\n')
  const root = rulesFixture(source)
  const { cost } = measureCompileCost(root, { firestoreRulesMaxCompileCost: 1000 })
  // f body = 7 tokens (return request . auth != null ;); allows: 3 + 7, 7 + 2 * 7 = 31; function root 7.
  assert.equal(cost, 10 + 21 + 7)
  assert.equal(measureCompileCost(root, { firestoreRulesMaxCompileCost: cost }).over, false)
  assert.equal(measureCompileCost(root, { firestoreRulesMaxCompileCost: cost - 1 }).over, true)
  assert.throws(() => measureCompileCost(root, {}))
})

test('the committed compile-cost budget holds for the repo', () => {
  assert.equal(measureCompileCost().over, false)
})

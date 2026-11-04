import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { measure } from './check-rules-budget.mjs'

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

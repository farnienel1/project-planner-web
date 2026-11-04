#!/usr/bin/env node
/**
 * Security rules size budget (docs/agent-rules/platform-guardrails.md §5).
 *
 * firestore.rules grew from 145 KB to 188 KB in a week and Google's rules checker timed out (HTTP 503), so a deploy
 * failed for hours. This check fails when firestore.rules or storage.rules is larger than the byte budget in
 * scripts/rules-budget.json. Fix it by slimming the rules (shared functions with `let`, rationale moved to docs/,
 * dead functions deleted); raise the budget only with a stated reason in the PR.
 *
 *   node scripts/check-rules-budget.mjs
 */
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

export const RULE_FILES = [
  { key: 'firestoreRulesMaxBytes', file: 'firestore.rules' },
  { key: 'storageRulesMaxBytes', file: 'storage.rules' },
]

/** [{ file, bytes, budget, over }] for each rules file; throws when a budget is missing or not a positive integer. */
export function measure(root = ROOT, budget = JSON.parse(readFileSync(join(root, 'scripts', 'rules-budget.json'), 'utf8'))) {
  return RULE_FILES.map(({ key, file }) => {
    const max = budget[key]
    if (!Number.isInteger(max) || max <= 0) throw new Error(`scripts/rules-budget.json: ${key} must be a positive whole number of bytes`)
    const bytes = statSync(join(root, file)).size
    return { file, bytes, budget: max, over: bytes > max }
  })
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function main() {
  const rows = measure()
  let failed = false
  for (const row of rows) {
    const line = `${row.file}: ${row.bytes} bytes (${kb(row.bytes)}) of ${row.budget} (${kb(row.budget)})`
    if (row.over) {
      failed = true
      console.error(`OVER BUDGET  ${line}. Slim the rules (platform-guardrails.md §5) or raise the budget with a stated reason.`)
    } else {
      console.log(`ok  ${line}, ${row.budget - row.bytes} bytes headroom`)
    }
  }
  if (failed) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()

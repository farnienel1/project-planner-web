#!/usr/bin/env node
/**
 * Security rules size budget (docs/agent-rules/platform-guardrails.md §5).
 *
 * firestore.rules grew from 145 KB to 188 KB in a week and Google's rules checker timed out (HTTP 503), so a deploy
 * failed for hours. This check fails when firestore.rules or storage.rules is larger than the byte budget in
 * scripts/rules-budget.json. Fix it by slimming the rules (shared functions with `let`, rationale moved to docs/,
 * dead functions deleted); raise the budget only with a stated reason in the PR.
 *
 * Bytes are a weak proxy. It also fails when firestore.rules' static compile cost (scripts/rules-cost/metric.py
 * `total2`: the fully inlined token count of every allow condition plus every function body, which tracks Google's
 * compile time) is above `firestoreRulesMaxCompileCost` (docs/firestore-rules-notes.md "Compile cost"). 1.32.1
 * (429,072) was refused by the console; 1.32.2 cut it below 395,000. Needs python3 (on every GitHub runner).
 *
 *   node scripts/check-rules-budget.mjs
 */
import { spawnSync } from 'node:child_process'
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

const METRIC_DIR = join(ROOT, 'scripts', 'rules-cost')

/** Static compile cost of a rules file: metric.py `total2(file)[2]`. Throws when python3 or the metric fails. */
export function compileCost(file) {
  const run = spawnSync(
    'python3',
    ['-c', 'import sys; sys.path.insert(0, sys.argv[1]); import metric; print(metric.total2(sys.argv[2])[2])', METRIC_DIR, file],
    { encoding: 'utf8' },
  )
  if (run.error) throw new Error(`python3 is needed for the compile-cost check: ${run.error.message}`)
  if (run.status !== 0) throw new Error(`scripts/rules-cost/metric.py failed on ${file}: ${run.stderr.trim()}`)
  const cost = Number(run.stdout.trim())
  if (!Number.isInteger(cost) || cost <= 0) throw new Error(`scripts/rules-cost/metric.py gave no cost for ${file}: ${run.stdout}`)
  return cost
}

/** { file, cost, budget, over } for firestore.rules; throws when the budget is missing or not a positive integer. */
export function measureCompileCost(root = ROOT, budget = JSON.parse(readFileSync(join(root, 'scripts', 'rules-budget.json'), 'utf8'))) {
  const max = budget.firestoreRulesMaxCompileCost
  if (!Number.isInteger(max) || max <= 0) throw new Error('scripts/rules-budget.json: firestoreRulesMaxCompileCost must be a positive whole number')
  const cost = compileCost(join(root, 'firestore.rules'))
  return { file: 'firestore.rules', cost, budget: max, over: cost > max }
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
  const compile = measureCompileCost()
  const line = `firestore.rules: static compile cost ${compile.cost} of ${compile.budget}`
  if (compile.over) {
    failed = true
    console.error(`OVER BUDGET  ${line}. Google's rules compiler refuses rules this expensive (console "unknown error", CLI 503). Cut the cost (docs/firestore-rules-notes.md "Compile cost", scripts/rules-cost/hot.py); never raise this budget.`)
  } else {
    console.log(`ok  ${line}, ${compile.budget - compile.cost} headroom`)
  }
  if (failed) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()

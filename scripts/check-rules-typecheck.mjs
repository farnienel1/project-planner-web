#!/usr/bin/env node
/**
 * Security rules type check (docs/firestore-rules-notes.md "Compile cost", platform-guardrails.md §5).
 *
 * The Firebase console refuses rules its type checker reports as "Invalid type" (1.31.2). This sends firestore.rules
 * to a running Firestore emulator (PUT :securityRules, the same compiler as scripts/rules-cost/ctime.py) and fails on
 * a compile error or any issue that is not a warning ("Unused function" / "Unused variable" are warnings).
 *
 *   firebase emulators:exec --only firestore --project demo-rules-typecheck "node scripts/check-rules-typecheck.mjs"
 *
 * FIRESTORE_EMULATOR_HOST (set by emulators:exec) names the emulator; default 127.0.0.1:8080. An optional argument checks
 * another rules file instead of firestore.rules.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** The issues that block a publish: everything but warnings, plus any "Invalid type" whatever its severity. */
export function blockingIssues(issues = []) {
  return issues.filter((issue) => issue.severity !== 'WARNING' || /Invalid type/.test(issue.description ?? ''))
}

async function main() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  const content = readFileSync(process.argv[2] ?? join(ROOT, 'firestore.rules'), 'utf8')
  const response = await fetch(`http://${host}/emulator/v1/projects/demo-rules-typecheck:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  })
  const text = await response.text()
  if (response.status !== 200) {
    console.error(`firestore.rules does not compile (HTTP ${response.status}):\n${text}`)
    process.exit(1)
  }
  const issues = text ? JSON.parse(text).issues ?? [] : []
  const blocking = blockingIssues(issues)
  for (const issue of issues) {
    const at = issue.sourcePosition ? `L${issue.sourcePosition.line}:${issue.sourcePosition.column}` : ''
    console.log(`${issue.severity} ${at} ${issue.description}`)
  }
  if (blocking.length > 0) {
    console.error(`firestore.rules: ${blocking.length} type-check error(s); the console would refuse to publish it.`)
    process.exit(1)
  }
  console.log(`ok  firestore.rules type check: 0 errors, ${issues.length} warning(s)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

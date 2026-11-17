#!/usr/bin/env node
/**
 * npm audit gate with a dated allowlist (.github/workflows/security.yml).
 *
 * Runs `npm audit --json` at the repo root and fails on any high or critical advisory, except the advisories listed
 * in scripts/npm-audit-allowlist.json. Use the allowlist only when no patched version exists yet. Each entry is
 * `{ id, reason, expires }`, where `expires` is a YYYY-MM-DD date: the entry counts up to and including that day (UTC).
 *
 * - An expired entry fails the check. Upgrade or patch the dependency, or renew the entry with a stated reason.
 * - An entry that matches no advisory prints a warning asking for it to be removed.
 * - A package flagged only through allowlisted advisories (for example the dependents of picomatch) does not count.
 *   This is worked out from the `via` chains in the audit JSON. A package counts when it can reach, through `via`, a
 *   high or critical advisory that is not allowlisted.
 *
 *   node scripts/check-npm-audit.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
export const BLOCKING_SEVERITIES = new Set(['high', 'critical'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** The GHSA id of an advisory object in a `via` list (from its url), else its numeric source as text. */
export function advisoryId(advisory) {
  const match = typeof advisory.url === 'string' ? advisory.url.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i) : null
  return match ? match[0] : String(advisory.source ?? '')
}

/** Throws when the allowlist is not a list of `{ id, reason, expires }` with a valid YYYY-MM-DD date. */
export function validateAllowlist(allowlist) {
  if (!Array.isArray(allowlist)) throw new Error('scripts/npm-audit-allowlist.json must be a JSON array')
  for (const entry of allowlist) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) throw new Error('npm audit allowlist: every entry needs an id')
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new Error(`npm audit allowlist: ${entry.id} needs a reason`)
    if (typeof entry.expires !== 'string' || !DATE_RE.test(entry.expires) || Number.isNaN(Date.parse(`${entry.expires}T00:00:00Z`))) {
      throw new Error(`npm audit allowlist: ${entry.id} needs expires as YYYY-MM-DD`)
    }
  }
  return allowlist
}

/**
 * Decides the audit result.
 * @param {object} audit `npm audit --json` output (lockfile v2/v3 shape: `vulnerabilities[name].via`).
 * @param {{ id: string, reason: string, expires: string }[]} allowlist
 * @param {string} today YYYY-MM-DD (UTC).
 * @returns {{ ok: boolean, blocking: { name: string, severity: string, advisories: string[] }[],
 *   allowed: string[], expired: object[], unused: object[] }}
 */
export function evaluateAudit(audit, allowlist, today) {
  validateAllowlist(allowlist)
  if (audit && audit.error) throw new Error(`npm audit failed: ${audit.error.summary ?? JSON.stringify(audit.error)}`)
  const vulnerabilities = (audit && audit.vulnerabilities) || {}
  const expired = allowlist.filter((entry) => entry.expires < today)
  const activeIds = new Set(allowlist.filter((entry) => entry.expires >= today).map((entry) => entry.id.toLowerCase()))

  const seenIds = new Set()
  for (const vuln of Object.values(vulnerabilities)) {
    for (const via of vuln.via || []) if (via && typeof via === 'object') seenIds.add(advisoryId(via).toLowerCase())
  }
  const unused = allowlist.filter((entry) => !seenIds.has(entry.id.toLowerCase()))

  // Advisories (high/critical, not allowlisted) each package can reach through its `via` chain.
  const memo = new Map()
  const reach = (name, stack) => {
    if (memo.has(name)) return memo.get(name)
    if (stack.has(name)) return new Set() // cycle: the other path decides
    stack.add(name)
    const found = new Set()
    for (const via of vulnerabilities[name]?.via || []) {
      if (typeof via === 'string') {
        for (const id of reach(via, stack)) found.add(id)
      } else if (via && BLOCKING_SEVERITIES.has(via.severity)) {
        const id = advisoryId(via)
        if (!activeIds.has(id.toLowerCase())) found.add(id)
      }
    }
    stack.delete(name)
    memo.set(name, found)
    return found
  }

  const blocking = []
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    const advisories = [...reach(name, new Set())].sort()
    if (advisories.length) blocking.push({ name, severity: vuln.severity, advisories })
  }
  const allowed = [...seenIds].filter((id) => activeIds.has(id)).sort()
  return { ok: blocking.length === 0 && expired.length === 0, blocking, allowed, expired, unused }
}

function main() {
  const allowlist = JSON.parse(readFileSync(join(ROOT, 'scripts', 'npm-audit-allowlist.json'), 'utf8'))
  const run = spawnSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let audit
  try {
    audit = JSON.parse(run.stdout)
  } catch {
    console.error('npm audit did not return JSON.')
    console.error(run.stderr || run.stdout)
    process.exit(1)
  }
  const today = new Date().toISOString().slice(0, 10)
  const result = evaluateAudit(audit, allowlist, today)

  for (const entry of result.unused) {
    console.warn(`::warning::npm audit allowlist entry ${entry.id} no longer matches any advisory. Remove it from scripts/npm-audit-allowlist.json.`)
  }
  for (const id of result.allowed) {
    const entry = allowlist.find((row) => row.id.toLowerCase() === id)
    console.log(`Allowed: ${entry.id} until ${entry.expires} (${entry.reason})`)
  }
  for (const entry of result.expired) {
    console.error(`::error::npm audit allowlist entry ${entry.id} expired on ${entry.expires}. Upgrade the dependency, or renew the entry with a stated reason.`)
  }
  for (const row of result.blocking) {
    console.error(`::error::${row.name} (${row.severity}): ${row.advisories.join(', ')}`)
  }
  if (!result.ok) {
    console.error(`npm audit check failed: ${result.blocking.length} package(s) with high or critical advisories not allowlisted, ${result.expired.length} expired allowlist entr${result.expired.length === 1 ? 'y' : 'ies'}.`)
    process.exit(1)
  }
  console.log('npm audit check passed: no high or critical advisories outside the allowlist.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()

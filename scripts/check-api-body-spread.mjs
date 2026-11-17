#!/usr/bin/env node
/**
 * Mass-assignment guard (audit 17 Nov, owner approved): an API route never hands the caller's JSON straight to a
 * Firestore write.
 *
 * Fails when a route under app/api:
 *   - calls `request.json()` itself (bodies go through `readApiBody` with a zod schema, lib/security/apiBody.ts, or the
 *     older `readJsonBody` that is being moved over), or
 *   - spreads a request body into an object (`...body`, `...body.value`, `...parsed.value`, `...payload`) — the shape
 *     a Firestore write would take, so a caller could add `role`, `isAdmin`, `isSuperAdmin` or `organizationId`.
 *
 * A reviewed exception goes in ALLOWLIST with a one-line reason. Comments are not scanned.
 *
 *   node scripts/check-api-body-spread.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `{ path, pattern, reason }` — a reviewed hit that may stay. */
export const ALLOWLIST = []

const BODY_NAMES = '(?:body|parsed|payload|json|input|requestBody|reqBody)'

export const PATTERNS = [
  { id: 'raw-request-json', re: /\brequest\.json\s*\(/ },
  { id: 'body-spread', re: new RegExp(`\\.\\.\\.\\s*${BODY_NAMES}(?:\\.value)?(?![\\w.\\[])`) },
  { id: 'body-spread', re: /\.\.\.\s*\(?\s*await\s+request\.json/ },
]

function stripComment(line) {
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return ''
  const at = line.indexOf('//')
  if (at >= 0 && !line.slice(0, at).includes("'") && !line.slice(0, at).includes('"') && !line.slice(0, at).includes('`')) {
    return line.slice(0, at)
  }
  return line
}

function walk(dir, out) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    const info = statSync(full)
    if (info.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

/** Every hit under `root/app/api`: `{ path, line, pattern, text }`. */
export function scan(root) {
  const hits = []
  for (const file of walk(join(root, 'app', 'api'), [])) {
    const path = relative(root, file).split('\\').join('/')
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((raw, index) => {
      const line = stripComment(raw)
      if (!line) return
      const seen = new Set()
      for (const { id, re } of PATTERNS) {
        if (seen.has(id)) continue
        if (re.test(line)) {
          seen.add(id)
          hits.push({ path, line: index + 1, pattern: id, text: raw.trim() })
        }
      }
    })
  }
  return hits
}

/** Hits not covered by the allow-list. */
export function violations(hits, allowlist = ALLOWLIST) {
  return hits.filter((hit) => !allowlist.some((row) => row.path === hit.path && row.pattern === hit.pattern))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = join(fileURLToPath(import.meta.url), '..', '..')
  const bad = violations(scan(root))
  if (bad.length) {
    console.error('API routes must read bodies through readApiBody (lib/security/apiBody.ts) and never spread them:')
    for (const hit of bad) console.error(`  ${hit.path}:${hit.line} [${hit.pattern}] ${hit.text}`)
    process.exit(1)
  }
  console.log('check-api-body-spread: no request body spread or raw request.json() in app/api.')
}

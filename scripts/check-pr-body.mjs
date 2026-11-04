#!/usr/bin/env node
// PR body check (owner safeguard B, docs/OWNER_DECISIONS.md 4 Nov).
//
// Fails unless the pull request body has the sections .github/pull_request_template.md asks for:
// a 3-factor table (Web / iOS / Shared rule rows), Owner decisions, Call sites, Deploy needed,
// Not done / follow-ups and What I did NOT check. A docs-only PR (every changed file under docs/
// or .github/, or a .md file) needs only the 3-factor table and What I did NOT check.
//
// CI passes the body in the PR_BODY environment variable (never interpolated into a shell line)
// and the commit range in BASE_SHA / HEAD_SHA. Locally:
//   PR_BODY="$(cat body.md)" node scripts/check-pr-body.mjs --files docs/a.md,lib/x.ts

import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** Required sections. `match` is tested against each markdown heading's text. */
export const SECTIONS = [
  { id: 'threeFactor', label: '3-factor table (Web / iOS / Shared rule)', match: /\b3[\s-]*factor\b/i, docsOnly: true },
  { id: 'ownerDecisions', label: 'Owner decisions', match: /\bowner decisions?\b/i },
  { id: 'callSites', label: 'Call sites', match: /\bcall sites?\b/i },
  { id: 'deployNeeded', label: 'Deploy needed', match: /\bdeploy needed\b/i },
  { id: 'notDone', label: 'Not done / follow-ups', match: /\bnot done\b/i },
  { id: 'notChecked', label: 'What I did NOT check', match: /\bdid not check\b/i, docsOnly: true },
]

/** Rows the 3-factor table must have, matched on its first cell. */
export const THREE_FACTOR_ROWS = [
  { label: 'Web', match: /^web$/i },
  { label: 'iOS', match: /^ios$/i },
  { label: 'Shared rule', match: /^shared rule/i },
]

/** True when every changed file is documentation or GitHub config (and at least one file changed). */
export function isDocsOnly(files) {
  const list = (files || []).map((f) => String(f).trim()).filter(Boolean)
  if (list.length === 0) return false
  return list.every((f) => f.startsWith('docs/') || f.startsWith('.github/') || f.toLowerCase().endsWith('.md'))
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

/** Splits a markdown body into `{ heading, body }` sections by ATX headings (`#` … `######`). */
export function sections(markdown) {
  const lines = stripComments(String(markdown || '').replace(/\r\n?/g, '\n')).split('\n')
  const out = []
  let current = null
  let fence = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const m = !fence && /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (m) {
      current = { heading: m[2], level: m[1].length, lines: [] }
      out.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  // A section's body runs until the next heading of the same or a higher level.
  return out.map((s, i) => {
    const body = [...s.lines]
    for (let j = i + 1; j < out.length && out[j].level > s.level; j++) {
      body.push(`${'#'.repeat(out[j].level)} ${out[j].heading}`, ...out[j].lines)
    }
    return { heading: s.heading, body: body.join('\n') }
  })
}

function hasContent(body) {
  return body.split('\n').some((l) => l.trim() !== '' && !/^\s*\|?[\s:|-]*\|?\s*$/.test(l))
}

function tableFirstCells(body) {
  return body
    .split('\n')
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\|/, '').split('|')[0].replace(/[*_`]/g, '').trim())
}

/**
 * Checks a PR body. `changedFiles` decides the docs-only escape; an empty or missing list
 * means "unknown" and every section is required.
 * Returns `{ ok, docsOnly, errors }`.
 */
export function checkPrBody(body, changedFiles = []) {
  const docsOnly = isDocsOnly(changedFiles)
  const found = sections(body)
  const errors = []
  for (const req of SECTIONS) {
    if (docsOnly && !req.docsOnly) continue
    const sec = found.find((s) => req.match.test(s.heading))
    if (!sec) {
      errors.push(`Missing heading: ${req.label}`)
      continue
    }
    if (!hasContent(sec.body)) {
      errors.push(`Empty section: ${req.label} (write "none" or "n/a" if nothing applies)`)
      continue
    }
    if (req.id === 'threeFactor') {
      const cells = tableFirstCells(sec.body)
      for (const row of THREE_FACTOR_ROWS) {
        if (!cells.some((c) => row.match.test(c))) errors.push(`3-factor table has no "${row.label}" row`)
      }
    }
  }
  return { ok: errors.length === 0, docsOnly, errors }
}

function changedFilesFromGit(base, head) {
  if (!base || !head) return []
  const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' })
  return out.split('\n').map((l) => l.trim()).filter(Boolean)
}

function main(argv) {
  const filesArg = argv.indexOf('--files')
  const files =
    filesArg >= 0
      ? String(argv[filesArg + 1] || '').split(',').map((f) => f.trim()).filter(Boolean)
      : changedFilesFromGit(process.env.BASE_SHA, process.env.HEAD_SHA)
  const result = checkPrBody(process.env.PR_BODY || '', files)
  const scope = result.docsOnly ? 'docs-only PR: 3-factor table and What I did NOT check required' : 'full checklist required'
  if (result.ok) {
    console.log(`PR body check passed (${scope}).`)
    return 0
  }
  console.error(`PR body check failed (${scope}). Use .github/pull_request_template.md:`)
  for (const e of result.errors) console.error(`  - ${e}`)
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv.slice(2))
}

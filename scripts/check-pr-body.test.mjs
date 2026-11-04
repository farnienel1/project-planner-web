import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkPrBody, isDocsOnly, sections } from './check-pr-body.mjs'

const FULL = `## Summary
Adds a thing.

## 3-factor
| | Change |
|---|---|
| Web | components/x.tsx |
| iOS | not in this PR — hand-off |
| Shared rule | \`unbookedLabourRowsOnDay\` (unchanged) |

## Owner decisions
| Row | Status |
|---|---|
| 4 Nov Book labour | ✓ |

## Call sites
| Path | |
|---|---|
| lib/x.ts | rulebook ✓ |

## Deploy needed
Nothing to deploy.

## Not done / follow-ups
- none

## What I did NOT check
- no device build
`

const CODE = ['lib/x.ts', 'docs/SCREEN_MAP.md']
const DOCS = ['docs/SCREEN_MAP.md', '.github/pull_request_template.md', 'README.md']

test('a complete body passes for a code change', () => {
  const r = checkPrBody(FULL, CODE)
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
  assert.equal(r.docsOnly, false)
})

test('every missing section is reported', () => {
  const r = checkPrBody('## Summary\nhello', CODE)
  assert.equal(r.ok, false)
  assert.equal(r.errors.length, 6)
})

test('missing Owner decisions fails a code change', () => {
  const body = FULL.replace('## Owner decisions', '## Decisions we made')
  const r = checkPrBody(body, CODE)
  assert.deepEqual(r.errors, ['Missing heading: Owner decisions'])
})

test('3-factor table needs Web, iOS and Shared rule rows', () => {
  const body = FULL.replace('| iOS | not in this PR — hand-off |\n', '')
  assert.deepEqual(checkPrBody(body, CODE).errors, ['3-factor table has no "iOS" row'])
  const noTable = FULL.replace(/## 3-factor[\s\S]*?## Owner/, '## 3-factor\nWeb only.\n\n## Owner')
  assert.equal(checkPrBody(noTable, CODE).errors.length, 3)
})

test('bold first cells and "Shared rule (lib/canonical)" count', () => {
  const body = FULL.replace('| Web |', '| **Web** |').replace('| Shared rule |', '| Shared rule (lib/canonical) |')
  assert.equal(checkPrBody(body, CODE).ok, true)
})

test('a section left as the template comment is empty', () => {
  const body = FULL.replace('Nothing to deploy.', '<!-- rules / storage / indexes / functions, or "nothing" -->')
  assert.deepEqual(checkPrBody(body, CODE).errors, [
    'Empty section: Deploy needed (write "none" or "n/a" if nothing applies)',
  ])
})

test('headings inside code fences are ignored', () => {
  const body = '```\n## Owner decisions\n```\n' + FULL.replace('## Owner decisions', '## Something else')
  assert.ok(checkPrBody(body, CODE).errors.includes('Missing heading: Owner decisions'))
})

test('docs-only escape needs only 3-factor and What I did NOT check', () => {
  const body = `## 3-factor
| | |
|---|---|
| Web | docs only |
| iOS | none |
| Shared rule | none |

### What I did NOT check
- rendering on GitHub
`
  const r = checkPrBody(body, DOCS)
  assert.equal(r.docsOnly, true)
  assert.deepEqual(r.errors, [])
  assert.equal(checkPrBody(body, CODE).ok, false)
  assert.equal(checkPrBody('## Summary\nx', DOCS).errors.length, 2)
})

test('docs-only detection', () => {
  assert.equal(isDocsOnly(DOCS), true)
  assert.equal(isDocsOnly(['docs/a.md', 'scripts/x.mjs']), false)
  assert.equal(isDocsOnly(['.github/workflows/pr-checklist.yml']), true)
  assert.equal(isDocsOnly([]), false, 'unknown file list never takes the escape')
})

test('a null or empty body fails cleanly', () => {
  assert.equal(checkPrBody(null, CODE).ok, false)
  assert.equal(checkPrBody('', DOCS).ok, false)
})

test('a sub-heading stays inside its parent section', () => {
  const s = sections('## 3-factor\n### Table\n| Web | x |\n## Next\ny')
  assert.match(s[0].body, /\| Web \| x \|/)
})

test('the PR template itself has every heading (filled in, it passes)', () => {
  const template = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8')
  const r = checkPrBody(template, CODE)
  assert.equal(r.errors.some((e) => e.startsWith('Missing heading')), false, r.errors.join('\n'))
})

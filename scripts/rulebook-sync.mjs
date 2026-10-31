#!/usr/bin/env node
/**
 * Keeps the one rulebook (docs/RULEBOOK.md + lib/canonical) and the iOS hand-off in step.
 *
 *   node scripts/rulebook-sync.mjs check [--base <git-ref>]
 *       Fails when lib/canonical or docs/RULEBOOK.md changed since <base> (default HEAD) without a
 *       rulebook version bump and a changelog entry for the new version, or when the packed files
 *       are stale. Used by the pre-commit hook, CI and the Claude Code Stop hook.
 *   node scripts/rulebook-sync.mjs handoff [--base <git-ref>]
 *       Writes docs/ios-handoff/v<version>.md and docs/ios-handoff/LATEST.md: the follow-on prompt for
 *       the iOS agent (what changed, exports added/removed, packed hash, copy instructions).
 *   node scripts/rulebook-sync.mjs claude-stop
 *       Claude Code Stop hook. Reads the hook JSON on stdin. Blocks the agent from finishing (exit 2)
 *       while the working tree changes the rulebook without a bump or without a fresh hand-off.
 *   node scripts/rulebook-sync.mjs status
 *       Prints the rulebook version, packed hash and whether an iOS mirror beside this repo matches.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULEBOOK = 'docs/RULEBOOK.md'
const MANIFEST = 'lib/canonical/dist/canonical-manifest.json'
const BUNDLE = 'lib/canonical/dist/canonical-business.js'
const HANDOFF_DIR = 'docs/ios-handoff'
const WATCHED = /^(lib\/canonical\/(?!dist\/)|docs\/RULEBOOK\.md$|firestore\.rules$|storage\.rules$|firestore\.indexes\.json$)/

const args = process.argv.slice(2)
const command = args[0] || 'status'
const baseIndex = args.indexOf('--base')
const base = baseIndex >= 0 ? args[baseIndex + 1] : 'HEAD'

function git(...argv) {
  try {
    return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function read(rel) {
  const file = path.join(root, rel)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

export function parseRulebook(text) {
  const version = /^Version:\s*(\S+)\s*$/m.exec(text || '')?.[1] ?? null
  const changelog = (text || '').split(/^## Changelog\s*$/m)[1] ?? ''
  const entry = version
    ? new RegExp(`^### ${version.replace(/\./g, '\\.')}\\b[^\\n]*\\n([\\s\\S]*?)(?=^### |^## |$(?![\\s\\S]))`, 'm').exec(changelog)
    : null
  const headings = [...(text || '').matchAll(/^##+ .+$/gm)].map((m) => m[0])
  return { version, hasChangelogEntry: Boolean(entry), changelogEntry: entry ? entry[1].trim() : '', headings }
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function bundleExports(source) {
  if (!source) return []
  const sandbox = {}
  createContext(sandbox)
  try {
    runInContext(`${source}\nthis.__names = Object.keys(ProjectPlannerCanonical).sort()`, sandbox)
    return sandbox.__names || []
  } catch {
    return []
  }
}

function changedFiles(ref) {
  const tracked = git('diff', '--name-only', ref) || ''
  const staged = git('diff', '--name-only', '--cached', ref) || ''
  const untracked = git('ls-files', '--others', '--exclude-standard') || ''
  return [...new Set(`${tracked}\n${staged}\n${untracked}`.split('\n').map((s) => s.trim()).filter(Boolean))]
}

function evaluate(ref) {
  const problems = []
  const current = read(RULEBOOK)
  if (!current) {
    problems.push(`${RULEBOOK} is missing.`)
    return { problems }
  }
  const now = parseRulebook(current)
  if (!now.version) problems.push(`${RULEBOOK} has no "Version: x.y.z" line.`)
  if (now.version && !now.hasChangelogEntry) {
    problems.push(`${RULEBOOK} has no changelog entry "### ${now.version}" under "## Changelog".`)
  }
  const before = git('show', `${ref}:${RULEBOOK}`)
  const previous = before ? parseRulebook(before) : { version: null }
  const watched = changedFiles(ref).filter((file) => WATCHED.test(file))
  const bumped = previous.version !== now.version
  if (watched.length > 0 && previous.version && !bumped) {
    problems.push(
      `Rulebook files changed (${watched.join(', ')}) but ${RULEBOOK} is still version ${now.version}. ` +
        'Bump the version, add a "### <version> — <date>" changelog entry describing the rule change, and run npm run rulebook:handoff.'
    )
  }
  const manifest = read(MANIFEST)
  const bundle = read(BUNDLE)
  if (manifest && bundle) {
    const parsed = JSON.parse(manifest)
    if (parsed.rulebookVersion !== now.version || parsed.rulebookSha256 !== sha256(current)) {
      problems.push('The packed rulebook stamp is stale. Run npm run build:canonical.')
    }
    if (parsed.bundleSha256 !== sha256(bundle)) problems.push('canonical-manifest.json does not match the packed script. Run npm run build:canonical.')
  } else {
    problems.push('The packed rulebook is missing. Run npm run build:canonical.')
  }
  if (bumped && watched.length > 0) {
    const handoff = read(`${HANDOFF_DIR}/v${now.version}.md`)
    if (!handoff) problems.push(`No iOS hand-off for ${now.version}. Run npm run rulebook:handoff.`)
    else if (manifest && !handoff.includes(JSON.parse(manifest).bundleSha256)) {
      problems.push(`The iOS hand-off for ${now.version} names an older packed hash. Run npm run rulebook:handoff.`)
    }
  }
  return { problems, now, previous, watched, bumped }
}

function writeHandoff(ref) {
  const rulebookText = read(RULEBOOK)
  const now = parseRulebook(rulebookText)
  const manifest = JSON.parse(read(MANIFEST) || '{}')
  const beforeBundle = git('show', `${ref}:${BUNDLE}`)
  const beforeRulebook = git('show', `${ref}:${RULEBOOK}`)
  const beforeExports = new Set(bundleExports(beforeBundle))
  const nowExports = manifest.exports || []
  const added = nowExports.filter((name) => !beforeExports.has(name))
  const removed = [...beforeExports].filter((name) => !nowExports.includes(name))
  const previous = beforeRulebook ? parseRulebook(beforeRulebook) : { version: null, headings: [] }
  const newHeadings = now.headings.filter((h) => !(previous.headings || []).includes(h))
  const watched = changedFiles(ref).filter((file) => WATCHED.test(file))
  const today = new Date().toISOString().slice(0, 10)
  const body = `# iOS follow-on — rulebook ${now.version}

Generated ${today} by \`npm run rulebook:handoff\` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of \`docs/RULEBOOK.md\` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

\`\`\`
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: ${previous.version ?? '(none)'} → ${now.version}
Packed hash: ${manifest.bundleSha256}
Rulebook sha256: ${manifest.rulebookSha256}
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ${added.length ? added.join(', ') : 'none'}
Exports removed: ${removed.length ? removed.join(', ') : 'none'}
Web files that changed the rules: ${watched.length ? watched.join(', ') : 'none recorded'}
Done when:
- [ ] Packed hash in iOS equals ${manifest.bundleSha256}
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ${manifest.rulebookSha256})
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == ${now.version})
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
\`\`\`

## What changed in ${now.version}

${now.changelogEntry || '(no changelog text)'}

${newHeadings.length ? `## New rulebook sections\n\n${newHeadings.map((h) => `- ${h.replace(/^#+ /, '')}`).join('\n')}\n` : ''}
## Workflow for the iOS agent

1. Run \`scripts/sync-rulebook-from-web.sh\` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
`
  mkdirSync(path.join(root, HANDOFF_DIR), { recursive: true })
  writeFileSync(path.join(root, HANDOFF_DIR, `v${now.version}.md`), body)
  writeFileSync(path.join(root, HANDOFF_DIR, 'LATEST.md'), body)
  return `${HANDOFF_DIR}/v${now.version}.md`
}

function status() {
  const now = parseRulebook(read(RULEBOOK))
  const manifest = JSON.parse(read(MANIFEST) || '{}')
  console.log(`Rulebook ${now.version ?? '(missing)'} · packed ${manifest.bundleSha256 ?? '(not built)'}`)
  const ios = path.resolve(root, '../project-planner-ios')
  if (existsSync(path.join(ios, '.git'))) {
    const iosManifest = existsSync(path.join(ios, 'Project Planner/Canonical/canonical-manifest.json'))
      ? JSON.parse(readFileSync(path.join(ios, 'Project Planner/Canonical/canonical-manifest.json'), 'utf8'))
      : null
    const same = iosManifest && iosManifest.bundleSha256 === manifest.bundleSha256
    console.log(same ? 'iOS checkout beside this repo matches.' : `iOS checkout beside this repo is on ${iosManifest?.rulebookVersion ?? 'an unstamped copy'} — run npm run build:canonical and commit in iOS.`)
  }
}

if (command === 'check') {
  const { problems } = evaluate(base)
  if (problems.length) {
    console.error('Rulebook check failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log('Rulebook check passed.')
} else if (command === 'handoff') {
  const file = writeHandoff(base)
  console.log(`Wrote ${file} and ${HANDOFF_DIR}/LATEST.md`)
} else if (command === 'claude-stop') {
  let input = ''
  try {
    input = readFileSync(0, 'utf8')
  } catch {
    input = ''
  }
  let hook = {}
  try {
    hook = JSON.parse(input || '{}')
  } catch {
    hook = {}
  }
  const { problems, watched } = evaluate('HEAD')
  if (!watched || watched.length === 0 || problems.length === 0) process.exit(0)
  const message =
    'The rulebook changed but is not ready to hand to iOS:\n' +
    problems.map((p) => `- ${p}`).join('\n') +
    '\nFix these (bump docs/RULEBOOK.md Version + changelog, npm run build:canonical, npm run rulebook:handoff), then give the user the iOS follow-on from docs/ios-handoff/LATEST.md.'
  if (hook.stop_hook_active) {
    // Already blocked once this turn: tell the user instead of looping.
    console.error(message)
    process.exit(0)
  }
  console.error(message)
  process.exit(2)
} else {
  status()
}

#!/usr/bin/env node
/**
 * Mass-assignment guard (audit 17 Nov, owner approved): an API route never hands the caller's JSON straight to a
 * Firestore write.
 *
 * Fails when a route under app/api:
 *   - calls `.json()` on its request object, under any name it is typed as (`NextRequest` / `Request`) — bodies go
 *     through `readApiBody` with a zod schema (lib/security/apiBody.ts);
 *   - calls the older `readJsonBody` (allow-listed per route while each is moved over), or
 *   - spreads the request body, or any name derived from it (`const data = body.value`, `const { items } = parsed.value`),
 *     into an object, or `Object.assign`s it — the shape a Firestore write would take, so a caller could add `role`,
 *     `isAdmin`, `isSuperAdmin` or `organizationId`; or
 *   - hands the whole body (`body.value`, or a name holding it) to another function, which would see every key.
 *
 * A reviewed exception goes in ALLOWLIST with a one-line reason. Comments are not scanned.
 *
 *   node scripts/check-api-body-spread.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const READ_JSON_BODY_REASON =
  'Reads named fields from the typed body one by one, never spreads it (the spread check still runs here); port to readApiBody is a follow-up (review of #391).'

/** `{ path, pattern, reason }` — a reviewed hit that may stay. */
export const ALLOWLIST = [
  { path: 'app/api/account/delete/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/mfa/grant-setup/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/mfa/start/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/mfa/verify/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/passkey/credentials/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/passkey/login/options/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/passkey/login/verify/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/passkey/password-changed/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/passkey/register/verify/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/auth/public-gate/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/geocode/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/interest/unsubscribe/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/invites/send-setup-email/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/org-setup/live-org-lookup/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/org-setup/send-confirm-email/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/organization/delete/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/organization/restore/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/stripe/create-checkout-session/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/stripe/create-portal-session/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
  { path: 'app/api/timesheets/export-email/route.ts', pattern: 'read-json-body', reason: READ_JSON_BODY_REASON },
]

/** Names a request body is held in before any taint is followed (the old fixed list). */
const BASE_BODY_NAMES = ['body', 'parsed', 'payload', 'json', 'input', 'requestBody', 'reqBody']

function escape(name) {
  return name.replace(/[$]/g, '\\$')
}

/** The names a file holds the request object in: every parameter typed `NextRequest` / `Request`, plus `request` / `req`. */
export function requestNames(source) {
  const names = new Set(['request', 'req'])
  for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*(?:NextRequest|Request)\b/g)) names.add(match[1])
  return [...names]
}

/**
 * The names that hold the request body or anything read from it: assigned from `readJsonBody`, `readApiBody`,
 * `parseApiBody`, `<request>.json()` or `JSON.parse`, or from another such name (`const data = body.value`,
 * `const { items } = parsed.value`), followed until nothing new is found.
 */
export function bodyDerivedNames(source, requests = requestNames(source)) {
  const tainted = new Set(BASE_BODY_NAMES)
  const req = requests.map(escape).join('|')
  const sources = `readJsonBody|readApiBody|parseApiBody|JSON\\.parse|(?:${req})(?:\\.clone\\(\\))?\\.json`
  let grew = true
  while (grew) {
    grew = false
    const names = [...tainted].map(escape).join('|')
    const rhs = `(?:\\(\\s*)?(?:await\\s+)?(?:\\(\\s*)?(?:${sources}|(?:${names})\\b)`
    const single = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=]+)?=\\s*${rhs}`, 'g')
    const destructured = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*(?::[^=]+)?=\\s*${rhs}`, 'g')
    for (const match of source.matchAll(single)) {
      if (!tainted.has(match[1])) {
        tainted.add(match[1])
        grew = true
      }
    }
    for (const match of source.matchAll(destructured)) {
      for (const part of match[1].split(',')) {
        const name = part.split(':').pop().split('=')[0].replace(/\.\.\./, '').trim()
        if (/^[A-Za-z_$][\w$]*$/.test(name) && !tainted.has(name)) {
          tainted.add(name)
          grew = true
        }
      }
    }
  }
  return [...tainted]
}

/**
 * The names that hold the WHOLE request body (not one field of it): anything assigned straight from a body reader,
 * and `const data = body.value` / `const copy = body` (review of #391, nit 8). A name assigned from something else
 * (`payload = await upstream.json()`, a raw `request.text()` for a webhook signature) is not one.
 */
export function bodyObjectNames(source, requests = requestNames(source)) {
  const names = new Set()
  const req = requests.map(escape).join('|')
  const sources = `readJsonBody|readApiBody|parseApiBody|JSON\\.parse|(?:${req})(?:\\.clone\\(\\))?\\.json`
  let grew = true
  while (grew) {
    grew = false
    const known = [...names].map(escape).join('|') || '(?!)'
    const assign = new RegExp(
      `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=]+)?=\\s*(?:\\(\\s*)?(?:await\\s+)?(?:(?:${sources})\\b|(?:${known})(?:\\.value)?\\s*(?:as\\b|[;)\\n]|$))`,
      'gm'
    )
    for (const match of source.matchAll(assign)) {
      if (!names.has(match[1])) {
        names.add(match[1])
        grew = true
      }
    }
  }
  return [...names]
}

/** The patterns for one file (they depend on the file's request and body-derived names). */
export function patternsFor(source) {
  const requests = requestNames(source)
  const names = bodyDerivedNames(source, requests)
  const objects = bodyObjectNames(source, requests)
  const req = requests.map(escape).join('|')
  return [
    { id: 'raw-request-json', re: new RegExp(`\\b(?:${req})(?:\\.clone\\(\\))?\\.json\\s*\\(`) },
    { id: 'read-json-body', re: /\breadJsonBody\s*[<(]/ },
    { id: 'body-spread', re: new RegExp(`\\.\\.\\.\\s*\\(?\\s*(?:await\\s+)?(?:${names.map(escape).join('|')})\\b(?:\\??\\.[\\w$]+|\\[[^\\]]*\\])*(?![\\w$]|\\??\\.[\\w$]|\\[)(?!\\s*(?:\\?(?![.?])|&&|\\|\\||[=!]==?|[<>]))`) },
    { id: 'body-spread', re: new RegExp(`\\.\\.\\.\\s*\\(?\\s*await\\s+(?:${req}|readJsonBody|readApiBody)`) },
    // `Object.assign(target, body.value)` is a spread by another name.
    { id: 'body-spread', re: new RegExp(`\\bObject\\.assign\\s*\\([^;]*?[(,]\\s*(?:${names.map(escape).join('|')})\\b(?:\\??\\.[\\w$]+|\\[[^\\]]*\\])*\\s*[,)]`) },
    // The whole body handed to another function (`setDoc(ref, body.value)`, `save(data)`): that function would see
    // every key the caller sent.
    // Handing it to a parser (`safeParse(body.value)`, `parseAccountDeleteBody(body.value)`) is how it is narrowed.
    { id: 'body-pass-through', re: objects.length
      ? new RegExp(`(?:(?<!\\b(?:safeParse|parse[\\w$]*)\\s*)\\(|,)\\s*(?:${objects.map(escape).join('|')})(?:\\.value)?\\s*(?:as\\s+[\\w$<>\\[\\]{}|&, ]+)?[,)]`)
      : /(?!)/ },
  ]
}

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

/** Every hit under `root/app/api`: `{ path, line, pattern, text }`. Import lines are not scanned. */
export function scan(root) {
  const hits = []
  for (const file of walk(join(root, 'app', 'api'), [])) {
    const path = relative(root, file).split('\\').join('/')
    const source = readFileSync(file, 'utf8')
    const code = source
      .split('\n')
      .map(stripComment)
      .join('\n')
    const patterns = patternsFor(code)
    source.split('\n').forEach((raw, index) => {
      const line = stripComment(raw)
      if (!line || /^\s*import\b/.test(line)) return
      const seen = new Set()
      for (const { id, re } of patterns) {
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

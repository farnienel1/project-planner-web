#!/usr/bin/env node
/**
 * Rulebook 1.16.0 (§13): one-off clean-up so every device push token sits on exactly one users document.
 *
 * Older iOS builds mirrored tokens onto other users documents (same email, other companies) and sign-out sweeps
 * timed out, so one phone could receive pushes addressed to another account — rows that no inbox of the person on
 * that phone ever lists. This keeps each token only on the users document that registered a token most recently
 * (`pushTokenUpdatedAt`, else `updatedAt`) and removes it from the others, with the rulebook's own
 * `pushTokenDedupePlan` read from the packed script. From 1.16.0 the `pushTokenSingleOwner` Cloud Function keeps it
 * that way. 1.17.0: an invite placeholder users document (UUID-shaped id) always loses its tokens, signed-in
 * accounts are compared by `pushTokenUpdatedAt` (`updatedAt` only when none has it), and a token held only by
 * placeholders is removed everywhere.
 *
 *   node scripts/dedupe-push-tokens.mjs --project <firebaseProjectId>            # dry run (default)
 *   node scripts/dedupe-push-tokens.mjs --project <firebaseProjectId> --apply    # write
 *
 * - Credentials: Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it
 *   against the emulator. `firebase-admin` comes from this repo, else `functions/node_modules`.
 * - Reads every `users` document that has `pushTokens` (one collection read). Writes only
 *   `pushTokens: arrayRemove(...)` on the documents that lose a token — no other field, no write metadata.
 * - Idempotent: a second run reports 0 changes. Prints token suffixes only, never whole tokens.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const projectId = arg('--project')
const apply = process.argv.includes('--apply')
if (!projectId) {
  console.error('Usage: node scripts/dedupe-push-tokens.mjs --project <firebaseProjectId> [--apply]')
  process.exit(2)
}

function loadAdmin() {
  for (const base of [path.join(root, 'package.json'), path.join(root, 'functions', 'package.json')]) {
    try {
      const require = createRequire(base)
      return { app: require('firebase-admin/app'), firestore: require('firebase-admin/firestore') }
    } catch {
      /* try the next location */
    }
  }
  console.error('firebase-admin is not installed. Run `cd functions && npm ci` (or `npm i --no-save firebase-admin`).')
  process.exit(2)
}

function loadRulebook() {
  const source = readFileSync(path.join(root, 'lib/canonical/dist/canonical-business.js'), 'utf8')
  const context = vm.createContext({})
  vm.runInContext(source, context)
  const rulebook = context.ProjectPlannerCanonical
  if (!rulebook || typeof rulebook.pushTokenDedupePlan !== 'function') {
    console.error('The packed rulebook has no pushTokenDedupePlan. Run `npm run build:canonical` first.')
    process.exit(2)
  }
  return rulebook
}

const suffix = (token) => String(token).slice(-10)

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const snap = await db.collection('users').get()
const documents = []
for (const doc of snap.docs) {
  const data = doc.data() || {}
  if (rulebook.pushTokenList(data.pushTokens).length === 0) continue
  documents.push({ id: doc.id, pushTokens: data.pushTokens, pushTokenUpdatedAt: data.pushTokenUpdatedAt, updatedAt: data.updatedAt })
}
const plan = rulebook.pushTokenDedupePlan(documents)
console.log(`${documents.length} users documents hold tokens; ${plan.length} lose at least one token.`)
for (const row of plan) {
  const detail = row.remove.map((token) => `…${suffix(token)} → ${row.keptOn[token] ? `kept on ${row.keptOn[token]}` : 'removed everywhere (placeholders only)'}`).join(', ')
  console.log(`- users/${row.userId}: ${detail}`)
}
if (!apply) {
  console.log('Dry run: nothing written. Re-run with --apply to remove these tokens.')
  process.exit(0)
}
let batch = db.batch()
let pending = 0
for (const row of plan) {
  batch.update(db.doc(`users/${row.userId}`), { pushTokens: firestore.FieldValue.arrayRemove(...row.remove) })
  pending += 1
  if (pending === 400) {
    await batch.commit()
    batch = db.batch()
    pending = 0
  }
}
if (pending > 0) await batch.commit()
console.log(`Applied: ${plan.length} users documents updated.`)

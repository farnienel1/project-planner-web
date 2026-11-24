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
 *
 * Extra options (owner report 23 Nov: one line manager held 8 tokens and got 2 pushes per notice):
 *   --user <uid>     only this users document (the ownership plan is still worked out over every document).
 *   --validate       also ask FCM about every remaining token with a dry-run send (validate only: nothing is
 *                    delivered) and remove the tokens FCM reports as dead — the push function's own rule
 *                    (functions/prunePushTokens.js). A credential failure stops the run and removes nothing.
 *                    FCM may still accept a token of an app that was deleted, so this can find nothing.
 *   --keep-newest    with --user only: keep the first stored token (the iPhone writes its current token first)
 *                    and remove the others. Every other phone of that person adds its token again the next time
 *                    the app is opened. Open the app on the phone you use first.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { keepNewestPlan, mergeRemovals, storedTokenList, storedValuesMatching, tokenSuffix, validationMessage, validationResult } from './dedupe-push-tokens/plan.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const projectId = arg('--project')
const apply = process.argv.includes('--apply')
const onlyUser = arg('--user')
const validate = process.argv.includes('--validate')
const keepNewest = process.argv.includes('--keep-newest')
if (!projectId || (keepNewest && !onlyUser)) {
  console.error('Usage: node scripts/dedupe-push-tokens.mjs --project <firebaseProjectId> [--user <uid>] [--validate] [--keep-newest] [--apply]')
  console.error('--keep-newest needs --user.')
  process.exit(2)
}

function loadAdmin() {
  for (const base of [path.join(root, 'package.json'), path.join(root, 'functions', 'package.json')]) {
    try {
      const require = createRequire(base)
      return {
        app: require('firebase-admin/app'),
        firestore: require('firebase-admin/firestore'),
        messaging: require('firebase-admin/messaging'),
      }
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

/** The push function's own "this token is dead" rule, so the script and the function never disagree. */
function loadFailureRules() {
  const require = createRequire(path.join(root, 'functions', 'package.json'))
  const { isTerminalPushTokenFailure, isCredentialPushFailure } = require('./prunePushTokens.js')
  return { isTerminal: isTerminalPushTokenFailure, isCredential: isCredentialPushFailure }
}

const rulebook = loadRulebook()
const { app, firestore, messaging } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const snap = await db.collection('users').get()
const documents = []
for (const doc of snap.docs) {
  const data = doc.data() || {}
  if (rulebook.pushTokenList(data.pushTokens).length === 0) continue
  documents.push({ id: doc.id, pushTokens: data.pushTokens, pushTokenUpdatedAt: data.pushTokenUpdatedAt, updatedAt: data.updatedAt })
}
if (onlyUser && !documents.some((row) => row.id === onlyUser)) {
  console.log(`users/${onlyUser} holds no push tokens (or does not exist). Nothing to do.`)
  process.exit(0)
}
const inScope = (userId) => !onlyUser || userId === onlyUser

// 1. One owner per token (rulebook 1.16.0 / 1.17.0).
const plan = rulebook.pushTokenDedupePlan(documents).filter((row) => inScope(row.userId))
let removals = new Map()
console.log(`${documents.length} users documents hold tokens; ${plan.length} in scope lose a token to another account.`)
for (const row of plan) {
  const detail = row.remove.map((token) => `…${tokenSuffix(token)} → ${row.keptOn[token] ? `kept on ${row.keptOn[token]}` : 'removed everywhere (placeholders only)'}`).join(', ')
  console.log(`- users/${row.userId}: ${detail}`)
  const stored = documents.find((doc) => doc.id === row.userId)
  removals = mergeRemovals(removals, row.userId, storedValuesMatching(stored ? stored.pushTokens : [], row.remove))
}

// Exact stored values, so what is removed is exactly what is stored.
const remainingFor = (row) => storedTokenList(row.pushTokens).filter((token) => !(removals.get(row.id) || []).includes(token))

// 2. --keep-newest: one named person keeps only their first stored token.
if (keepNewest) {
  const row = documents.find((doc) => doc.id === onlyUser)
  const { keep, remove } = keepNewestPlan(remainingFor(row))
  console.log(`--keep-newest users/${onlyUser}: keeps …${tokenSuffix(keep[0] || '')}; removes ${remove.length}: ${remove.map((t) => `…${tokenSuffix(t)}`).join(', ') || 'none'}`)
  removals = mergeRemovals(removals, onlyUser, storedValuesMatching(row.pushTokens, remove))
}

// 3. --validate: dry-run send to every remaining token; remove only the ones FCM reports as dead.
if (validate) {
  const rules = loadFailureRules()
  const fcm = messaging.getMessaging()
  for (const row of documents.filter((doc) => inScope(doc.id))) {
    const tokens = remainingFor(row)
    if (tokens.length === 0) continue
    // FCM gets the trimmed token; the stored value (exact) is what is removed.
    const result = await fcm.sendEach(tokens.map((token) => validationMessage(token.trim())), true)
    const { dead, otherFailures, credentialProblem } = validationResult(tokens, result.responses, rules)
    if (credentialProblem) {
      console.error('FCM refused the project credentials (APNs key / sender). Nothing is removed. Check Firebase console → Project settings → Cloud Messaging.')
      process.exit(1)
    }
    console.log(`validate users/${row.id}: ${tokens.length} token(s), ${dead.length} dead${otherFailures.length ? `, ${otherFailures.length} other failure(s) kept` : ''}${dead.length ? `: ${dead.map((t) => `…${tokenSuffix(t)}`).join(', ')}` : ''}`)
    removals = mergeRemovals(removals, row.id, storedValuesMatching(row.pushTokens, dead))
  }
}

const totalTokens = [...removals.values()].reduce((sum, list) => sum + list.length, 0)
console.log(`Plan: remove ${totalTokens} token(s) from ${removals.size} users document(s).`)
if (!apply) {
  console.log('Dry run: nothing written. Re-run with --apply to remove these tokens.')
  process.exit(0)
}
let batch = db.batch()
let pending = 0
for (const [userId, remove] of removals) {
  batch.update(db.doc(`users/${userId}`), { pushTokens: firestore.FieldValue.arrayRemove(...remove) })
  pending += 1
  if (pending === 400) {
    await batch.commit()
    batch = db.batch()
    pending = 0
  }
}
if (pending > 0) await batch.commit()
console.log(`Applied: ${removals.size} users documents updated.`)

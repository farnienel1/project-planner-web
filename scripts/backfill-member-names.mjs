#!/usr/bin/env node
/**
 * Rulebook 1.82.0 §11 "Names per organisation" (owner answer 24 Nov, item 3; docs/RULEBOOK.md "Deploy notes" 1.82.0):
 * one-off backfill of `organizations/{orgId}/memberNames/{uid}` for people who are already members.
 *
 * From 1.82.0 a name edit in one organisation writes only that organisation's entry (and, in the person's home
 * organisation, their users document). An organisation with no entry for someone still falls back to the users
 * document's name, so a later home edit would show there too. This script gives every existing member their own entry
 * in each organisation they belong to, with the name that organisation shows them today (nothing anyone sees changes).
 * The entries are the rulebook's `memberNameBackfillEntries` (read from the packed script); the members are the users
 * documents naming the organisation, the keys of its `members` map and its creator.
 *
 *   node scripts/backfill-member-names.mjs --project <firebaseProjectId> --org <orgId>      # dry run (default)
 *   node scripts/backfill-member-names.mjs --project <firebaseProjectId> --all              # dry run, every org
 *   node scripts/backfill-member-names.mjs --project <firebaseProjectId> --all --apply      # write
 *
 * - Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 *   GOOGLE_APPLICATION_CREDENTIALS. FIRESTORE_EMULATOR_HOST runs it against the emulator.
 * - `firebase-admin` is resolved from this repo, else from `functions/node_modules` (`cd functions && npm ci`).
 * - Creates only missing documents (`create`, never set or merge): an entry already there is never changed.
 *   Idempotent: a second run reports 0 to create. Prints ids only, never names or emails.
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
  if (index < 0) return null
  const value = process.argv[index + 1]
  // Review of #370 (N4): a flag with no value, or followed by another flag, is refused (never read as "--all").
  if (!value || value.startsWith('--')) {
    console.error(`${flag} needs a value.`)
    process.exit(2)
  }
  return value
}

const projectId = arg('--project')
const onlyOrg = arg('--org')
const all = process.argv.includes('--all')
const apply = process.argv.includes('--apply')

if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/backfill-member-names.mjs --project <firebaseProjectId> (--org <id> | --all) [--dry-run | --apply]')
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
  if (!rulebook || typeof rulebook.memberNameBackfillEntries !== 'function' || typeof rulebook.parseMemberNameDocuments !== 'function') {
    console.error('The packed rulebook has no memberNameBackfillEntries (1.82.0). Run `npm run build:canonical` first.')
    process.exit(2)
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  const org = orgSnap.data() || {}
  const ids = new Set()
  const people = []
  const add = (id, data) => {
    if (!id || ids.has(id.toLowerCase())) return
    ids.add(id.toLowerCase())
    people.push({ id, ...data })
  }
  for (const doc of (await db.collection('users').where('organizationId', '==', orgId).get()).docs) add(doc.id, doc.data() || {})
  const anchored = [...Object.keys(org.members && typeof org.members === 'object' ? org.members : {}), String(org.creatorUserId || '')]
  for (const id of anchored) {
    if (!id || ids.has(id.toLowerCase())) continue
    const snap = await db.collection('users').doc(id).get()
    if (snap.exists) add(id, snap.data() || {})
  }
  const namesCollection = orgRef.collection(rulebook.MEMBER_NAMES_COLLECTION)
  const names = rulebook.parseMemberNameDocuments((await namesCollection.get()).docs.map((doc) => ({ id: doc.id, data: doc.data() || {} })))
  const entries = rulebook.memberNameBackfillEntries({ people, names })
  for (const entry of entries) {
    console.log(`  ${apply ? 'create' : 'would create'} organizations/${orgId}/memberNames/${entry.userId}`)
    if (apply) {
      await namesCollection
        .doc(entry.userId)
        .create({
          firstName: entry.firstName,
          surname: entry.surname,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        })
        .catch((error) => {
          if (!(error && (error.code === 6 || /ALREADY_EXISTS/.test(String(error.message))))) throw error
        })
    }
  }
  console.log(`org ${orgId}: ${people.length} members, ${entries.length} ${apply ? 'created' : 'to create'}`)
  return entries.length
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
let total = 0
for (const orgId of orgIds) total += await backfillOrg(orgId)
console.log(`Summary: ${total} ${apply ? 'created' : 'to create'}.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`)

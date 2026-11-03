#!/usr/bin/env node
/**
 * Rulebook 1.10.0 (§16, §17; docs/DEPLOY_1.10.0.md): one-off backfill of `managerUserIds` on every existing job.
 *
 * The 1.10.0 security rules let a manager without the Projects / Small works toggle read a job only when its
 * `managerUserIds` holds their account id, and the apps query jobs with `managerUserIds array-contains <uid>`.
 * Jobs saved before 1.10.0 have only `managerIds` / `managerId` (account ids, `user:` ids or managers-list rows).
 * This script computes `managerUserIds` with the rulebook's own `jobManagerUserIds(job, managers, accounts)` — read
 * from the packed script, so it is exactly the rule both apps run — and writes only that field.
 *
 *   node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --org <orgId>      # dry run (default)
 *   node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all              # dry run, every org
 *   node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> --all --apply      # write
 *
 * - Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 *   GOOGLE_APPLICATION_CREDENTIALS. FIRESTORE_EMULATOR_HOST runs it against the emulator.
 * - `firebase-admin` is resolved from this repo, else from `functions/node_modules` (`cd functions && npm ci`).
 * - Writes only `managerUserIds`, as a partial update (`update`, never `set`), and only when the computed list differs
 *   from the stored one (order and case kept as `jobManagerUserIds` returns them). No write metadata: `updatedFrom`
 *   accepts only `web` / `ios` / `android` (`writeMetadataFields`), and a script is none of them.
 * - Idempotent: a second run reports 0 changes. A job whose computed list is empty is left alone (never cleared).
 * - Prints one line per changed job (`+` added ids, `-` removed ids) and a summary per organisation.
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
const onlyOrg = arg('--org')
const all = process.argv.includes('--all')
const apply = process.argv.includes('--apply')

if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/backfill-job-manager-user-ids.mjs --project <firebaseProjectId> (--org <id> | --all) [--dry-run | --apply]')
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
  if (!rulebook || typeof rulebook.jobManagerUserIds !== 'function') {
    console.error('The packed rulebook has no jobManagerUserIds. Run `npm run build:canonical` first.')
    process.exit(2)
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

async function accountsFor(orgId, orgData) {
  const byId = new Map()
  const snap = await db.collection('users').where('organizationId', '==', orgId).get()
  for (const doc of snap.docs) byId.set(doc.id, doc.data())
  // Members of this organisation whose users document names another company (multi-company accounts).
  const memberIds = Object.keys(orgData?.members && typeof orgData.members === 'object' ? orgData.members : {})
  for (const id of memberIds) {
    if (byId.has(id)) continue
    const doc = await db.collection('users').doc(id).get()
    if (doc.exists) byId.set(doc.id, doc.data())
  }
  return [...byId].map(([id, data]) => ({
    id,
    email: typeof data?.email === 'string' ? data.email : null,
    isActive: data?.isActive === false ? false : null,
  }))
}

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) {
    console.log(`org ${orgId}: not found`)
    return { jobs: 0, changed: 0, empty: 0 }
  }
  const managersSnap = await orgRef.collection('managers').get()
  const managers = managersSnap.docs.map((doc) => ({ id: doc.id, email: doc.data()?.email ?? null }))
  const accounts = await accountsFor(orgId, orgSnap.data())
  const totals = { jobs: 0, changed: 0, empty: 0 }
  for (const collection of ['projects', 'smallWorks']) {
    const jobs = await orgRef.collection(collection).get()
    let batch = db.batch()
    let pending = 0
    for (const job of jobs.docs) {
      totals.jobs += 1
      const data = job.data() || {}
      const stored = Array.isArray(data.managerUserIds) ? data.managerUserIds.filter((id) => typeof id === 'string') : []
      const next = rulebook.jobManagerUserIds(data, managers, accounts)
      if (next.length === 0) {
        if (rulebook.jobManagerIds(data).length > 0 && stored.length === 0) {
          totals.empty += 1
          console.log(`  ? ${collection}/${job.id}: managers ${JSON.stringify(rulebook.jobManagerIds(data))} match no active account`)
        }
        continue
      }
      if (sameList(stored, next)) continue
      totals.changed += 1
      const added = next.filter((id) => !stored.includes(id))
      const removed = stored.filter((id) => !next.includes(id))
      console.log(`  ${apply ? 'write' : 'would write'} ${collection}/${job.id}: +${JSON.stringify(added)} -${JSON.stringify(removed)} → ${JSON.stringify(next)}`)
      if (apply) {
        batch.update(job.ref, { managerUserIds: next })
        pending += 1
        if (pending === 400) {
          await batch.commit()
          batch = db.batch()
          pending = 0
        }
      }
    }
    if (apply && pending > 0) await batch.commit()
  }
  console.log(`org ${orgId}: ${totals.jobs} jobs, ${totals.changed} ${apply ? 'updated' : 'to update'}, ${totals.empty} with managers that match no account`)
  return totals
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
const sum = { jobs: 0, changed: 0, empty: 0 }
for (const orgId of orgIds) {
  const totals = await backfillOrg(orgId)
  sum.jobs += totals.jobs
  sum.changed += totals.changed
  sum.empty += totals.empty
}
console.log(`Summary: ${sum.jobs} jobs, ${sum.changed} ${apply ? 'updated' : 'to update'}, ${sum.empty} unresolved.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`)

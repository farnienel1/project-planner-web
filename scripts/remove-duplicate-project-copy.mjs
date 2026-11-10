#!/usr/bin/env node
/**
 * One-off, owner-run clean-up for ONE job stored under the same id in both `projects` and `smallWorks` (older iOS
 * builds did this; rulebook §17 "Job kind", `jobIdsInBothCollections`). DRY RUN BY DEFAULT.
 * Owner steps: docs/scripts/remove-duplicate-project-copy.md.
 *
 *   node scripts/remove-duplicate-project-copy.mjs --project <firebaseProjectId> --org <orgId> --job <jobId>            # dry run
 *   node scripts/remove-duplicate-project-copy.mjs --project <firebaseProjectId> --org <orgId> --job <jobId> --apply    # delete
 *   ... --keep smallWorks|projects   # which copy stays (default smallWorks; the other copy is the one removed)
 *   ... --force-refs                 # delete even when records still name the removed copy's collection (never rewritten)
 *   ... --backup-dir <folder>        # where the JSON backup goes (default ./cleanup-backups)
 *
 * What it does (the decisions are `scripts/remove-duplicate-project-copy/plan.mjs`, pure and tested):
 * - Refuses unless the job id (compared without case) is in BOTH collections of that organisation. A second run, with
 *   only the kept copy left, prints "Nothing to do" and exits 0 (idempotent).
 * - Lists everything that refers to the job: labour, manager site and subcontractor bookings (`bookingJobId`) with
 *   their `jobCollection`; materials, send records, tasks, site audits, variations, variation trackers; the
 *   `settings` documents keyed by the job (`healthSafetyDocumentIds`, `deadlinesDocumentId`, `variations_{id}`,
 *   `deadlineAssignments`); and `worksListPicks` lists that hold the id.
 * - Refuses --apply while a booking carries `jobCollection` = the removed copy's collection, or a
 *   `settings/{healthSafety|deadlines}_{removed}_{KEY}` document holds data, unless --force-refs. Those records are
 *   never rewritten: the owner decides.
 * - With --apply: saves the removed copy and every document under it (all subcollections, read recursively) as JSON
 *   in `<backup-dir>/<timestamp>/<orgId>/001-duplicate-job-copy.json` (restorable with
 *   `node scripts/data-cleanup.mjs --project <id> --restore <that folder> [--apply]`), then deletes them in one batch
 *   (subcollection documents first, the copy last). The copy's delete carries its read `updateTime` as a precondition,
 *   so a copy changed after the read is not deleted. The kept copy is only read. No other write.
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator. `firebase-admin` comes from this
 * repo, else `functions/node_modules` — as `scripts/report-job-collection-mismatch.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { backupFileBody, loadRulebook as loadPackedRulebook, repoRoot } from './data-cleanup/checks.mjs'
import {
  JOB_COLLECTIONS,
  REFERENCE_COLLECTIONS,
  RULEBOOK_FUNCTIONS,
  formatPlan,
  keepAndRemove,
  locateCopies,
  planReferences,
  planRemoval,
  settingsDocumentIds,
} from './remove-duplicate-project-copy/plan.mjs'

const CHECK_ID = 'duplicate-job-copy'
const BATCH_LIMIT = 400
const USAGE = `Usage:
  node scripts/remove-duplicate-project-copy.mjs --project <firebaseProjectId> --org <orgId> --job <jobId> [--keep smallWorks|projects] [--apply] [--force-refs] [--backup-dir <folder>]
Without --apply nothing is written.`

/** The value after `flag`, or null when absent. A flag with no value is an error, never the next flag. */
function arg(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--') || value.trim() === '') {
    console.error(`${flag} needs a value.\n${USAGE}`)
    process.exit(2)
  }
  return value.trim()
}

const projectId = arg('--project')
const orgId = arg('--org')
const jobId = arg('--job')
const keep = arg('--keep') || 'smallWorks'
const apply = process.argv.includes('--apply')
const forceRefs = process.argv.includes('--force-refs')
const backupRoot = path.resolve(arg('--backup-dir') || 'cleanup-backups')

if (!projectId || !orgId || !jobId) {
  console.error(USAGE)
  process.exit(2)
}
if (!keepAndRemove(keep)) {
  console.error(`--keep must be "smallWorks" or "projects", not "${keep}".\n${USAGE}`)
  process.exit(2)
}
if (orgId.includes('/') || jobId.includes('/')) {
  console.error('--org and --job are document ids and cannot contain "/".')
  process.exit(2)
}

function loadRulebook() {
  const rulebook = loadPackedRulebook()
  const missing = RULEBOOK_FUNCTIONS.filter((name) => typeof rulebook[name] !== 'function')
  if (missing.length > 0) {
    console.error(`The packed rulebook is missing ${missing.join(', ')}. Run \`npm run build:canonical\` first.`)
    process.exit(2)
  }
  return rulebook
}

function loadAdmin() {
  for (const base of [path.join(repoRoot, 'package.json'), path.join(repoRoot, 'functions', 'package.json')]) {
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

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const asDoc = (snap) => ({ id: snap.id, path: snap.ref.path, data: snap.data() || {}, updateTime: snap.updateTime })

/** Every document under `ref`, through every subcollection at any depth. */
async function descendants(ref) {
  const out = []
  for (const sub of await ref.listCollections()) {
    for (const snap of (await sub.get()).docs) {
      out.push(asDoc(snap))
      out.push(...(await descendants(snap.ref)))
    }
  }
  return out
}

function iso(value) {
  const ms = value === undefined || value === null ? null : rulebook.documentInstantMs(value)
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : '-'
}

const describe = (doc) => {
  const d = doc.data || {}
  return `jobNumber=${d.jobNumber ?? '-'} siteName=${d.siteName ?? '-'} jobType=${d.jobType ?? '-'} createdAt=${iso(d.createdAt)} updatedAt=${iso(d.updatedAt)} updatedFrom=${d.updatedFrom ?? '-'}`
}

async function main() {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) {
    console.error(`organizations/${orgId} was not found in project ${projectId}. Nothing written.`)
    process.exit(1)
  }

  // Job documents: the whole (small) collections, so an id in another letter case is found too.
  const jobs = {}
  for (const collection of JOB_COLLECTIONS) {
    jobs[collection] = (await orgRef.collection(collection).get()).docs.map(asDoc).filter((doc) => rulebook.normalizeDocumentId(doc.id) === rulebook.normalizeDocumentId(jobId))
  }
  const copies = locateCopies(rulebook, { jobId, keep, jobs })
  console.log(`${apply ? 'APPLY' : 'DRY RUN (nothing is written)'} — project ${projectId}`)
  if (copies.state === 'already-done') {
    console.log(`Organisation ${orgId} — job ${jobId}\n  ${copies.message}`)
    return
  }
  if (copies.state !== 'ready') {
    console.error(`Organisation ${orgId} — job ${jobId}\n  REFUSED: ${copies.message} Nothing written.`)
    process.exit(1)
  }

  // References: read only. Whole collections of this organisation; ids compared without case in the plan.
  const refs = {}
  for (const collection of REFERENCE_COLLECTIONS) refs[collection] = (await orgRef.collection(collection).get()).docs.map((snap) => ({ id: snap.id, data: snap.data() || {} }))
  refs.settings = []
  for (const id of settingsDocumentIds(rulebook, copies.kept.id)) {
    const snap = await orgRef.collection('settings').doc(id).get()
    refs.settings.push({ id, exists: snap.exists, data: snap.exists ? snap.data() || {} : {} })
  }
  const references = planReferences(rulebook, { jobId: copies.kept.id, removedCollection: copies.remove, refs })

  const removedRef = db.doc(copies.removed.path)
  const subcollectionDocs = await descendants(removedRef)
  const removal = planRemoval({ copies, references, removedPath: copies.removed.path, subcollectionDocs, apply, forceRefs })

  console.log(formatPlan({ orgId, jobId, copies, references, removal, row: describe }))
  console.log('')
  console.log('This hides no live data: the job stays in the kept collection with every record above.')

  if (!apply) {
    console.log(removal.refusal)
    return
  }
  if (!removal.canApply) {
    console.error(`REFUSED: ${removal.refusal} Nothing written.`)
    process.exit(1)
  }
  if (removal.deletePaths.length > BATCH_LIMIT) {
    console.error(`REFUSED: ${removal.deletePaths.length} documents to delete is more than one batch (${BATCH_LIMIT}). Nothing written; ask Claude.`)
    process.exit(1)
  }

  // Backup first: every document that will be deleted, Firestore types tagged so data-cleanup --restore rebuilds them.
  const byPath = new Map([[copies.removed.path, copies.removed], ...subcollectionDocs.map((doc) => [doc.path, doc])])
  const stamp = new Date().toISOString()
  const dir = path.join(backupRoot, stamp.replace(/[:.]/g, '-'), orgId)
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `001-${CHECK_ID}.json`)
  const body = backupFileBody({
    projectId,
    orgId,
    check: CHECK_ID,
    createdAt: stamp,
    sequence: 1,
    documents: removal.deletePaths.map((p) => {
      if (!byPath.has(p)) throw new Error(`No backup copy for ${p}; refusing to write.`)
      return { path: p, data: byPath.get(p).data }
    }),
  })
  writeFileSync(file, JSON.stringify(body, null, 2))
  console.log(`Backup written: ${file}`)

  const batch = db.batch()
  for (const p of removal.deletePaths) {
    const doc = byPath.get(p)
    batch.delete(db.doc(p), doc.updateTime ? { lastUpdateTime: doc.updateTime } : undefined)
  }
  try {
    await batch.commit()
  } catch (error) {
    console.error(`The delete was refused (${error.code ?? ''} ${error.message}). Nothing was deleted (one batch). Run the script again.`)
    process.exit(1)
  }
  console.log(`Deleted ${removal.deletePaths.length} document(s). The ${copies.keep} copy ${copies.keep}/${copies.kept.id} was not touched.`)
  console.log(`Undo: node scripts/data-cleanup.mjs --project ${projectId} --restore ${path.dirname(dir)} --apply`)
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}. Nothing further was written.`)
  process.exit(1)
})

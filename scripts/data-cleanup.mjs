#!/usr/bin/env node
/**
 * Launch checklist 2.3 — owner-run clean-ups of old records. DRY RUN BY DEFAULT.
 *
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId>                         # dry run, every check, every org
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId> --org <orgId>           # dry run, one organisation
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId> --only <check>          # dry run, one check
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId> --only <check> --apply  # write (backups first)
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId> --restore cleanup-backups/<stamp>          # restore dry run
 *   node scripts/data-cleanup.mjs --project <firebaseProjectId> --restore cleanup-backups/<stamp> --apply  # restore
 *   node scripts/data-cleanup.mjs --list
 *
 * The checks and their decisions are `scripts/data-cleanup/checks.mjs` (pure, tested); README "Data clean-up" has the
 * owner steps. What every write does:
 * - Partial updates only (`update`, never `set`), of the fields the check names, plus write metadata
 *   (`writeMetadataFields('cleanup-script', 'web')` → `updatedBy`, `updatedFrom`, and `updatedAt` = server time).
 * - Each write carries the document's `updateTime` from the read as a precondition: if anyone changed the document
 *   after the read, Firestore refuses that batch and nothing in it is written. Run the script again (it is idempotent).
 * - Batches of at most 400 writes.
 * - Deletes only documents a check names as a known placeholder.
 * - Before any write, every document the check will change or delete is saved as JSON in
 *   `./cleanup-backups/<timestamp>/<orgId>/<check>.json` (`--backup-dir` changes the folder).
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator. `firebase-admin` comes from this
 * repo, else `functions/node_modules` — as `scripts/dedupe-push-tokens.mjs`.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  CHECKS,
  PLACEHOLDER_COLLECTIONS,
  backupFileBody,
  checkById,
  decodeValue,
  formatReport,
  loadRulebook,
  plannedPaths,
  repoRoot,
} from './data-cleanup/checks.mjs'

const BATCH_LIMIT = 400
const CLEANUP_ACTOR = 'cleanup-script'
const CLEANUP_PLATFORM = 'web'

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const USAGE = `Usage:
  node scripts/data-cleanup.mjs --project <firebaseProjectId> [--org <orgId>] [--only <check>] [--samples <n>] [--apply]
  node scripts/data-cleanup.mjs --project <firebaseProjectId> --restore <backup folder> [--apply]
  node scripts/data-cleanup.mjs --list`

if (process.argv.includes('--list')) {
  for (const check of CHECKS) console.log(`${check.id.padEnd(26)} ${check.title}\n${' '.repeat(27)}writes: ${check.writes}`)
  process.exit(0)
}

const projectId = arg('--project')
const apply = process.argv.includes('--apply')
const onlyOrg = arg('--org')
const only = arg('--only')
const restoreDir = arg('--restore')
const samples = Math.max(1, Number(arg('--samples') || 5) || 5)
const backupRoot = path.resolve(arg('--backup-dir') || 'cleanup-backups')

if (!projectId) {
  console.error(USAGE)
  process.exit(2)
}
const selected = only ? only.split(',').map((id) => id.trim()).filter(Boolean) : CHECKS.map((check) => check.id)
const unknown = selected.filter((id) => !checkById(id))
if (unknown.length > 0) {
  console.error(`Unknown check: ${unknown.join(', ')}. Run with --list to see the checks.`)
  process.exit(2)
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
const stamp = rulebook.rulebookStamp()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()
const { FieldPath, FieldValue } = firestore

// ─── restore ───────────────────────────────────────────────────────────────────────────────────────────────────────

function backupFiles(dir) {
  if (!statSync(dir).isDirectory()) return [dir]
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...backupFiles(full))
    else if (name.endsWith('.json')) out.push(full)
  }
  return out
}

async function restore(dir) {
  const files = backupFiles(path.resolve(dir))
  if (files.length === 0) {
    console.error(`No backup files in ${dir}.`)
    process.exit(2)
  }
  const types = { Timestamp: firestore.Timestamp, GeoPoint: firestore.GeoPoint, reference: (p) => db.doc(p) }
  const documents = []
  for (const file of files) {
    const body = JSON.parse(readFileSync(file, 'utf8'))
    if (body.projectId !== projectId) {
      console.error(`${file} was taken from project "${body.projectId}", not "${projectId}". Nothing restored.`)
      process.exit(2)
    }
    for (const doc of body.documents || []) {
      documents.push({ path: doc.path, data: decodeValue(doc.data, types), file, sequence: Number(body.sequence) || 0 })
    }
  }
  // One document can be in several files of one run (three checks change the organisation document). Each file holds
  // it as it was before that check, so the earliest (lowest `sequence`) is the state before the whole run.
  documents.sort((a, b) => a.sequence - b.sequence)
  const seen = new Set()
  const earliest = documents.filter((doc) => !seen.has(doc.path) && seen.add(doc.path))
  documents.length = 0
  documents.push(...earliest)
  console.log(`Restore — ${apply ? 'APPLY (writing)' : 'DRY RUN (nothing is written)'}: ${documents.length} document(s) from ${files.length} file(s).`)
  for (const doc of documents.slice(0, 20)) console.log(`  restore ${doc.path}  (${path.relative(process.cwd(), doc.file)})`)
  if (documents.length > 20) console.log(`  …and ${documents.length - 20} more`)
  if (!apply) {
    console.log('Dry run: nothing was written. Re-run with --apply to put these documents back exactly as backed up.')
    return
  }
  // A restore puts the whole document back as it was before the clean-up (the one place a full `set` is right):
  // any change made to it after the clean-up is replaced.
  for (let i = 0; i < documents.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const doc of documents.slice(i, i + BATCH_LIMIT)) batch.set(db.doc(doc.path), doc.data)
    await batch.commit()
  }
  console.log(`Restored ${documents.length} document(s).`)
}

if (restoreDir) {
  await restore(restoreDir)
  process.exit(0)
}

// ─── load ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const asDoc = (snap) => ({ id: snap.id, path: snap.ref.path, data: snap.data() || {}, updateTime: snap.updateTime })

/** Reads what one check needs for one organisation. `meta` collects each document's `updateTime` by path. */
async function loadInput(check, orgId, meta) {
  const orgRef = db.collection('organizations').doc(orgId)
  const remember = (docs) => {
    for (const doc of docs) meta.set(doc.path, doc.updateTime)
    return docs.map(({ id, data }) => ({ id, data }))
  }
  const input = { orgId }
  if (check.reads.includes('org')) {
    const snap = await orgRef.get()
    input.org = snap.exists ? remember([asDoc(snap)])[0] : null
  }
  if (check.reads.includes('bookings')) {
    input.bookings = remember((await orgRef.collection('bookings').get()).docs.map(asDoc))
  }
  if (check.reads.includes('tombstones')) {
    input.tombstoneIds = (await orgRef.collection(rulebook.BOOKING_TOMBSTONE_COLLECTION || 'deletedBookings').select().get()).docs.map((doc) => doc.id)
  }
  if (check.reads.includes('placeholders')) {
    input.collections = {}
    const exact = rulebook.LEGACY_PLACEHOLDER_DOCUMENT_ID || 'INITIAL-PLACEHOLDER'
    for (const name of PLACEHOLDER_COLLECTIONS) {
      // Exact id plus the lower-case spelling; other spellings are not looked for (a whole-collection read per org).
      const snaps = await Promise.all([exact, exact.toLowerCase()].map((id) => orgRef.collection(name).doc(id).get()))
      input.collections[name] = remember(snaps.filter((snap) => snap.exists).map(asDoc))
    }
  }
  if (check.reads.includes('users')) {
    input.users = remember((await db.collection('users').where('organizationId', '==', orgId).get()).docs.map(asDoc))
    try {
      input.claimedEmails = (await orgRef.collection('userEmails').select().get()).docs.map((doc) => doc.id)
    } catch {
      input.claimedEmails = null // a failed read never marks anyone as a leftover
    }
  }
  return input
}

// ─── write ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function writeBackup(orgId, checkId, plan, input) {
  const paths = plannedPaths(plan)
  if (paths.length === 0) return null
  const byPath = new Map()
  if (input.org) byPath.set(`organizations/${orgId}`, input.org.data)
  for (const doc of input.bookings || []) byPath.set(`organizations/${orgId}/bookings/${doc.id}`, doc.data)
  for (const [name, docs] of Object.entries(input.collections || {})) {
    for (const doc of docs) byPath.set(`organizations/${orgId}/${name}/${doc.id}`, doc.data)
  }
  for (const doc of input.users || []) byPath.set(`users/${doc.id}`, doc.data)
  const documents = paths.map((p) => {
    if (!byPath.has(p)) throw new Error(`No backup copy for ${p}; refusing to write.`)
    return { path: p, data: byPath.get(p) }
  })
  const dir = path.join(backupDir, orgId)
  mkdirSync(dir, { recursive: true })
  backupSequence += 1
  const file = path.join(dir, `${String(backupSequence).padStart(3, '0')}-${checkId}.json`)
  const body = backupFileBody({ projectId, orgId, check: checkId, createdAt: runStartedAt, sequence: backupSequence, documents })
  writeFileSync(file, JSON.stringify(body, null, 2))
  return file
}

function updateArgs(row) {
  const metadata = rulebook.writeMetadataFields(CLEANUP_ACTOR, CLEANUP_PLATFORM)
  const pairs = []
  for (const [field, value] of Object.entries(row.set)) pairs.push(new FieldPath(field), value)
  for (const segments of row.remove) pairs.push(new FieldPath(...segments), FieldValue.delete())
  pairs.push(new FieldPath('updatedBy'), metadata.updatedBy)
  pairs.push(new FieldPath('updatedFrom'), metadata.updatedFrom)
  pairs.push(new FieldPath('updatedAt'), FieldValue.serverTimestamp())
  return pairs
}

/** Writes one plan in batches of at most 400; returns `{ written, failed }`. */
async function applyPlan(plan, meta) {
  const ops = [
    ...plan.updates.map((row) => (batch) => {
      const [first, firstValue, ...rest] = updateArgs(row)
      batch.update(db.doc(row.path), first, firstValue, ...rest, { lastUpdateTime: meta.get(row.path) })
    }),
    ...plan.deletes.map((row) => (batch) => batch.delete(db.doc(row.path), { lastUpdateTime: meta.get(row.path) })),
  ]
  let written = 0
  let failed = 0
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT)
    const batch = db.batch()
    for (const op of chunk) op(batch)
    try {
      await batch.commit()
      written += chunk.length
    } catch (error) {
      failed += chunk.length
      console.error(`  A batch of ${chunk.length} write(s) was refused (${error.code ?? ''} ${error.message}). Nothing in it was written; run the script again.`)
    }
  }
  return { written, failed }
}

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const runStartedAt = new Date().toISOString()
const backupDir = path.join(backupRoot, runStartedAt.replace(/[:.]/g, '-'))
let backupSequence = 0
const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').select('name').get()).docs.map((doc) => doc.id)
const results = []
let totalWritten = 0
let totalFailed = 0

for (const orgId of orgIds) {
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) {
    console.error(`organizations/${orgId} does not exist; skipped.`)
    continue
  }
  const orgName = typeof orgSnap.get('name') === 'string' ? orgSnap.get('name') : ''
  const result = { orgId, orgName, checks: [] }
  // Checks run one after another, each on a fresh read, so one check's write never makes another's precondition stale.
  for (const id of selected) {
    const check = checkById(id)
    try {
      const meta = new Map()
      const input = await loadInput(check, orgId, meta)
      const plan = check.plan(rulebook, input)
      result.checks.push({ id, plan })
      if (apply && (plan.updates.length > 0 || plan.deletes.length > 0)) {
        const file = writeBackup(orgId, id, plan, input)
        if (file) console.log(`Backup: ${path.relative(process.cwd(), file)}`)
        const { written, failed } = await applyPlan(plan, meta)
        totalWritten += written
        totalFailed += failed
      }
    } catch (error) {
      result.checks.push({ id, error: error.message })
    }
  }
  results.push(result)
}

console.log(formatReport(results, { apply, projectId, rulebookVersion: stamp.version, samples, backupDir: apply ? backupDir : null }))
if (apply) {
  console.log(`Applied: ${totalWritten} write(s)${totalFailed ? `, ${totalFailed} refused (run again)` : ''}.`)
  if (totalFailed) process.exit(1)
}
if (results.some((org) => org.checks.some((check) => check.error))) process.exit(1)

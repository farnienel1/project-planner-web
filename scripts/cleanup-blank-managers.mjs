#!/usr/bin/env node
/**
 * One-off, owner-run clean-up of the blank "Assigned manager" rows older iPhone builds created (fixed in iOS #185).
 * DRY RUN BY DEFAULT. Owner steps: docs/scripts/cleanup-blank-managers.md.
 *
 *   node scripts/cleanup-blank-managers.mjs --project <firebaseProjectId> --org <orgId>            # dry run, one org
 *   node scripts/cleanup-blank-managers.mjs --project <firebaseProjectId> --all-orgs               # dry run, every org
 *   node scripts/cleanup-blank-managers.mjs --project <firebaseProjectId> --org <orgId> --apply    # write
 *   node scripts/cleanup-blank-managers.mjs ... --apply --actor <ownerUid>                         # updatedBy = your uid
 *
 * What it does (the decisions are `scripts/cleanup-blank-managers/plan.mjs`, pure and tested):
 * - Finds `organizations/{orgId}/managers/{id}` rows with a blank or missing email, the name "Assigned manager", no
 *   linked account, nothing else typed in, an id that is no users account of the organisation and no manager site
 *   booking on it. Any other blank-email row is printed as "review" and never changed.
 * - Lists every project and small works whose manager fields (`jobManagerIds`) hold such a row's id.
 * - With --apply: takes the junk ids off those jobs (`jobManagerRemovalWrites`: `managerIds`, `managerId`,
 *   `managerUserIds`, `assignedManagerUserIds`; a list left empty is removed; `managerId` moves to the next manager or is
 *   removed) as partial updates (`update`, never `set`) with write metadata (`writeMetadataFields(actor, 'web')` →
 *   `updatedBy`, `updatedFrom`, and `updatedAt` = server time), then deletes the junk rows. Jobs left with no manager
 *   stay without one and are listed at the end.
 * - Each write carries the document's `updateTime` from the read as a precondition: if anyone changed it after the
 *   read, that batch is refused and nothing in it is written. Batches of at most 400 writes. The row deletes run only
 *   after every job update succeeded, so a job is never left pointing at a deleted row.
 * - Before any write, every document it will change or delete is saved as JSON in
 *   `./cleanup-backups/<timestamp>/<orgId>/001-blank-managers.json` (`--backup-dir` changes the folder). Undo with
 *   `node scripts/data-cleanup.mjs --project <id> --restore <that folder> [--apply]`.
 * - Idempotent: a second run plans nothing.
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator. `firebase-admin` comes from this
 * repo, else `functions/node_modules` — as `scripts/data-cleanup.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { backupFileBody, loadRulebook as loadPackedRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { JOB_COLLECTIONS, RULEBOOK_FUNCTIONS, formatReport, planOrg, plannedPaths } from './cleanup-blank-managers/plan.mjs'

const BATCH_LIMIT = 400
const CHECK_ID = 'blank-managers'
const PLATFORM = 'web'

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const USAGE = `Usage:
  node scripts/cleanup-blank-managers.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs) [--apply] [--actor <uid>] [--backup-dir <folder>]`

const projectId = arg('--project')
const onlyOrg = arg('--org')
const allOrgs = process.argv.includes('--all-orgs') || process.argv.includes('--all')
const apply = process.argv.includes('--apply')
const actor = arg('--actor') || 'cleanup-script'
const backupRoot = path.resolve(arg('--backup-dir') || 'cleanup-backups')

if (!projectId || (!onlyOrg && !allOrgs) || (onlyOrg && allOrgs)) {
  console.error(USAGE)
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
const metadata = rulebook.writeMetadataFields(actor, PLATFORM)
if (!metadata) {
  console.error(`--actor "${actor}" is not a usable user id.`)
  process.exit(2)
}
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()
const { FieldPath, FieldValue } = firestore

// ─── load ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const asDoc = (snap) => ({ id: snap.id, path: snap.ref.path, data: snap.data() || {}, updateTime: snap.updateTime })

/** Everything one organisation's plan reads. `meta` collects each document's `updateTime` and data by path. */
async function loadInput(orgId, orgData, meta) {
  const orgRef = db.collection('organizations').doc(orgId)
  const remember = (docs) => {
    for (const doc of docs) meta.set(doc.path, doc)
    return docs.map(({ id, data }) => ({ id, data }))
  }
  const managers = remember((await orgRef.collection('managers').get()).docs.map(asDoc))

  // Users accounts of the organisation: the roster query, every `members` key and the creator (read by id when their
  // users document names another company), and — for each blank-email row — a users document with that very id.
  const users = new Map()
  for (const doc of (await db.collection('users').where('organizationId', '==', orgId).get()).docs) users.set(doc.id, doc.data() || {})
  const extraIds = new Set(Object.keys(orgData?.members && typeof orgData.members === 'object' ? orgData.members : {}))
  if (typeof orgData?.creatorUserId === 'string' && orgData.creatorUserId.trim()) extraIds.add(orgData.creatorUserId.trim())
  for (const row of managers) {
    if (typeof row.data.email === 'string' && row.data.email.trim()) continue
    extraIds.add(row.id)
    extraIds.add(row.id.toLowerCase())
    extraIds.add(row.id.toUpperCase())
  }
  for (const id of extraIds) {
    if (!id || id.includes('/') || users.has(id)) continue
    const snap = await db.collection('users').doc(id).get()
    if (snap.exists) users.set(snap.id, snap.data() || {})
  }

  const siteBookingUserIds = (await orgRef.collection('managerSiteBookings').select('userId').get()).docs
    .map((doc) => doc.get('userId'))
    .filter((id) => typeof id === 'string')

  const jobs = {}
  for (const collection of JOB_COLLECTIONS) jobs[collection] = remember((await orgRef.collection(collection).get()).docs.map(asDoc))

  return { orgId, managers, users: [...users].map(([id, data]) => ({ id, data })), siteBookingUserIds, jobs }
}

// ─── write ─────────────────────────────────────────────────────────────────────────────────────────────────────────

let backupSequence = 0
const runStartedAt = new Date().toISOString()
const backupDir = path.join(backupRoot, runStartedAt.replace(/[:.]/g, '-'))

function writeBackup(orgId, plan, meta) {
  const documents = plannedPaths(plan).map((p) => {
    if (!meta.has(p)) throw new Error(`No backup copy for ${p}; refusing to write.`)
    return { path: p, data: meta.get(p).data }
  })
  if (documents.length === 0) return null
  const dir = path.join(backupDir, orgId)
  mkdirSync(dir, { recursive: true })
  backupSequence += 1
  const file = path.join(dir, `${String(backupSequence).padStart(3, '0')}-${CHECK_ID}.json`)
  const body = backupFileBody({ projectId, orgId, check: CHECK_ID, createdAt: runStartedAt, sequence: backupSequence, documents })
  writeFileSync(file, JSON.stringify(body, null, 2))
  return file
}

function updateArgs(row) {
  const pairs = []
  for (const [field, value] of Object.entries(row.set)) pairs.push(new FieldPath(field), value)
  for (const field of row.remove) pairs.push(new FieldPath(field), FieldValue.delete())
  pairs.push(new FieldPath('updatedBy'), metadata.updatedBy)
  pairs.push(new FieldPath('updatedFrom'), metadata.updatedFrom)
  pairs.push(new FieldPath('updatedAt'), FieldValue.serverTimestamp())
  return pairs
}

async function commitInBatches(ops) {
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

/** Job updates first; the junk rows are deleted only when every job update was written. */
async function applyPlan(plan, meta) {
  const updates = plan.updates.map((row) => (batch) => {
    const [first, firstValue, ...rest] = updateArgs(row)
    batch.update(db.doc(row.path), first, firstValue, ...rest, { lastUpdateTime: meta.get(row.path).updateTime })
  })
  const jobResult = await commitInBatches(updates)
  if (jobResult.failed > 0) {
    console.error(`  ${plan.deletes.length} junk manager row(s) NOT deleted because a job update was refused; run the script again.`)
    return { written: jobResult.written, failed: jobResult.failed + plan.deletes.length }
  }
  const deletes = plan.deletes.map((row) => (batch) => batch.delete(db.doc(row.path), { lastUpdateTime: meta.get(row.path).updateTime }))
  const rowResult = await commitInBatches(deletes)
  return { written: jobResult.written + rowResult.written, failed: rowResult.failed }
}

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').select('name').get()).docs.map((doc) => doc.id)
const results = []
let totalWritten = 0
let totalFailed = 0

for (const orgId of orgIds) {
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) {
    results.push({ orgId, error: `organizations/${orgId} does not exist` })
    continue
  }
  const orgData = orgSnap.data() || {}
  const orgName = typeof orgData.name === 'string' ? orgData.name : ''
  try {
    const meta = new Map()
    const input = await loadInput(orgId, orgData, meta)
    const plan = planOrg(rulebook, input)
    results.push({ orgId, orgName, plan })
    if (apply && (plan.updates.length > 0 || plan.deletes.length > 0)) {
      const file = writeBackup(orgId, plan, meta)
      if (file) console.log(`Backup: ${path.relative(process.cwd(), file)}`)
      const { written, failed } = await applyPlan(plan, meta)
      totalWritten += written
      totalFailed += failed
    }
  } catch (error) {
    results.push({ orgId, orgName, error: error.message })
  }
}

console.log(formatReport(results, { apply, projectId, rulebookVersion: rulebook.rulebookStamp().version }))
if (apply) {
  console.log(`Applied: ${totalWritten} write(s)${totalFailed ? `, ${totalFailed} not written (run again)` : ''}. updatedBy: ${metadata.updatedBy}, updatedFrom: ${metadata.updatedFrom}.`)
  if (apply && backupSequence > 0) console.log(`Undo: node scripts/data-cleanup.mjs --project ${projectId} --restore ${path.relative(process.cwd(), backupDir)}`)
  if (totalFailed) process.exit(1)
}
if (results.some((result) => result.error)) process.exit(1)

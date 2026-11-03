#!/usr/bin/env node
/**
 * Rulebook 1.11.0 (§16, §17; docs/DEPLOY_1.11.0.md): one-off backfill of `jobCollection` on every existing booking.
 *
 * From 1.11.0 the security rules limit booking reads by job kind: a manager with the Projects or Small works toggle
 * reads the bookings whose `jobCollection` is that kind, and a booking without `jobCollection` is read only by admins,
 * its job's managers and the people it books. Bookings saved before 1.11.0 have no `jobCollection`. This script fills
 * it with the rulebook's own `bookingJobId` + `jobCollectionForJobId` (+ `bookingJobCollectionFields` for manager site
 * bookings), read from the packed script, and writes only that field.
 *
 *   node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> --org <orgId>      # dry run (default)
 *   node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> --all              # dry run, every org
 *   node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> --all --apply      # write
 *
 * - Collections: `bookings`, `subcontractorBookings` (by `projectId` / `projectID`) and `managerSiteBookings` whose
 *   `locationType` is `project` / `small_work` (by `locationId`). A manager site booking with no job is never given
 *   one; one that carries `jobCollection` anyway is listed (`!`) and left alone.
 * - The job is looked up among the organisation's `projects` and `smallWorks` document ids without case. A booking
 *   whose job is in neither (a deleted job's history) is listed (`?`) and left alone: only admins and the people it
 *   books read it, as before.
 * - Writes only `jobCollection`, as a partial update (`update`, never `set`), and only where it is missing or wrong.
 *   No write metadata (`updatedFrom` accepts only `web` / `ios` / `android`). Tombstoned bookings are skipped.
 * - Idempotent: a second run reports 0 to update. Older app builds that create bookings without `jobCollection` after
 *   the run are picked up by running it again.
 * - Credentials and `firebase-admin`: as `scripts/backfill-job-manager-user-ids.mjs`.
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
  console.error('Usage: node scripts/backfill-booking-job-collection.mjs --project <firebaseProjectId> (--org <id> | --all) [--dry-run | --apply]')
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
  for (const name of ['jobCollectionForJobId', 'bookingJobCollectionFields', 'bookingJobId']) {
    if (!rulebook || typeof rulebook[name] !== 'function') {
      console.error(`The packed rulebook has no ${name}. Run \`npm run build:canonical\` first.`)
      process.exit(2)
    }
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const COLLECTIONS = ['bookings', 'subcontractorBookings', 'managerSiteBookings']

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) {
    console.log(`org ${orgId}: not found`)
    return { bookings: 0, changed: 0, unresolved: 0 }
  }
  const jobs = {
    projects: (await orgRef.collection('projects').select().get()).docs.map((doc) => doc.id),
    smallWorks: (await orgRef.collection('smallWorks').select().get()).docs.map((doc) => doc.id),
  }
  const tombstones = new Set((await orgRef.collection('deletedBookings').select().get()).docs.map((doc) => doc.id))
  const totals = { bookings: 0, changed: 0, unresolved: 0 }
  for (const collection of COLLECTIONS) {
    const snap = await orgRef.collection(collection).get()
    let batch = db.batch()
    let pending = 0
    for (const booking of snap.docs) {
      if (tombstones.has(booking.id)) continue
      totals.bookings += 1
      const data = booking.data() || {}
      const stored = typeof data.jobCollection === 'string' ? data.jobCollection : null
      const jobId = rulebook.bookingJobId({
        collection,
        projectId: data.projectId ?? data.projectID ?? null,
        userId: data.userId ?? null,
        locationType: data.locationType ?? null,
        locationId: data.locationId ?? null,
      })
      if (!jobId) {
        if (stored) console.log(`  ! ${collection}/${booking.id}: has jobCollection ${JSON.stringify(stored)} but no job (left alone)`)
        continue
      }
      const kind = rulebook.jobCollectionForJobId(jobId, jobs)
      if (!kind) {
        totals.unresolved += 1
        console.log(`  ? ${collection}/${booking.id}: job ${JSON.stringify(jobId)} is not a project or small works job`)
        continue
      }
      const next = rulebook.bookingJobCollectionFields({ collection, jobCollection: kind, locationType: data.locationType ?? null }).jobCollection
      if (!next || stored === next) continue
      totals.changed += 1
      console.log(`  ${apply ? 'write' : 'would write'} ${collection}/${booking.id}: jobCollection ${JSON.stringify(stored)} → ${JSON.stringify(next)}`)
      if (apply) {
        batch.update(booking.ref, { jobCollection: next })
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
  console.log(`org ${orgId}: ${totals.bookings} bookings, ${totals.changed} ${apply ? 'updated' : 'to update'}, ${totals.unresolved} on no current job`)
  return totals
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
const sum = { bookings: 0, changed: 0, unresolved: 0 }
for (const orgId of orgIds) {
  const totals = await backfillOrg(orgId)
  sum.bookings += totals.bookings
  sum.changed += totals.changed
  sum.unresolved += totals.unresolved
}
console.log(`Summary: ${sum.bookings} bookings, ${sum.changed} ${apply ? 'updated' : 'to update'}, ${sum.unresolved} unresolved.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`)

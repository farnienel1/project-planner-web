#!/usr/bin/env node
/**
 * 17 Nov follow-up — READ-ONLY listing (prints rows, never writes) of every not-exported signed timesheet whose signed
 * snapshot the rulebook already treats as broken: `timesheetSnapshotNeedsRebuild` (1.43.0 — frozen with no labour lines
 * by the loading bug). The decisions are `scripts/rebuild-empty-timesheet-snapshots/plan.mjs`.
 *
 *   node scripts/rebuild-empty-timesheet-snapshots.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
 *
 * There is no --apply: the snapshot is built by the web app's own builder (`applyWeeklyReportOverride` with the timesheet
 * collector, pay history, working hours and schedule options), which a stand-alone script cannot run exactly. A second
 * builder here would be a second calculator (guardrail), so the app does the rebuild: it rebuilds such a sheet, keeping
 * every signature, the next time its line manager or an admin opens it (Timesheets → User Timesheets → the person).
 * Until then the person's own page shows the live bookings' figures and the invoice stays blocked.
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { plain } from './report-timesheet-snapshot-gap/plan.mjs'
import { emptySnapshotCandidates, emptySnapshotRows, personIdsFor } from './rebuild-empty-timesheet-snapshots/plan.mjs'

const USAGE = `Usage:
  node scripts/rebuild-empty-timesheet-snapshots.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
This listing only reads. It never writes.`

function arg(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--') || value.trim() === '') {
    console.error(`${flag} needs a value.\n${USAGE}`)
    process.exit(2)
  }
  return value
}

if (process.argv.includes('--apply')) {
  console.error('--apply is not available: the app rebuilds these sheets (signatures kept) when a line manager or admin opens them. Run without --apply for the list.')
  process.exit(2)
}
const projectId = arg('--project')
const onlyOrg = arg('--org')
const allOrgs = process.argv.includes('--all-orgs') || process.argv.includes('--all')
if (!projectId || (!onlyOrg && !allOrgs) || (onlyOrg && allOrgs)) {
  console.error(USAGE)
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
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

// Reads only: query `get()`. No set, update, delete, batch or transaction anywhere.
async function loadOrg(orgId, orgData) {
  const orgRef = db.collection('organizations').doc(orgId)
  const timeZone = rulebook.organizationTimeZone(orgData?.countryCode)
  const sheets = (await orgRef.collection('settings').get()).docs
    .filter((snap) => snap.id.startsWith('timesheet_'))
    .map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  const users = (await db.collection('users').where('organizationId', '==', orgId).get()).docs.map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  const operatives = (await orgRef.collection('operatives').get()).docs.map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  // Only the bookings of people with a candidate sheet (an unexported snapshot with no labour lines).
  const ids = new Set()
  for (const candidate of emptySnapshotCandidates(rulebook, sheets, timeZone)) {
    for (const id of personIdsFor(candidate.userId, users, operatives)) ids.add(id)
  }
  const wanted = new Set()
  for (const id of ids) {
    wanted.add(id)
    wanted.add(id.toUpperCase())
  }
  for (const user of users) if (ids.has(user.id.toLowerCase())) wanted.add(user.id)
  for (const row of operatives) if (ids.has(row.id.toLowerCase())) wanted.add(row.id)
  const values = [...wanted]
  const bookings = []
  for (let index = 0; index < values.length; index += 30) {
    const chunk = values.slice(index, index + 30)
    for (const [collection, field] of [['bookings', 'operativeId'], ['managerSiteBookings', 'userId']]) {
      const snap = await orgRef.collection(collection).where(field, 'in', chunk).get()
      for (const doc of snap.docs) bookings.push({ collection, id: doc.id, data: plain(doc.data() || {}) })
    }
  }
  return { timeZone, sheets, users, operatives, bookings }
}

async function main() {
  const orgs = []
  if (onlyOrg) {
    const snap = await db.collection('organizations').doc(onlyOrg).get()
    if (!snap.exists) {
      console.error(`organizations/${onlyOrg} was not found in project ${projectId}.`)
      process.exit(1)
    }
    orgs.push({ id: snap.id, data: snap.data() })
  } else {
    for (const snap of (await db.collection('organizations').get()).docs) orgs.push({ id: snap.id, data: snap.data() })
  }
  console.log(`READ-ONLY listing (nothing is written) — project ${projectId}, ${orgs.length} organisation(s)`)
  console.log('organisationId,documentId,person,userId,payRunStart,payRunEnd,bookingsInPayRun')
  let total = 0
  for (const org of orgs) {
    try {
      for (const row of emptySnapshotRows(rulebook, await loadOrg(org.id, org.data))) {
        total += 1
        console.log([org.id, row.documentId, JSON.stringify(row.name), row.userId, row.startDayKey, row.endDayKey, row.bookings].join(','))
      }
    } catch (error) {
      console.error(`ERROR organisation ${org.id}: ${error?.message || error}`)
    }
  }
  console.log(`${total} sheet(s). Each is rebuilt (signatures kept) the next time its line manager or an admin opens it in User Timesheets.`)
  console.log('Nothing was written.')
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`)
  process.exit(1)
})

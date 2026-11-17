#!/usr/bin/env node
/**
 * READ-ONLY dry run (prints counts only, never writes): how many signed timesheets per organisation rulebook 1.57.0
 * newly reads as changed — the signed copy lacks a booking the person signed that is still live (web counter-signed
 * without the person's same-email ids). Not exported: the line manager must counter-sign again. Exported: "Revision due".
 * The decisions are `scripts/report-timesheet-snapshot-gap/plan.mjs`. Owner steps: docs/scripts/report-timesheet-snapshot-gap.md.
 *
 *   node scripts/report-timesheet-snapshot-gap.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { plain, snapshotGapCounts } from './report-timesheet-snapshot-gap/plan.mjs'

const USAGE = `Usage:
  node scripts/report-timesheet-snapshot-gap.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
This report only reads. It never writes.`

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

const lower = (value) => String(value ?? '').trim().toLowerCase()

// Reads only: query `get()`, document `get()` and `getAll()`. No set, update, delete, batch or transaction anywhere.
async function loadOrg(orgId, orgData) {
  const orgRef = db.collection('organizations').doc(orgId)
  const timeZone = rulebook.organizationTimeZone(orgData?.countryCode)
  const sheets = (await orgRef.collection('settings').get()).docs
    .filter((snap) => snap.id.startsWith('timesheet_'))
    .map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  const users = (await db.collection('users').where('organizationId', '==', orgId).get()).docs.map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  const operatives = (await orgRef.collection('operatives').get()).docs.map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
  const wanted = new Map()
  for (const sheet of sheets) {
    for (const row of Array.isArray(sheet.data.operativeSignedBookings) ? sheet.data.operativeSignedBookings : []) {
      const id = String(row?.bookingId ?? '').trim()
      if (!id) continue
      const collection = lower(row?.collection) === 'managersitebookings' ? 'managerSiteBookings' : 'bookings'
      wanted.set(`${collection}|${lower(id)}`, { collection, id })
    }
  }
  const bookings = new Map()
  const tombstoned = new Set()
  const rows = [...wanted.entries()]
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200)
    const docs = await db.getAll(...chunk.map(([, row]) => orgRef.collection(row.collection).doc(row.id)))
    const tombs = await db.getAll(...chunk.map(([, row]) => orgRef.collection('deletedBookings').doc(row.id)))
    chunk.forEach(([key], i) => {
      bookings.set(key, docs[i].exists ? plain(docs[i].data() || {}) : null)
      if (tombs[i].exists) tombstoned.add(key)
    })
  }
  return { timeZone, sheets, users, operatives, bookings, tombstoned }
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
  console.log(`READ-ONLY dry run (nothing is written) — project ${projectId}, ${orgs.length} organisation(s)`)
  console.log('organisationId,sheetsChecked,notExported_counterSignAgain,exported_revisionDue,emptySnapshotRepairedOnOpen,signedBefore147_noRecord')
  const total = { sheetsChecked: 0, notExported: 0, exported: 0, emptySnapshotRepair: 0, noRecord: 0 }
  for (const org of orgs) {
    try {
      const counts = snapshotGapCounts(rulebook, await loadOrg(org.id, org.data))
      for (const name of Object.keys(total)) total[name] += counts[name]
      console.log([org.id, counts.sheetsChecked, counts.notExported, counts.exported, counts.emptySnapshotRepair, counts.noRecord].join(','))
    } catch (error) {
      console.error(`ERROR organisation ${org.id}: ${error?.message || error}`)
    }
  }
  console.log(['TOTAL', total.sheetsChecked, total.notExported, total.exported, total.emptySnapshotRepair, total.noRecord].join(','))
  console.log('Nothing was written.')
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`)
  process.exit(1)
})

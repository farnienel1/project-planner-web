#!/usr/bin/env node
/**
 * READ-ONLY dry run (prints counts only, never writes): how many signed, unexported timesheets per organisation the
 * rulebook 1.76.0 rule reads as changed on day one — their signed price work / expense rows differ from what the entries
 * pay now (`timesheetSignedEntriesChangedSinceSignOff`). Such a sheet moves to Awaiting sign-off (export blocked) until
 * its line manager signs it off again. Expected 0 (before 1.76.0 every reviewer save re-priced those rows).
 * The decisions are `scripts/report-signed-money-mismatch/plan.mjs`. Owner steps: docs/scripts/report-signed-money-mismatch.md.
 *
 *   node scripts/report-signed-money-mismatch.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { plain } from './report-timesheet-snapshot-gap/plan.mjs'
import { signedMoneyMismatchCounts } from './report-signed-money-mismatch/plan.mjs'

const USAGE = `Usage:
  node scripts/report-signed-money-mismatch.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs)
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
for (const name of ['timesheetSignedEntriesChangedSinceSignOff', 'parseTimesheetStatusFields']) {
  if (typeof rulebook[name] !== 'function') {
    console.error(`The packed rulebook has no ${name}. Run \`npm run build:canonical\` on rulebook 1.76.0 or later first.`)
    process.exit(2)
  }
}
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

// Reads only: query `get()` and document `get()`. No set, update, delete, batch or transaction anywhere.
async function loadSheets(orgId) {
  const snaps = (await db.collection('organizations').doc(orgId).collection('settings').get()).docs
  return snaps.filter((snap) => snap.id.startsWith('timesheet_')).map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))
}

async function main() {
  const orgs = []
  if (onlyOrg) {
    const snap = await db.collection('organizations').doc(onlyOrg).get()
    if (!snap.exists) {
      console.error(`organizations/${onlyOrg} was not found in project ${projectId}.`)
      process.exit(1)
    }
    orgs.push(snap.id)
  } else {
    for (const snap of (await db.collection('organizations').get()).docs) orgs.push(snap.id)
  }
  console.log(`READ-ONLY dry run (nothing is written) — project ${projectId}, ${orgs.length} organisation(s)`)
  console.log('organisationId,sheetsChecked,counterSignedNotExported,signedMoneyDiffers_wouldWaitForLineManager')
  const total = { sheetsChecked: 0, counterSignedNotExported: 0, mismatched: 0 }
  const listed = []
  for (const orgId of orgs) {
    try {
      const counts = signedMoneyMismatchCounts(rulebook, { sheets: await loadSheets(orgId) })
      for (const name of Object.keys(total)) total[name] += counts[name]
      console.log([orgId, counts.sheetsChecked, counts.counterSignedNotExported, counts.mismatched].join(','))
      for (const id of counts.mismatchedIds) listed.push(`${orgId}/settings/${id}`)
    } catch (error) {
      console.error(`ERROR organisation ${orgId}: ${error?.message || error}`)
    }
  }
  console.log(['TOTAL', total.sheetsChecked, total.counterSignedNotExported, total.mismatched].join(','))
  if (listed.length > 0) {
    console.log('Timesheet documents that would wait for their line manager:')
    for (const row of listed) console.log(`  ${row}`)
  }
  console.log('Nothing was written.')
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`)
  process.exit(1)
})

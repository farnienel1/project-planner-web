#!/usr/bin/env node
/**
 * READ-ONLY report: projects and small works stored in the "wrong" collection. It never writes anything.
 * Owner steps: docs/scripts/report-job-collection-mismatch.md.
 *
 *   node scripts/report-job-collection-mismatch.mjs --project <firebaseProjectId> --org <orgId>
 *   node scripts/report-job-collection-mismatch.mjs --project <firebaseProjectId> --all-orgs
 *   ... --csv-only     # print only the CSV (for saving to a file)
 *
 * Why: rulebook §21 `jobKind(doc, collection)` — the collection decides the kind. A small works job stored in
 * `projects` (typed "Small Works"), or one stored in both collections under the same id, lists under Projects and in
 * the My Projects ⚙ picker on web and iPhone. The decisions are `scripts/report-job-collection-mismatch/plan.mjs`.
 *
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator. `firebase-admin` comes from this
 * repo, else `functions/node_modules` — as `scripts/cleanup-blank-managers.mjs`.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadRulebook as loadPackedRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { JOB_COLLECTIONS, RULEBOOK_FUNCTIONS, csvHeader, csvLines, formatReport, planOrg } from './report-job-collection-mismatch/plan.mjs'

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const USAGE = `Usage:
  node scripts/report-job-collection-mismatch.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs) [--csv-only]
This report only reads. It never writes.`

const projectId = arg('--project')
const onlyOrg = arg('--org')
const allOrgs = process.argv.includes('--all-orgs') || process.argv.includes('--all')
const csvOnly = process.argv.includes('--csv-only')

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
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

// Reads only: collection `get()` and document `get()`. No set, update, delete, batch or transaction anywhere.
async function loadOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const input = {}
  for (const collection of JOB_COLLECTIONS) {
    input[collection] = (await orgRef.collection(collection).get()).docs.map((snap) => ({ id: snap.id, data: snap.data() || {} }))
  }
  return input
}

async function main() {
  const orgs = []
  if (onlyOrg) {
    const snap = await db.collection('organizations').doc(onlyOrg).get()
    if (!snap.exists) {
      console.error(`organizations/${onlyOrg} was not found in project ${projectId}.`)
      process.exit(1)
    }
    orgs.push({ id: snap.id, name: snap.get('name') })
  } else {
    for (const snap of (await db.collection('organizations').get()).docs) orgs.push({ id: snap.id, name: snap.get('name') })
  }

  const csv = [csvHeader()]
  let flagged = 0
  if (!csvOnly) console.log(`READ-ONLY report (nothing is written) — project ${projectId}, ${orgs.length} organisation(s)\n`)
  for (const org of orgs) {
    try {
      const plan = planOrg(await loadOrg(org.id), rulebook)
      flagged += plan.typedSmallWorksInProjects.length + plan.inBoth.length + plan.sharedJobNumbers.length
      if (!csvOnly) console.log(formatReport(org.id, typeof org.name === 'string' ? org.name : '', plan) + '\n')
      csv.push(...csvLines(org.id, plan))
    } catch (error) {
      console.error(`ERROR organisation ${org.id}: ${error?.message || error}`)
    }
  }
  if (!csvOnly) {
    console.log(`Summary: ${flagged} finding(s) in (a) (b) (d). Nothing was written.\n`)
    console.log('CSV (copy from the next line to the end, or run again with --csv-only > report.csv):')
  }
  console.log(csv.join('\n'))
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`)
  process.exit(1)
})

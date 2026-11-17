#!/usr/bin/env node
/**
 * READ-ONLY report (prints counts only, never writes): how many timesheets each organisation stores, how many carry an
 * export marker, and how many the User Timesheets → Exported list would show on web and on iPhone, with the reason
 * each one is left out. The decisions are `scripts/report-timesheet-history/plan.mjs` (packed rulebook functions, the
 * same way the apps call them). Owner steps: docs/scripts/report-timesheet-history.md.
 *
 *   node scripts/report-timesheet-history.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs) [--viewer <uid>]
 *
 * `--viewer` is whose Exported list to work out (default: the organisation's creator, the Super Admin).
 * Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 * GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST runs it against the emulator.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { loadRulebook, repoRoot } from './data-cleanup/checks.mjs'
import { RULEBOOK_FUNCTIONS, formatReport, plain, timesheetHistoryReport } from './report-timesheet-history/plan.mjs'

const USAGE = `Usage:
  node scripts/report-timesheet-history.mjs --project <firebaseProjectId> (--org <orgId> | --all-orgs) [--viewer <uid>]
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
const viewerArg = arg('--viewer')
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
const missing = RULEBOOK_FUNCTIONS.filter((name) => typeof rulebook[name] !== 'function')
if (missing.length > 0) {
  console.error(`The packed rulebook is missing ${missing.join(', ')}. Run \`npm run build:canonical\` first.`)
  process.exit(2)
}
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

// Reads only: `get()` of documents, collections and queries, `listCollections()` and `count().get()`.
// No set, update, delete, batch or transaction anywhere.
async function loadOrg(orgId, orgData) {
  const orgRef = db.collection('organizations').doc(orgId)
  const settings = (await orgRef.collection('settings').get()).docs.map((snap) => ({ id: snap.id, data: plain(snap.data() || {}) }))

  // The roster the apps listen to: users whose organizationId is this organisation, plus the anchored people
  // (members-map keys and the creator), read by id (rulebook §1).
  const users = new Map()
  for (const snap of (await db.collection('users').where('organizationId', '==', orgId).get()).docs) {
    users.set(snap.id, { id: snap.id, data: plain(snap.data() || {}) })
  }
  const anchored = new Set([...Object.keys(orgData?.members || {}), orgData?.creatorUserId].filter((id) => typeof id === 'string' && id))
  for (const id of anchored) {
    if (users.has(id)) continue
    const snap = await db.collection('users').doc(id).get()
    if (snap.exists) users.set(snap.id, { id: snap.id, data: plain(snap.data() || {}) })
  }

  // Any other collection under the organisation whose name mentions timesheets (an older store, if one exists).
  const otherCollections = []
  for (const ref of await orgRef.listCollections()) {
    if (!/timesheet/i.test(ref.id)) continue
    const count = (await ref.count().get()).data().count
    otherCollections.push({ name: ref.id, count })
  }
  return { settings, users: Array.from(users.values()), otherCollections }
}

async function main() {
  const orgs = []
  if (onlyOrg) {
    const snap = await db.collection('organizations').doc(onlyOrg).get()
    if (!snap.exists) {
      console.error(`organizations/${onlyOrg} was not found in project ${projectId}.`)
      process.exit(1)
    }
    orgs.push({ id: snap.id, data: snap.data() || {} })
  } else {
    for (const snap of (await db.collection('organizations').get()).docs) orgs.push({ id: snap.id, data: snap.data() || {} })
  }
  console.log(`READ-ONLY report (nothing is written) — project ${projectId}, ${orgs.length} organisation(s)\n`)
  for (const org of orgs) {
    try {
      const input = await loadOrg(org.id, org.data)
      const viewerId = viewerArg || (typeof org.data.creatorUserId === 'string' ? org.data.creatorUserId : '')
      if (!viewerId) {
        console.log(`=== Organisation ${org.id}: no creatorUserId stored; run again with --viewer <your uid>.\n`)
        continue
      }
      const report = timesheetHistoryReport(rulebook, { settings: input.settings, users: input.users, viewerId })
      const name = typeof org.data.name === 'string' ? org.data.name : ''
      console.log(formatReport(org.id, name, report, { otherCollections: input.otherCollections }) + '\n')
    } catch (error) {
      console.error(`ERROR organisation ${org.id}: ${error?.message || error}`)
    }
  }
  console.log('Nothing was written.')
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`)
  process.exit(1)
})

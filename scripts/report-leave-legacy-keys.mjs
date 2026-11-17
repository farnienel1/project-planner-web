#!/usr/bin/env node
/**
 * Rulebook 1.56.0 §9 / §16 (owner answer 17 Nov Q4: "fix the data"): READ-ONLY report of the annual-leave records an
 * operative would no longer see once they read only their own leave (`leaveQueryPlan`; Phase B rules behind the
 * `operativeOwnLeave` switch). Run by the owner only, before the Phase B rules. Never writes anything to Firestore.
 *
 *   node scripts/report-leave-legacy-keys.mjs --project <id> --all
 *   node scripts/report-leave-legacy-keys.mjs --project <id> --org <orgId> [--csv <file>]
 *
 * The decision is the rulebook's `leaveLegacyKeyFindings` (from the packed script, `npm run build:canonical`): a record
 * the shared reader gives an operative (any legacy key, ids without case) whose stored `userId` / `operativeId` is not
 * one of the exact values the app queries. Each line says how to fix it (owner steps: docs/scripts/report-leave-legacy-keys.md).
 * Admin credentials (`firebase-admin`, as the other owner scripts).
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { reportCsv, reportLines, reportRows } from './report-leave-legacy-keys/plan.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function arg(flag) {
  const eq = process.argv.find((value) => value.startsWith(`${flag}=`))
  if (eq) return eq.slice(flag.length + 1)
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] || null : null
}

const projectId = arg('--project')
const onlyOrg = arg('--org')
const csvFile = arg('--csv')
const all = process.argv.includes('--all')
if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/report-leave-legacy-keys.mjs --project <id> (--org <id> | --all) [--csv <file>]')
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
  for (const name of ['leaveLegacyKeyFindings', 'organizationTimeZone']) {
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

async function orgUsers(orgId) {
  const byId = new Map()
  for (const value of [orgId, `organizations/${orgId}`, db.doc(`organizations/${orgId}`)]) {
    for (const doc of (await db.collection('users').where('organizationId', '==', value).get()).docs) byId.set(doc.id, { ...doc.data(), id: doc.id })
  }
  return [...byId.values()]
}

/**
 * The organisation's users documents plus the users documents of its members from other companies (`members` keys and
 * the creator, rulebook §1 anchored people) and those members' memberships here, so a person who is an operative here
 * only through a membership is checked too.
 */
async function orgPeople(orgId, orgData) {
  const users = await orgUsers(orgId)
  const byId = new Map(users.map((user) => [user.id, user]))
  const memberIds = new Set([...Object.keys(orgData?.members || {}), orgData?.creatorUserId].filter((id) => typeof id === 'string' && id))
  const memberships = {}
  for (const uid of memberIds) {
    if (!byId.has(uid)) {
      const snap = await db.collection('users').doc(uid).get()
      if (snap.exists) byId.set(uid, { ...snap.data(), id: uid })
    }
    const membership = await db.collection('users').doc(uid).collection('orgMemberships').doc(orgId).get()
    if (membership.exists) memberships[uid] = membership.data()
  }
  return { users: [...byId.values()], memberships }
}

async function reportOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  const orgData = orgSnap.exists ? orgSnap.data() || {} : {}
  const timeZone = rulebook.organizationTimeZone(orgData.countryCode ?? null)
  const { users, memberships } = await orgPeople(orgId, orgData)
  const operatives = (await orgRef.collection('operatives').get()).docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  const leaveDocs = (await orgRef.collection('holidayBookings').get()).docs.map((doc) => ({ id: doc.id, data: doc.data() }))
  const findings = rulebook.leaveLegacyKeyFindings({
    organizationId: orgId,
    users,
    memberships,
    members: orgData.members || {},
    creatorUserId: orgData.creatorUserId ?? null,
    operatives,
    leaveDocs,
    timeZone,
  })
  return reportRows(orgId, findings)
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
const allRows = []
for (const orgId of orgIds) {
  const rows = await reportOrg(orgId)
  allRows.push(...rows)
  for (const line of reportLines(orgId, rows)) console.log(line)
}
if (csvFile) {
  writeFileSync(csvFile, reportCsv(allRows))
  console.log(`\nCSV written to ${csvFile}.`)
}
console.log(`\n${allRows.length} leave record(s) listed. Read only: nothing was written to Firestore.`)

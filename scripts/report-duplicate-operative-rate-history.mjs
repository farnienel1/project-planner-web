#!/usr/bin/env node
/**
 * Rulebook 1.36.0 §8 (owner question, 7 Nov): READ-ONLY report of the people whose rate changes because web now reads
 * pay-rate history under every `operatives` row on their email. Run by the owner only. Never writes anything.
 *
 *   node scripts/report-duplicate-operative-rate-history.mjs --project <id> --all
 *   node scripts/report-duplicate-operative-rate-history.mjs --project <id> --org <orgId>
 *
 * Lists people with two or more `operatives` rows on one email where a row that is not their linked row has a history
 * row (`organizations/{orgId}/operativeDayRateHistory`) newer than the history web read before 1.36.0, with the rate
 * before and after (`duplicateRateHistoryFindings`). Admin credentials (`firebase-admin`, as the other owner scripts).
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { duplicateRateHistoryFindings } from './report-duplicate-operative-rate-history/plan.mjs'

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
const all = process.argv.includes('--all')
if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/report-duplicate-operative-rate-history.mjs --project <id> (--org <id> | --all)')
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

async function reportOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const users = await orgUsers(orgId)
  const operatives = (await orgRef.collection('operatives').get()).docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  const history = (await orgRef.collection('operativeDayRateHistory').get()).docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  return duplicateRateHistoryFindings({ users, operatives, history })
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
let total = 0
for (const orgId of orgIds) {
  const findings = await reportOrg(orgId)
  if (findings.length === 0) continue
  console.log(`\nOrganisation ${orgId}: ${findings.length} person(s)`)
  for (const item of findings) {
    total += 1
    const before = item.before ? `${item.before.rate ?? 'not set'} (${item.before.payBasis ?? '?'}, from ${item.before.effectiveAt})` : 'none'
    const after = item.after ? `${item.after.rate ?? 'not set'} (${item.after.payBasis ?? '?'}, from ${item.after.effectiveAt})` : 'none'
    console.log(`  ${item.name || '(no name)'} <${item.email}> users ${item.userIds.join(', ')}`)
    console.log(`    rows ${item.operativeIds.join(', ')}; linked ${item.linkedOperativeIds.join(', ') || 'none'}; ${item.reason}`)
    console.log(`    rate before 1.36.0: ${before}; from 1.36.0: ${after}`)
  }
}
console.log(`\n${total} person(s) listed. Read only: nothing was written.`)

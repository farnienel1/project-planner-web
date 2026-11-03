#!/usr/bin/env node
/**
 * Rulebook 1.13.0 (§8, §16; owner decisions round 4, Q1; docs/DEPLOY_1.11.0.md "1.13.0"): moves pay into the private
 * `organizations/{orgId}/payProfiles/{subjectId}` documents.
 *
 *   node scripts/backfill-pay-profiles.mjs --project <firebaseProjectId> --all                    # dry run (default)
 *   node scripts/backfill-pay-profiles.mjs --project <firebaseProjectId> --all --apply            # copy
 *   node scripts/backfill-pay-profiles.mjs --project <firebaseProjectId> --all --apply --strip    # copy, then remove
 *
 * - Pay is `PAY_PROFILE_FIELDS` (payBasis, dayRate, hourlyRate, employmentType, employmentTypeTransitionFrom,
 *   employmentTypeEffectiveAt). Each step is the rulebook's `payProfileBackfillWrites`, read from the packed script.
 * - Subjects: every `users` document of the organisation (`organizationId` names it) → `payProfiles/{uid}`; every
 *   `operatives` / `managers` row → the users id with the same email in the organisation (the row's pay fills only
 *   fields the person's profile does not have), else the row id (a catalogue person with no account).
 * - Copy (`--apply`): writes only the pay fields the pay profile does not hold yet, plus `userId`, as a merge. A value
 *   an app already wrote to the pay profile is never overwritten. Idempotent: a second run reports 0 to copy.
 * - Strip (`--apply --strip`): also deletes the pay fields from the users / operatives / managers document, only
 *   where the pay profile holds that field afterwards. Run it only at step 6 of the 1.13.0 deploy (after the release
 *   that reads pay from the pay profile, and after `platformConfig/app.privatePay` is true). Before that, older app
 *   builds would show no pay.
 * - No write metadata (`updatedFrom` takes only web / ios / android). Credentials and `firebase-admin`: as
 *   `scripts/backfill-job-manager-user-ids.mjs`.
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
const strip = process.argv.includes('--strip')

if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/backfill-pay-profiles.mjs --project <firebaseProjectId> (--org <id> | --all) [--apply] [--strip]')
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
  for (const name of ['payProfileBackfillWrites']) {
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


const PROFILES = 'payProfiles'

async function commitIn(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch()
    for (const write of writes.slice(i, i + 400)) write(batch)
    await batch.commit()
  }
}

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) {
    console.log(`org ${orgId}: not found`)
    return { subjects: 0, copied: 0, stripped: 0 }
  }
  const users = (await db.collection('users').where('organizationId', '==', orgId).get()).docs
  const profiles = new Map((await orgRef.collection(PROFILES).get()).docs.map((doc) => [doc.id, { ...(doc.data() || {}) }]))
  const userIdByEmail = new Map()
  for (const user of users) {
    const email = String(user.get('email') || '').trim().toLowerCase()
    if (email && !userIdByEmail.has(email)) userIdByEmail.set(email, user.id)
  }
  const sources = [
    ...users.map((doc) => ({ label: `users/${doc.id}`, ref: doc.ref, subjectId: doc.id, data: doc.data() || {} })),
    ...(await orgRef.collection('operatives').get()).docs.map((doc) => ({ label: `operatives/${doc.id}`, ref: doc.ref, data: doc.data() || {} })),
    ...(await orgRef.collection('managers').get()).docs.map((doc) => ({ label: `managers/${doc.id}`, ref: doc.ref, data: doc.data() || {} })),
  ].map((row) => {
    if (row.subjectId) return row
    const email = String(row.data.email || '').trim().toLowerCase()
    return { ...row, subjectId: (email && userIdByEmail.get(email)) || row.ref.id }
  })
  const totals = { subjects: new Set(), copied: 0, stripped: 0 }
  const writes = []
  for (const row of sources) {
    totals.subjects.add(row.subjectId)
    const profile = profiles.get(row.subjectId) || null
    const step = rulebook.payProfileBackfillWrites({ subjectId: row.subjectId, source: row.data, profile, strip })
    if (step.profileSet) {
      totals.copied += 1
      // Keep Firestore values (Timestamps) as read: take them from the source, not from the JSON copy above.
      const fields = { userId: row.subjectId }
      for (const key of Object.keys(step.profileSet)) if (key !== 'userId') fields[key] = row.data[key]
      console.log(`  ${apply ? 'copy' : 'would copy'} ${row.label} → ${PROFILES}/${row.subjectId}: ${Object.keys(fields).filter((k) => k !== 'userId').join(', ')}`)
      profiles.set(row.subjectId, { ...(profile || {}), ...fields })
      if (apply) writes.push((batch) => batch.set(orgRef.collection(PROFILES).doc(row.subjectId), fields, { merge: true }))
    }
    if (step.sourceRemove.length > 0) {
      totals.stripped += 1
      console.log(`  ${apply ? 'strip' : 'would strip'} ${row.label}: ${step.sourceRemove.join(', ')}`)
      if (apply) {
        const removal = Object.fromEntries(step.sourceRemove.map((key) => [key, firestore.FieldValue.delete()]))
        writes.push((batch) => batch.update(row.ref, removal))
      }
    }
  }
  if (apply) await commitIn(writes)
  console.log(`org ${orgId}: ${totals.subjects.size} people, ${totals.copied} ${apply ? 'copied' : 'to copy'}, ${totals.stripped} ${apply ? 'stripped' : strip ? 'to strip' : 'would strip with --strip'}`)
  return { subjects: totals.subjects.size, copied: totals.copied, stripped: totals.stripped }
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'}${strip ? ' + STRIP' : ''} — project ${projectId}, ${orgIds.length} organisation(s)`)
const sum = { subjects: 0, copied: 0, stripped: 0 }
for (const orgId of orgIds) {
  const totals = await backfillOrg(orgId)
  sum.subjects += totals.subjects
  sum.copied += totals.copied
  sum.stripped += totals.stripped
}
console.log(`Summary: ${sum.subjects} people, ${sum.copied} ${apply ? 'copied' : 'to copy'}, ${sum.stripped} ${apply ? 'stripped' : 'to strip'}.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`)

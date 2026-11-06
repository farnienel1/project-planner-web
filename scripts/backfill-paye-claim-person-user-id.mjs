#!/usr/bin/env node
/**
 * Rulebook 1.33.0 (§16, §26; docs/DEPLOY_1.33.0.md): one-off backfill of `personUserId` on price work and expense
 * items saved before 1.33.0.
 *
 * Owner decision 6 Nov: a line manager can always review their report's price work and expenses, under every id the
 * person goes by. From 1.33.0 both apps write `personUserId` (the creator's current users id) on every new item, and the
 * security rules let the person's line manager read an item through it. Items saved before 1.33.0 have no
 * `personUserId`; an item filed under a former id (an old invite id in `formerUserIds`, or a same-email document in
 * `sameEmailUserIds`) is then unreadable to the line manager until this script stamps it. The value is the rulebook's
 * own `payeClaimPersonUserIdBackfill({ item, users })`, read from the packed script, so it is exactly the rule the apps
 * run.
 *
 *   node scripts/backfill-paye-claim-person-user-id.mjs --project <firebaseProjectId> --org <orgId>      # dry run (default)
 *   node scripts/backfill-paye-claim-person-user-id.mjs --project <firebaseProjectId> --all              # dry run, every org
 *   node scripts/backfill-paye-claim-person-user-id.mjs --project <firebaseProjectId> --all --apply      # write
 *
 * - Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 *   GOOGLE_APPLICATION_CREDENTIALS. FIRESTORE_EMULATOR_HOST runs it against the emulator.
 * - `firebase-admin` is resolved from this repo, else from `functions/node_modules` (`cd functions && npm ci`).
 * - Writes only `personUserId`, as a partial update (`update`, never `set`), and only on an item that has none. No
 *   write metadata (`updatedFrom` accepts only `web` / `ios` / `android`, and a script is none of them).
 * - Idempotent: a second run reports 0 changes. An item whose id matches no users document, or more than one, is listed
 *   with `?` and left alone (never guessed).
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
  console.error('Usage: node scripts/backfill-paye-claim-person-user-id.mjs --project <firebaseProjectId> (--org <id> | --all) [--dry-run | --apply]')
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
  if (!rulebook || typeof rulebook.payeClaimPersonUserIdBackfill !== 'function') {
    console.error('The packed rulebook has no payeClaimPersonUserIdBackfill (1.33.0). Run `npm run build:canonical` first.')
    process.exit(2)
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

const idList = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])

/** Users documents of this organisation, plus members whose users document names another company. */
async function usersFor(orgId, orgData) {
  const byId = new Map()
  const snap = await db.collection('users').where('organizationId', '==', orgId).get()
  for (const doc of snap.docs) byId.set(doc.id, doc.data())
  const memberIds = Object.keys(orgData?.members && typeof orgData.members === 'object' ? orgData.members : {})
  for (const id of memberIds) {
    if (byId.has(id)) continue
    const doc = await db.collection('users').doc(id).get()
    if (doc.exists) byId.set(doc.id, doc.data())
  }
  return [...byId].map(([id, data]) => ({ id, formerUserIds: idList(data?.formerUserIds), sameEmailUserIds: idList(data?.sameEmailUserIds) }))
}

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) {
    console.log(`org ${orgId}: not found`)
    return { items: 0, changed: 0, alias: 0, unresolved: 0 }
  }
  const users = await usersFor(orgId, orgSnap.data())
  const totals = { items: 0, changed: 0, alias: 0, unresolved: 0 }
  for (const collection of ['priceWorkItems', 'expenseItems']) {
    const items = await orgRef.collection(collection).get()
    let batch = db.batch()
    let pending = 0
    for (const item of items.docs) {
      totals.items += 1
      const data = item.data() || {}
      if (typeof data.personUserId === 'string' && data.personUserId.trim()) continue
      const fields = rulebook.payeClaimPersonUserIdBackfill({ item: data, users })
      if (!fields) {
        totals.unresolved += 1
        console.log(`  ? ${collection}/${item.id}: userId ${JSON.stringify(data.userId ?? null)} matches no users document (or more than one)`)
        continue
      }
      totals.changed += 1
      const alias = String(fields.personUserId).toLowerCase() !== String(data.userId ?? '').toLowerCase()
      if (alias) totals.alias += 1
      console.log(`  ${apply ? 'write' : 'would write'} ${collection}/${item.id}: personUserId ${JSON.stringify(fields.personUserId)}${alias ? ` (filed under ${JSON.stringify(data.userId)})` : ''}`)
      if (apply) {
        batch.update(item.ref, { personUserId: fields.personUserId })
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
  console.log(
    `org ${orgId}: ${totals.items} items, ${totals.changed} ${apply ? 'updated' : 'to update'} (${totals.alias} under a former id), ${totals.unresolved} unresolved`
  )
  return totals
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
const sum = { items: 0, changed: 0, alias: 0, unresolved: 0 }
for (const orgId of orgIds) {
  const totals = await backfillOrg(orgId)
  for (const key of Object.keys(sum)) sum[key] += totals[key]
}
console.log(
  `Summary: ${sum.items} items, ${sum.changed} ${apply ? 'updated' : 'to update'} (${sum.alias} under a former id), ${sum.unresolved} unresolved.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`
)

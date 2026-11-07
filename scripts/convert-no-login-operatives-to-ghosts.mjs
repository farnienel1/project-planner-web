#!/usr/bin/env node
/**
 * Rulebook 1.34.0 §11 (owner decision Q-G2, 6 Nov): converts existing no-login `operatives` rows into ghost operatives.
 * Run by the owner only, never automatically. Dry run by default.
 *
 *   node scripts/convert-no-login-operatives-to-ghosts.mjs --project <id> --all                     # dry run: check list
 *   node scripts/convert-no-login-operatives-to-ghosts.mjs --project <id> --org <orgId>             # one organisation
 *   node scripts/convert-no-login-operatives-to-ghosts.mjs --project <id> --all --apply --line-managers=<filled.csv>
 *
 * - Dry run: lists every candidate (`ghostConversionCandidates`: an active `operatives` row with no users document of
 *   the organisation on its id, its stored link or its email) and writes the owner's check list next to the script's
 *   output folder: `ghost-conversion-check-list.csv` (fill `lineManagerIds`, and the name or rate where `issues`
 *   says so) and `ghost-conversion-check-list.md`. Nothing is written to Firestore.
 * - `--apply --line-managers=<file>`: for each row of the filled CSV that names a line manager, writes
 *   `ghostConversionWrites`: `users/{operativeId}` created as a ghost (`ghost: true`, `passwordSet: false`, the
 *   operative level, self-employed, the rate, the line managers, the row's email kept aside as `inviteEmailHint`,
 *   duplicate rows on the same email as `formerUserIds`), the pay profile while `privatePay` is on, the kept row linked
 *   to it with its email cleared, and duplicate rows linked and made inactive. The row keeps its id, so its bookings,
 *   leave and pay history stay attached. A row whose result fails `ghostCreateError` is reported and skipped.
 * - Idempotent: a converted row has a users document now, so it is no longer a candidate; a second run plans nothing
 *   for it. `create()` refuses an existing users document.
 * - Accounts (1.36.0): users documents with `organizationId` = the id or `organizations/{id}`, plus every `members` key
 *   and the creator read by id (`anchoredMemberIds`, passed as `memberIds`), so no person with a login is converted.
 * - Admin credentials (`firebase-admin`, as `scripts/backfill-pay-profiles.mjs`). No write metadata: the script has no
 *   signed-in user, so `updatedBy` / `updatedFrom` are left out (never written as '').
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { anchoredMemberIds, checkListCsv, checkListMarkdown, checkListRows, parseFilledCheckList } from './convert-no-login-operatives/plan.mjs'

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
const apply = process.argv.includes('--apply')
const lineManagersFile = arg('--line-managers')
const outDir = arg('--out') || path.join(root, 'ghost-conversion')

if (!projectId || (!onlyOrg && !all) || (onlyOrg && all) || (apply && !lineManagersFile)) {
  console.error(
    'Usage: node scripts/convert-no-login-operatives-to-ghosts.mjs --project <id> (--org <id> | --all) [--out <dir>] [--apply --line-managers=<filled.csv>]'
  )
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
  for (const name of ['ghostConversionCandidates', 'ghostConversionWrites', 'securitySwitchOn']) {
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
const filled = apply ? parseFilledCheckList(readFileSync(lineManagersFile, 'utf8')) : new Map()
const configSnap = await db.collection('platformConfig').doc('app').get()
const platformConfig = configSnap.exists ? configSnap.data() || {} : {}

function withServerTimes(write) {
  const fields = { ...write.fields }
  for (const key of write.serverTimestampFields) fields[key] = firestore.FieldValue.serverTimestamp()
  return fields
}

/**
 * 1.36.0: every users document that is an account of this organisation, so a person with a login is never converted.
 * The `organizationId ==` query misses documents that store the organisation as a path (`organizations/{id}`, some
 * iOS builds) and members whose users document names another company (rulebook §1 anchored people: every `members`
 * key and the creator), so those are read too (by the path form, and by id).
 */
async function loadOrgUsers(orgId, orgData) {
  const byId = new Map()
  for (const value of [orgId, `organizations/${orgId}`]) {
    for (const doc of (await db.collection('users').where('organizationId', '==', value).get()).docs) byId.set(doc.id, { id: doc.id, ...doc.data() })
  }
  const missing = anchoredMemberIds(orgData).filter((id) => !byId.has(id))
  if (missing.length > 0) {
    const snaps = await db.getAll(...missing.map((id) => db.collection('users').doc(id)))
    for (const snap of snaps) if (snap.exists) byId.set(snap.id, { id: snap.id, ...snap.data() })
  }
  return [...byId.values()]
}

async function convertOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) return { rows: [], converted: 0, skipped: 0, name: orgId }
  const users = await loadOrgUsers(orgId, orgSnap.data() || {})
  const operatives = (await orgRef.collection('operatives').get()).docs.map((doc) => ({ ...doc.data(), id: doc.id }))
  const candidates = rulebook.ghostConversionCandidates({
    organizationId: orgId,
    operatives,
    users,
    memberIds: anchoredMemberIds(orgSnap.data() || {}),
  })
  const rows = checkListRows(orgId, candidates)
  let converted = 0
  let skipped = 0
  if (apply) {
    const privatePay = rulebook.securitySwitchOn(platformConfig, orgId, 'privatePay') === true
    for (const candidate of candidates) {
      const fill = filled.get(`${orgId}/${candidate.operativeId}`)
      if (!fill) {
        console.log(`  skip ${orgId}/${candidate.operativeId} (${candidate.name || 'no name'}): no line manager on the check list`)
        skipped += 1
        continue
      }
      const plan = rulebook.ghostConversionWrites({
        organizationId: orgId,
        candidate,
        lineManagerIds: fill.lineManagerIds,
        overrides: fill.overrides,
        // No signed-in user runs this script: `writeMetadataFields('')` is null, so no `updatedBy` / `updatedFrom` is
        // written (rulebook §1: never required; `updatedFrom` takes only web / ios / android). Never `updatedBy: ''`.
        actorUserId: '',
        privatePay,
        roster: users,
      })
      if (!plan) {
        console.log(`  skip ${orgId}/${candidate.operativeId}: needs a name, a rate above 0 and a line manager on the check list who is an active admin or manager of this organisation`)
        skipped += 1
        continue
      }
      const batch = db.batch()
      batch.create(db.doc(plan.user.path), withServerTimes(plan.user))
      if (plan.payProfile) batch.set(db.doc(plan.payProfile.path), withServerTimes(plan.payProfile), { merge: true })
      batch.update(db.doc(plan.operativeRow.path), plan.operativeRow.set)
      for (const row of plan.duplicateRows) batch.update(db.doc(row.path), row.set)
      try {
        await batch.commit()
        converted += 1
        console.log(`  converted ${orgId}/${candidate.operativeId} (${candidate.name})`)
      } catch (error) {
        skipped += 1
        console.log(`  FAILED ${orgId}/${candidate.operativeId}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
  console.log(`org ${orgId}: ${candidates.length} candidate(s)${apply ? `, ${converted} converted, ${skipped} skipped` : ''}`)
  return { rows, converted, skipped, name: String(orgSnap.get('name') || orgId) }
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
const allRows = []
const names = {}
let converted = 0
for (const orgId of orgIds) {
  const result = await convertOrg(orgId)
  allRows.push(...result.rows)
  names[orgId] = result.name
  converted += result.converted
}
if (!apply) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, 'ghost-conversion-check-list.csv'), checkListCsv(allRows))
  writeFileSync(path.join(outDir, 'ghost-conversion-check-list.md'), checkListMarkdown(allRows, names))
  console.log(`Check list: ${allRows.length} row(s) in ${outDir}. Nothing was written to Firestore (dry run).`)
} else {
  console.log(`Summary: ${converted} converted.`)
}

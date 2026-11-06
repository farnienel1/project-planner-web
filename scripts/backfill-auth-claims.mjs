#!/usr/bin/env node
/**
 * Rulebook 1.32.4 (§16; docs/scripts/backfill-auth-claims.md): sets every person's Firebase Auth custom claims (`pp`)
 * from Firestore, the same way the Cloud Function triggers do (functions/authClaims.js, the rulebook's
 * `authClaimsForPerson`). Run it after deploying the functions and before publishing the 1.32.4 rules.
 *
 *   node scripts/backfill-auth-claims.mjs --project <firebaseProjectId>            # dry run (default): what would change
 *   node scripts/backfill-auth-claims.mjs --project <firebaseProjectId> --apply    # set the claims and write the markers
 *   node scripts/backfill-auth-claims.mjs --project <firebaseProjectId> --uid <uid> [--apply]   # one person
 *
 * - Every Firebase Auth account is listed (`listUsers`, 1,000 a page). An account whose claims already match is left
 *   alone, so a second run reports 0 to change.
 * - `--apply` calls `setCustomUserClaims` (other custom claims are kept), revokes refresh tokens only when access was
 *   taken away (never on a first backfill: there were no claims before), and writes the marker
 *   `users/{uid}/private/authClaims` so open apps refresh their token.
 * - It lists anyone whose organisations do not all fit in the claims (`omittedOrganizationIds`): the rules refuse those
 *   organisations for them. Expected: nobody.
 * - Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 *   GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key with Firebase Auth admin and Firestore access.
 *   `firebase-admin` is read from this repo or `functions/` (run `cd functions && npm ci` once).
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
const onlyUid = arg('--uid')
const apply = process.argv.includes('--apply')

if (!projectId) {
  console.error('Usage: node scripts/backfill-auth-claims.mjs --project <firebaseProjectId> [--uid <uid>] [--apply]')
  process.exit(2)
}

function loadAdmin() {
  for (const base of [path.join(root, 'package.json'), path.join(root, 'functions', 'package.json')]) {
    try {
      const require = createRequire(base)
      return {
        app: require('firebase-admin/app'),
        firestore: require('firebase-admin/firestore'),
        auth: require('firebase-admin/auth'),
        sync: createRequire(path.join(root, 'functions', 'package.json'))('./authClaims.js'),
      }
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
  for (const name of ['authClaimsForPerson', 'authClaimsEqual', 'authClaimsRevokeAccess', 'authClaimsOrganizationAffectedUids']) {
    if (!rulebook || typeof rulebook[name] !== 'function') {
      console.error(`The packed rulebook has no ${name}. Run \`npm run build:canonical\` first.`)
      process.exit(2)
    }
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore, auth: adminAuth, sync: syncModule } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()
const auth = adminAuth.getAuth()
const store = syncModule.createAdminAuthClaimsStore(db, { FieldPath: firestore.FieldPath, FieldValue: firestore.FieldValue })

// Dry run: the same sync, with Auth writes and the marker recorded instead of made.
const planned = []
const dryAuth = {
  getUser: (uid) => auth.getUser(uid),
  async setCustomUserClaims(uid, claims) {
    planned.push({ uid, claims })
  },
  async revokeRefreshTokens() {},
}
const dryStore = { ...store, async writeMarker() {} }
const sync = syncModule.createAuthClaimsSync({
  store: apply ? store : dryStore,
  auth: apply ? auth : dryAuth,
  canonical: rulebook,
  logger: { warn() {}, error: (...args) => console.error(...args) },
})

async function* accountIds() {
  if (onlyUid) {
    yield onlyUid
    return
  }
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) yield user.uid
    pageToken = page.pageToken
  } while (pageToken)
}

const totals = { accounts: 0, change: 0, same: 0, revoked: 0, failed: 0 }
const overCap = []
for await (const uid of accountIds()) {
  totals.accounts += 1
  try {
    const result = await sync.syncPerson(uid)
    if (result.skipped) continue
    if (result.changed) totals.change += 1
    else totals.same += 1
    if (result.revoked) totals.revoked += 1
    if (result.omittedOrganizationIds?.length) overCap.push({ uid, omitted: result.omittedOrganizationIds })
    if (result.changed && (onlyUid || process.argv.includes('--verbose'))) {
      console.log(uid, JSON.stringify((result.claims ?? planned.at(-1)?.claims)?.pp ?? null))
    }
  } catch (error) {
    totals.failed += 1
    console.error(`FAILED ${uid}: ${error && error.message ? error.message : error}`)
  }
}

console.log(`${apply ? 'APPLIED' : 'DRY RUN'} on ${projectId}: ${totals.accounts} accounts, ${totals.change} ${apply ? 'changed' : 'to change'}, ${totals.same} already current, ${totals.revoked} refresh-token revocations, ${totals.failed} failed.`)
if (overCap.length > 0) {
  console.log(`${overCap.length} people belong to more organisations than fit in their claims (the rules refuse the ones left out):`)
  for (const row of overCap) console.log(`  ${row.uid}: ${row.omitted.join(', ')}`)
}
if (!apply) console.log('Nothing was written. Run again with --apply to set the claims.')
process.exit(totals.failed > 0 ? 1 : 0)

#!/usr/bin/env node
// Writes the owner-console seed to the Firebase EMULATORS. Refuses to run against anything else.
//
//   firebase emulators:exec --only firestore,auth --project demo-owner-console "npx tsx scripts/owner-console-seed/seed.mjs"
//
// Run with tsx: it sets each seeded sign-in's Auth custom claims with the rulebook's authClaimsForPerson, as the
// authClaims Cloud Function would (rulebook §16), so organisation people can use the app against these rules.
//
// It clears the emulator's Firestore and Auth data first (emulator only), then writes seedData.mjs.
import { buildOwnerConsoleSeed, SEED_AUTH_USERS, SEED_PASSWORD, SEED_PROJECT_ID } from './seedData.mjs'
import { toRestFields } from './restValues.mjs'
import { authClaimsForPerson } from '../../lib/canonical/authClaims.ts'

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || ''
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || ''
const project = process.env.GCLOUD_PROJECT || process.env.SEED_PROJECT_ID || SEED_PROJECT_ID

function refuse(message) {
  console.error(`owner-console seed: ${message} Nothing was written.`)
  process.exit(2)
}

const local = (host) => /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)
if (!local(firestoreHost)) refuse('FIRESTORE_EMULATOR_HOST must point at a local emulator (127.0.0.1:port).')
if (!local(authHost)) refuse('FIREBASE_AUTH_EMULATOR_HOST must point at a local emulator (127.0.0.1:port).')
if (!project.startsWith('demo-')) refuse(`the project id must start with "demo-" (emulator-only projects), got "${project}".`)

const admin = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

async function call(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...admin, ...(init.headers || {}) } })
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${url} → ${response.status} ${await response.text()}`)
  return response.json().catch(() => ({}))
}

async function clear() {
  await call(`http://${firestoreHost}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' })
  await call(`http://${authHost}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' })
}

async function createAuthUsers(seed) {
  const organizations = Object.fromEntries(seed.orgs.map((org) => [org.id, org.data]))
  for (const user of SEED_AUTH_USERS) {
    await call(`http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts`, {
      method: 'POST',
      body: JSON.stringify({ localId: user.uid, email: user.email, password: SEED_PASSWORD, emailVerified: true, displayName: user.displayName }),
    })
    if (user.role === 'owner') continue
    const profile = seed.users.find((doc) => doc.id === user.uid)?.data || null
    const { claims } = authClaimsForPerson({ uid: user.uid, user: profile, organizations, memberships: {}, stamp: SEED_CLAIMS_STAMP })
    await call(`http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`, {
      method: 'POST',
      body: JSON.stringify({ localId: user.uid, customAttributes: JSON.stringify(claims) }),
    })
  }
}

const SEED_CLAIMS_STAMP = 1

function docName(path) {
  return `projects/${project}/databases/(default)/documents/${path}`
}

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    await call(`http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
    })
  }
}

const seed = buildOwnerConsoleSeed()
const writes = []
const put = (collection, docs) => {
  for (const doc of docs) writes.push({ update: { name: docName(`${collection}/${doc.id}`), fields: toRestFields(doc.data) } })
}
put('organizations', seed.orgs)
put('users', seed.users)
put('invitations', seed.invitations)
put('productEvents', seed.productEvents)
put('productSessions', seed.productSessions)
put('productFeedback', seed.productFeedback)
put('interestRegistrations', seed.interestRegistrations)
put('adminAuditLog', seed.adminAuditLog)
put('erasedOrganizations', seed.erasedOrganizations)
// The claims marker each sign-in's app listens to (rulebook §16): the same stamp as its claims, so nothing waits.
for (const user of SEED_AUTH_USERS) {
  if (user.role === 'owner') continue
  writes.push({ update: { name: docName(`users/${user.uid}/private/authClaims`), fields: toRestFields({ v: SEED_CLAIMS_STAMP }) } })
}
for (const sheet of seed.timesheets) {
  writes.push({ update: { name: docName(`organizations/${sheet.orgId}/settings/${sheet.id}`), fields: toRestFields(sheet.data) } })
}

await clear()
await createAuthUsers(seed)
await commit(writes)
console.log(`owner-console seed: ${SEED_AUTH_USERS.length} sign-ins and ${writes.length} documents written to ${project} (emulator).`)

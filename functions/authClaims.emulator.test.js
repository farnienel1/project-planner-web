'use strict'

/**
 * The auth-claims sync (rulebook 1.32.4 §16) against the Firestore emulator: the admin SDK store's queries (the
 * `members.{uid}` listing, the creator query, memberships, the home organisation) and the marker write. Auth is a fake
 * (recorded calls). Not part of CI or `npm test`: it needs a running emulator.
 *
 *   java -jar cloud-firestore-emulator-*.jar --port 8080      # or: firebase emulators:start --only firestore
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test functions/authClaims.emulator.test.js
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore')
const canonical = require('./loadCanonical')
const { createAuthClaimsSync, createAdminAuthClaimsStore } = require('./authClaims')

const HOST = process.env.FIRESTORE_EMULATOR_HOST
const PROJECT = 'demo-auth-claims-1324'

test('auth claims on the emulator: listing, creator, memberships, home organisation and the marker', { skip: !HOST && 'FIRESTORE_EMULATOR_HOST is not set' }, async () => {
  const app = initializeApp({ projectId: PROJECT }, `claims-${Date.now()}`)
  const db = getFirestore(app)
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  const seed = {
    'users/u1': { organizationId: 'HOME', role: 'operative', operativeMode: true },
    'organizations/HOME': { members: { u1: 'member' } },
    'organizations/LISTED': { members: { u1: 'manager', other: 'admin' } },
    'organizations/CREATED': { creatorUserId: 'u1', members: {} },
    'organizations/UNRELATED': { members: { other: 'admin' } },
    'users/u1/orgMemberships/LISTED': { role: 'manager', permissions: { smallWorks: true } },
  }
  for (const [path, data] of Object.entries(seed)) await db.doc(path).set(data)
  const set = []
  const auth = {
    async getUser(uid) {
      return { uid, customClaims: {} }
    },
    async setCustomUserClaims(uid, claims) {
      set.push({ uid, claims: JSON.parse(JSON.stringify(claims)) })
    },
    async revokeRefreshTokens() {},
  }
  const sync = createAuthClaimsSync({ store: createAdminAuthClaimsStore(db, { FieldPath, FieldValue }), auth, canonical, now: () => 42 })
  const result = await sync.syncPerson('u1')
  assert.equal(result.changed, true)
  assert.deepEqual(set[0].claims.pp.o, {
    home: ['operative', 'member', 'c', 'h'],
    listed: ['manager', 'manager', 'c', 'W'],
    created: ['', '', 'c', 'C', 'S', 'B'],
  })
  const marker = (await db.doc('users/u1/private/authClaims').get()).data()
  assert.equal(marker.v, 42)
  assert.ok(marker.updatedAt)
})

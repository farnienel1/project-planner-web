'use strict'

/**
 * Rulebook 1.32.4 §16: a person's role and company facts as Firebase Auth custom claims (`pp`), which the security
 * rules read instead of looking up `users/{uid}`, `organizations/{orgId}.members` and the person's memberships at every
 * call site.
 *
 * `syncPerson(uid)` reads what the claims are made of — `users/{uid}`, `users/{uid}/orgMemberships/*`, every
 * organisation whose `members` map lists the person or whose `creatorUserId` is them, and the organisation their users
 * document names — computes the claims with the rulebook's `authClaimsForPerson`, and only when they differ from the
 * claims the account already carries (`authClaimsEqual`, the stamp aside):
 *   1. `setCustomUserClaims(uid, { ...otherClaims, pp })`;
 *   2. when an organisation lost access (deactivated, removed: `authClaimsRevokeAccess`), `revokeRefreshTokens(uid)`;
 *   3. writes the marker `users/{uid}/private/authClaims` `{ v: <pp.s>, updatedAt, omittedOrganizationIds }`, which the
 *      apps listen to and then refresh their ID token. Only the server writes it (the rules let the person read it).
 * A users document with no Auth account (an invite placeholder) is skipped. The same code runs in the backfill
 * (`scripts/backfill-auth-claims.mjs`), so the triggers and the backfill set the same claims.
 */

function trimmed(value) {
  return String(value ?? '').trim()
}

/** The last path segment of an organisation id stored as an id, an "organizations/<id>" string or a reference. */
function storedOrganizationId(value) {
  if (typeof value === 'string') {
    const parts = value.split('/')
    return trimmed(parts[parts.length - 1])
  }
  if (value && typeof value === 'object' && typeof value.path === 'string') {
    const parts = value.path.split('/')
    return trimmed(parts[parts.length - 1])
  }
  return ''
}

/**
 * `store` reads Firestore: `user(uid)`, `memberships(uid)` → { orgId: data }, `organizationsListing(uid)` → { orgId: data }
 * (members map entry or creator), `organization(orgId)` → data | null, `writeMarker(uid, fields)`.
 * `auth`: `getUser(uid)`, `setCustomUserClaims(uid, claims)`, `revokeRefreshTokens(uid)`.
 */
function createAuthClaimsSync({ store, auth, canonical, logger = console, now = () => Date.now() }) {
  async function inputsFor(uid) {
    const [user, memberships, listing] = await Promise.all([store.user(uid), store.memberships(uid), store.organizationsListing(uid)])
    const organizations = { ...listing }
    const home = user ? storedOrganizationId(user.organizationId) : ''
    if (home && !(home in organizations)) {
      const data = await store.organization(home)
      if (data) organizations[home] = data
    }
    return { user, memberships, organizations }
  }

  async function syncPerson(uid) {
    const id = trimmed(uid)
    if (!id || id.includes('/')) return { uid: id, skipped: 'bad-uid' }
    let account
    try {
      account = await auth.getUser(id)
    } catch (error) {
      if (error && (error.code === 'auth/user-not-found' || error.errorInfo?.code === 'auth/user-not-found')) {
        return { uid: id, skipped: 'no-auth-user' }
      }
      throw error
    }
    const inputs = await inputsFor(id)
    const result = canonical.authClaimsForPerson({ uid: id, ...inputs, stamp: now() })
    const existing = account && account.customClaims && typeof account.customClaims === 'object' ? account.customClaims : {}
    if (canonical.authClaimsEqual(existing[canonical.AUTH_CLAIMS_KEY], result.claims.pp)) {
      return { uid: id, changed: false, omittedOrganizationIds: result.omittedOrganizationIds }
    }
    await auth.setCustomUserClaims(id, { ...existing, [canonical.AUTH_CLAIMS_KEY]: result.claims.pp })
    const revoked = canonical.authClaimsRevokeAccess(existing, result.claims)
    if (revoked) await auth.revokeRefreshTokens(id)
    await store.writeMarker(id, { v: result.claims.pp.s, omittedOrganizationIds: result.omittedOrganizationIds })
    if (result.omittedOrganizationIds.length > 0) {
      logger.warn('auth claims: organisations left out (over the claims size limit)', { uid: id, omitted: result.omittedOrganizationIds })
    }
    return { uid: id, changed: true, revoked, claims: result.claims, omittedOrganizationIds: result.omittedOrganizationIds }
  }

  /** Every person an organisation write can affect: their claims are recomputed one by one. */
  async function syncOrganizationChange(before, after) {
    const report = []
    for (const uid of canonical.authClaimsOrganizationAffectedUids(before, after)) {
      try {
        report.push(await syncPerson(uid))
      } catch (error) {
        logger.error('auth claims: sync failed', { uid, error: String(error && error.message ? error.message : error) })
        report.push({ uid, error: true })
      }
    }
    return report
  }

  return { syncPerson, syncOrganizationChange, inputsFor }
}

/** The Firestore half of the sync for the admin SDK. */
function createAdminAuthClaimsStore(db, { FieldPath, FieldValue }) {
  return {
    async user(uid) {
      const snap = await db.doc(`users/${uid}`).get()
      return snap.exists ? snap.data() : null
    },
    async memberships(uid) {
      const snaps = await db.collection(`users/${uid}/orgMemberships`).get()
      const out = {}
      for (const snap of snaps.docs) out[snap.id] = snap.data()
      return out
    },
    async organizationsListing(uid) {
      const [listed, created] = await Promise.all([
        db.collection('organizations').orderBy(new FieldPath('members', uid)).get(),
        db.collection('organizations').where('creatorUserId', '==', uid).get(),
      ])
      const out = {}
      for (const snap of [...listed.docs, ...created.docs]) out[snap.id] = snap.data()
      return out
    },
    async organization(orgId) {
      if (!orgId || orgId.includes('/')) return null
      const snap = await db.doc(`organizations/${orgId}`).get()
      return snap.exists ? snap.data() : null
    },
    async writeMarker(uid, fields) {
      await db.doc(`users/${uid}/private/authClaims`).set({ ...fields, updatedAt: FieldValue.serverTimestamp() })
    },
  }
}

module.exports = { createAuthClaimsSync, createAdminAuthClaimsStore, storedOrganizationId }

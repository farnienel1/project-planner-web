'use strict'

/**
 * Daily eraser for organisations deleted 60+ days ago (rulebook 1.15.0 §20, `organizationEraseDue`).
 *
 * For each `organizations/{orgId}` whose `deletion.status` is `scheduled` and whose `eraseAfter` has passed:
 *   1. users whose users document names this organisation and who have no membership in another organisation:
 *      their tax ids, memberships and users document are deleted and their Firebase Auth account removed (never the
 *      platform owner); people who also belong elsewhere keep their account and lose only this membership;
 *   2. every `users/{uid}/orgMemberships/{orgId}` for this organisation (collection group, by `organizationId`);
 *   3. top-level `invitations` of this organisation;
 *   4. Storage files under `organizations/{orgId}/`;
 *   5. the organisation document with every subcollection (`userEmails` claims, bookings, timesheets, …);
 *   6. the audit row `erasedOrganizations/{orgId}` `{ erasedAt, name }` — no personal data.
 * The audit row is written first as `status: 'erasing'` and finished last, so a run that stops half way is picked
 * up again the next day (the organisation document is deleted last). Running it twice changes nothing more.
 *
 * Dependencies are injected so the plan is tested with a fake Firestore (`dryRun` lists the work without writing).
 */

const ERASED_ORGANIZATIONS_COLLECTION = 'erasedOrganizations'
const PLATFORM_OWNER_EMAIL = 'info@projectplanner.us'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function orgIdOf(value) {
  const raw = text(value)
  if (!raw) return ''
  const parts = raw.split('/').filter(Boolean)
  return (parts[parts.length - 1] || '').toLowerCase()
}

/**
 * @param {object} deps
 * @param {object} deps.canonical   the packed rulebook (`organizationEraseDue`, `erasedOrganizationAuditFields`)
 * @param {object} deps.store       Firestore access:
 *   scheduledOrganizations() → [{ id, data }]
 *   usersOfOrganization(orgId) → [{ id, data }]           (users where organizationId == orgId)
 *   membershipsOfOrganization(orgId) → [{ uid, path }]     (collection group orgMemberships for orgId)
 *   membershipOrgIds(uid) → [orgId]                        (ids of users/{uid}/orgMemberships)
 *   invitationsOfOrganization(orgId) → [path]
 *   deleteDocument(path), deleteRecursive(path), setDocument(path, fields)
 * @param {(prefix: string) => Promise<void>} deps.deleteStoragePrefix
 * @param {(uid: string) => Promise<void>} deps.deleteAuthUser
 * @param {number} [deps.now]
 * @param {boolean} [deps.dryRun]
 * @param {{ info: Function, warn: Function }} [deps.logger]
 */
async function eraseDueOrganizations(deps) {
  const now = typeof deps.now === 'number' ? deps.now : Date.now()
  const log = deps.logger || { info() {}, warn() {} }
  const report = []
  for (const org of await deps.store.scheduledOrganizations()) {
    if (!deps.canonical.organizationEraseDue(org.data, now)) continue
    report.push(await eraseOrganization(org, { ...deps, now, logger: log }))
  }
  return report
}

async function eraseOrganization(org, deps) {
  const orgId = org.id
  const actions = []
  const act = async (label, fn) => {
    actions.push(label)
    if (!deps.dryRun) await fn()
  }
  const audit = deps.canonical.erasedOrganizationAuditFields(org.data, deps.now)
  const auditPath = `${ERASED_ORGANIZATIONS_COLLECTION}/${orgId}`
  await act(`set ${auditPath} (erasing)`, () => deps.store.setDocument(auditPath, { ...audit, status: 'erasing' }))

  for (const user of await deps.store.usersOfOrganization(orgId)) {
    const otherOrgs = (await deps.store.membershipOrgIds(user.id)).filter((id) => orgIdOf(id) !== orgIdOf(orgId))
    if (otherOrgs.length > 0) continue
    await act(`delete users/${user.id}/private/taxIds`, () => deps.store.deleteDocument(`users/${user.id}/private/taxIds`))
    await act(`delete users/${user.id} (recursive)`, () => deps.store.deleteRecursive(`users/${user.id}`))
    const email = text(user.data && user.data.email).toLowerCase()
    if (email !== PLATFORM_OWNER_EMAIL) {
      await act(`delete auth ${user.id}`, () =>
        deps.deleteAuthUser(user.id).catch((error) => {
          if (!/not.?found/i.test(String((error && (error.code || error.message)) || error))) throw error
        })
      )
    }
  }
  for (const membership of await deps.store.membershipsOfOrganization(orgId)) {
    await act(`delete ${membership.path}`, () => deps.store.deleteDocument(membership.path))
  }
  for (const path of await deps.store.invitationsOfOrganization(orgId)) {
    await act(`delete ${path}`, () => deps.store.deleteDocument(path))
  }
  await act(`delete storage organizations/${orgId}/`, () => deps.deleteStoragePrefix(`organizations/${orgId}/`))
  await act(`delete organizations/${orgId} (recursive)`, () => deps.store.deleteRecursive(`organizations/${orgId}`))
  await act(`set ${auditPath} (erased)`, () => deps.store.setDocument(auditPath, { ...audit, status: 'erased' }))
  deps.logger.info('organisation erased', { orgId, dryRun: Boolean(deps.dryRun), actions: actions.length })
  return { orgId, actions }
}

/** The Firestore access for `eraseDueOrganizations`, from the admin SDK. */
function createAdminEraserStore(db) {
  return {
    async scheduledOrganizations() {
      const snap = await db.collection('organizations').where('deletion.status', '==', 'scheduled').get()
      return snap.docs.map((row) => ({ id: row.id, data: { id: row.id, ...row.data() } }))
    },
    async usersOfOrganization(orgId) {
      // Stored as the id, or (older documents) as the path `organizations/{id}`.
      const rows = new Map()
      for (const value of [orgId, `organizations/${orgId}`]) {
        const snap = await db.collection('users').where('organizationId', '==', value).get()
        for (const row of snap.docs) rows.set(row.id, { id: row.id, data: row.data() })
      }
      return [...rows.values()]
    },
    async membershipsOfOrganization(orgId) {
      const snap = await db.collectionGroup('orgMemberships').where('organizationId', '==', orgId).get()
      return snap.docs.map((row) => ({ uid: row.ref.parent.parent ? row.ref.parent.parent.id : '', path: row.ref.path }))
    },
    async membershipOrgIds(uid) {
      const snap = await db.collection('users').doc(uid).collection('orgMemberships').get()
      return snap.docs.map((row) => row.id)
    },
    async invitationsOfOrganization(orgId) {
      const snap = await db.collection('invitations').where('organizationId', '==', orgId).get()
      return snap.docs.map((row) => row.ref.path)
    },
    async deleteDocument(path) {
      await db.doc(path).delete()
    },
    async deleteRecursive(path) {
      await db.recursiveDelete(db.doc(path))
    },
    async setDocument(path, fields) {
      await db.doc(path).set(fields, { merge: true })
    },
  }
}

module.exports = { ERASED_ORGANIZATIONS_COLLECTION, createAdminEraserStore, eraseDueOrganizations }

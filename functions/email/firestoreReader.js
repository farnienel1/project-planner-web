'use strict'

const canonical = require('../loadCanonical')

/** The Firestore reads `sendEmail` needs (Admin SDK). Every read is one document or a bounded query. */

const { normalizeEmail } = require('./text')

function createFirestoreReader(db) {
  async function getData(path) {
    const snap = await db.doc(path).get()
    return snap.exists ? snap.data() || {} : null
  }
  return {
    getOrganization: (orgId) => getData(`organizations/${orgId}`),
    getUser: (uid) => getData(`users/${uid}`),
    getMembership: (uid, orgId) => (orgId ? getData(`users/${uid}/orgMemberships/${orgId}`) : Promise.resolve(null)),
    getInvitation: (id) => getData(`invitations/${id}`),
    /**
     * A job of this organisation as `{ kind, data }` (`kind` is its collection, `projects` or `smallWorks`, as
     * `canSeeJob` reads it): its project, else its small works document; null when neither exists.
     */
    async getJob(orgId, jobId) {
      if (!orgId || !jobId) return null
      // Both collections are read at once; the project still wins when both exist (older iOS builds, §17).
      const [project, smallWorks] = await Promise.all([
        getData(`organizations/${orgId}/projects/${jobId}`),
        getData(`organizations/${orgId}/smallWorks/${jobId}`),
      ])
      if (project) return { kind: 'projects', data: project }
      return smallWorks ? { kind: 'smallWorks', data: smallWorks } : null
    },
    /** The organisation's `managers` rows on this email (a job may name the caller's managers-list row, §17). */
    async managersByEmail(orgId, email) {
      const wanted = normalizeEmail(email)
      if (!orgId || !wanted) return []
      const snap = await db.collection('organizations').doc(orgId).collection('managers').where('email', '==', wanted).limit(10).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    },
    async usersByEmail(email, orgId) {
      const wanted = normalizeEmail(email)
      const exact = await db.collection('users').where('email', '==', wanted).limit(10).get()
      if (!exact.empty) return exact.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      if (!orgId) return []
      // An email stored with capitals: look within this organisation's roster only.
      const roster = await db.collection('users').where('organizationId', '==', orgId).limit(500).get()
      return roster.docs
        .filter((doc) => normalizeEmail((doc.data() || {}).email) === wanted)
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    },
    /**
     * Rulebook 1.59.0 §16 (review of #370, L2): which of these addresses already have their
     * `organizations/{orgId}/materialContacts/{email}` document — one read per address (`getAll`).
     */
    async knownMaterialContacts(orgId, emails) {
      const keys = [...new Set((emails || []).map((email) => canonical.materialContactKey(email)).filter(Boolean))]
      const known = new Set()
      if (keys.length === 0) return known
      const contacts = db.collection('organizations').doc(orgId).collection(canonical.MATERIAL_CONTACTS_COLLECTION)
      const snaps = await db.getAll(...keys.map((key) => contacts.doc(key)))
      snaps.forEach((snap, index) => {
        if (snap.exists) known.add(keys[index])
      })
      return known
    },
    /** Creates the contact documents of these address keys (`materialContactCreateFields`); one already there is kept. */
    async recordMaterialContacts(orgId, keys) {
      const { FieldValue } = require('firebase-admin/firestore')
      const contacts = db.collection('organizations').doc(orgId).collection(canonical.MATERIAL_CONTACTS_COLLECTION)
      await Promise.all(
        (keys || []).map((key) =>
          contacts
            .doc(key)
            .create({ firstSentAt: FieldValue.serverTimestamp() })
            .catch((error) => {
              if (error && (error.code === 6 || /ALREADY_EXISTS/.test(String(error.message)))) return null
              throw error
            })
        )
      )
    },
    async listWholesalers(orgId) {
      const snap = await db.collection('organizations').doc(orgId).collection('wholesalers').limit(500).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    },
  }
}

module.exports = { createFirestoreReader }

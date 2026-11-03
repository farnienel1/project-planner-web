'use strict'

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
    /** A job of this organisation: its project, else its small works document; null when neither exists. */
    async getJob(orgId, jobId) {
      if (!orgId || !jobId) return null
      return (await getData(`organizations/${orgId}/projects/${jobId}`)) || (await getData(`organizations/${orgId}/smallWorks/${jobId}`))
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
    async listWholesalers(orgId) {
      const snap = await db.collection('organizations').doc(orgId).collection('wholesalers').limit(500).get()
      return snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    },
  }
}

module.exports = { createFirestoreReader }

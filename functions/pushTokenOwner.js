'use strict'

/**
 * Rulebook 1.16.0 §13: one account per device token. Finds every users document holding `token`
 * (`pushTokens array-contains`) and removes it from all but `ownerUid` (`pushTokenOwnerWrites` from the packed
 * rulebook). Logs only token suffixes.
 */
async function removeTokenFromOtherAccounts({ db, canonical, token, ownerUid, logger }) {
  const snap = await db.collection('users').where('pushTokens', 'array-contains', token).get()
  const holders = snap.docs.map((doc) => ({ id: doc.id, pushTokens: (doc.data() || {}).pushTokens }))
  const writes = canonical.pushTokenOwnerWrites(token, ownerUid, holders)
  if (writes.length === 0) return []
  const { FieldValue } = require('firebase-admin/firestore')
  const batch = db.batch()
  for (const write of writes) {
    batch.update(db.doc(`users/${write.userId}`), { pushTokens: FieldValue.arrayRemove(...write.remove) })
  }
  await batch.commit()
  if (logger && typeof logger.info === 'function') {
    logger.info('moved push token to its newest account', {
      ownerUid,
      removedFrom: writes.map((write) => write.userId),
      suffix: String(token).slice(-10),
    })
  }
  return writes
}

module.exports = { removeTokenFromOtherAccounts }

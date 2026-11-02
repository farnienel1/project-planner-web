'use strict'

/**
 * Rulebook §13: a row is never pushed to the person who caused it (`actorUserId`), under the row's
 * `userId` or one of the recipient's `formerUserIds` — except types whose push is meant for the actor
 * (`notificationPushesToActor`, only `push_test`: Settings "send a test notification").
 */

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function idList(raw) {
  return Array.isArray(raw) ? raw.map((value) => trimmed(value)).filter(Boolean) : []
}

/** True when the actor is the recipient under the row's userId or one of the recipient's former ids. */
function actorIsRecipient(actorUserId, userId, user) {
  const actor = trimmed(actorUserId).toLowerCase()
  if (!actor) return false
  const ids = [userId, ...idList(user && user.formerUserIds)].map((id) => trimmed(id).toLowerCase())
  return ids.includes(actor)
}

/** True when this row must not be pushed because the recipient is its actor. */
function skipPushForActor(canonical, type, actorUserId, userId, user) {
  if (canonical && typeof canonical.notificationPushesToActor === 'function' && canonical.notificationPushesToActor(type)) {
    return false
  }
  return actorIsRecipient(actorUserId, userId, user)
}

module.exports = { actorIsRecipient, skipPushForActor }

'use strict'

/**
 * One FCM / APNs alert on create of organizations/{orgId}/notifications/{id}.
 * Allow-list, preference check, and badge count come from the packed rulebook.
 * Do not copy those lists here. Same document id must not push again on update.
 *
 * Rulebook §13: a row is never pushed to the person who caused it. `actorUserId` (written by the
 * app, validated by security rules) equal to the row's `userId`, or to one of the recipient's
 * `formerUserIds`, means no push — a last guard behind the recipient rules. The badge counts the
 * recipient's own unread rows only (`userId == recipient`, `isRead == false`, bounded read), the
 * same rule as `unreadNotificationBadgeCount`.
 *
 * Email HTTP `sendProjectPlannerEmail` already lives on this Firebase project
 * (us-central1). This package is codebase `inbox-push` so a deploy here does
 * not replace that function.
 *
 * After sendEachForMulticast, pruneDeadPushTokens drops only tokens whose
 * result is invalid APNs credential, unregistered, or invalid registration
 * token. Accepted tokens stay. One failure must not clear the array.
 */

const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')
const canonical = require('./loadCanonical')
const { pruneDeadPushTokens } = require('./prunePushTokens')

initializeApp()

function trimmed(value) {
  return String(value ?? '').trim()
}

function pushTokenList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((token) => trimmed(token)).filter(Boolean)
  }
  const single = trimmed(raw)
  return single ? [single] : []
}

/** Most unread rows read for the icon badge; the badge is a hint, not a ledger. */
const BADGE_READ_LIMIT = 100

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

function asInboxRow(id, data) {
  const row = data && typeof data === 'object' ? data : {}
  return {
    id: trimmed(id),
    userId: trimmed(row.userId) || null,
    isRead: row.isRead === true,
    type: trimmed(row.type),
  }
}

exports.sendDevicePushOnNotificationCreate = onDocumentCreated(
  {
    document: 'organizations/{orgId}/notifications/{notificationId}',
    region: 'us-central1',
  },
  async (event) => {
    const created = event.data
    if (!created) return
    const data = created.data() || {}
    const type = trimmed(data.type)
    const userId = trimmed(data.userId)
    const orgId = trimmed(event.params.orgId)
    const notificationId = trimmed(event.params.notificationId)
    if (!type || !userId || !orgId || !notificationId) return
    if (!canonical.notificationDeliversDevicePush(type)) return
    // Never push a row to the person who caused it (cheap check before any read).
    if (actorIsRecipient(data.actorUserId, userId, null)) return

    const db = getFirestore()
    const userSnap = await db.doc(`users/${userId}`).get()
    if (!userSnap.exists) return
    const user = userSnap.data() || {}
    if (actorIsRecipient(data.actorUserId, userId, user)) return
    const prefs = canonical.parseUserNotificationPreferences(user.notificationPreferences)
    if (!canonical.notificationPreferenceAllowsDelivery(prefs, type)) return

    const tokens = pushTokenList(user.pushTokens)
    if (tokens.length === 0) return

    // Only this recipient's unread rows, bounded (never the whole organisation's inbox).
    const unreadSnap = await db
      .collection('organizations')
      .doc(orgId)
      .collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .limit(BADGE_READ_LIMIT)
      .get()
    const byId = new Map()
    for (const doc of unreadSnap.docs) {
      byId.set(doc.id, asInboxRow(doc.id, doc.data()))
    }
    byId.set(notificationId, asInboxRow(notificationId, data))
    // The icon badge matches the inbox: toggles stop pushes, never inbox rows.
    const listed = [...byId.values()].filter((row) => canonical.notificationShowsInInbox(prefs, row.type))
    const badge = canonical.unreadNotificationBadgeCount(listed, userId)

    const title = trimmed(data.title)
    const message = trimmed(data.message)
    const relatedId = trimmed(data.relatedId)
    try {
      const batch = await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title,
          body: message,
        },
        data: {
          notificationId,
          type,
          relatedId,
          organizationId: orgId,
        },
        apns: {
          payload: {
            aps: {
              badge,
              sound: 'default',
            },
          },
        },
      })
      try {
        await pruneDeadPushTokens({
          db,
          userId,
          tokens,
          responses: batch.responses,
          logger,
        })
      } catch (error) {
        logger.error('push token prune failed', { notificationId, orgId, userId, error })
      }
    } catch (error) {
      logger.error('device push failed', { notificationId, orgId, userId, error })
    }
  }
)

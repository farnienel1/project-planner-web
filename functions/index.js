'use strict'

/**
 * One FCM / APNs alert on create of organizations/{orgId}/notifications/{id}.
 * Allow-list, preference check, and badge count come from the packed rulebook.
 * Do not copy those lists here. Same document id must not push again on update.
 *
 * Rulebook 1.12.0 (§13, H4): a row is pushed only to an active member of its organisation (`organizationMemberActive`,
 * `pushRecipientGuard.js`), the same test the security rules apply on create.
 *
 * Rulebook §13: a row is never pushed to the person who caused it. `actorUserId` (written by the
 * app, validated by security rules) equal to the row's `userId`, or to one of the recipient's
 * `formerUserIds`, means no push — a last guard behind the recipient rules (`pushActorGuard.js`). The one
 * exception is a type whose push is for the actor (`notificationPushesToActor`: `push_test`). The badge counts the
 * recipient's own unread rows only (`userId == recipient`, `isRead == false`, bounded read), the
 * same rule as `unreadNotificationBadgeCount`.
 *
 * Email: `sendEmail` (below, `email/`) is the authenticated email function for both apps — fixed templates, recipient
 * rules, rate limit (docs/EMAIL_FUNCTION.md). The old open `sendProjectPlannerEmail` was deployed outside this repo
 * and is not in this codebase (`inbox-push`), so a deploy here neither replaces nor deletes it; the owner deletes it
 * once both apps call `sendEmail`.
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
const { skipPushForActor } = require('./pushActorGuard')
const { recipientMayReceivePush } = require('./pushRecipientGuard')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getAuth } = require('firebase-admin/auth')
const { getAppCheck } = require('firebase-admin/app-check')
const { createSendEmailHandler, resendSender } = require('./email/handler')
const { createFirestoreReader } = require('./email/firestoreReader')
const { consumeRateLimit } = require('./email/rateLimit')

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



function asInboxRow(id, data) {
  const row = data && typeof data === 'object' ? data : {}
  return {
    id: trimmed(id),
    userId: trimmed(row.userId) || null,
    isRead: row.isRead === true,
    type: trimmed(row.type),
    // Rulebook 1.10.0: a row counts only from its createdAt (`unreadNotificationBadgeCount` with now).
    createdAt: row.createdAt && typeof row.createdAt.toMillis === 'function' ? row.createdAt.toMillis() : row.createdAt ?? null,
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
    if (skipPushForActor(canonical, type, data.actorUserId, userId, null)) return
    // A row dated in the future is not in the inbox yet (1.10.0), so it is not pushed now.
    if (!canonical.inboxNotificationVisibleToUser(asInboxRow(notificationId, data), userId, Date.now())) return

    const db = getFirestore()
    const userSnap = await db.doc(`users/${userId}`).get()
    if (!userSnap.exists) return
    const user = userSnap.data() || {}
    if (skipPushForActor(canonical, type, data.actorUserId, userId, user)) return
    // 1.12.0 (H4): only an active member of this organisation (`organizationMemberActive`) — never a uid from another
    // company or a person this organisation has deactivated.
    const [orgSnap, membershipSnap] = await Promise.all([
      db.doc(`organizations/${orgId}`).get(),
      db.doc(`users/${userId}/orgMemberships/${orgId}`).get(),
    ])
    if (
      !recipientMayReceivePush(canonical, {
        orgId,
        userId,
        organization: orgSnap.exists ? orgSnap.data() : null,
        user,
        membership: membershipSnap.exists ? membershipSnap.data() : null,
      })
    ) {
      return
    }
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
    const badge = canonical.unreadNotificationBadgeCount(listed, userId, Date.now())

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

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const EMAIL_SERVER_KEY = defineSecret('EMAIL_SERVER_KEY')

let sendEmailHandler = null

function emailHandler() {
  if (sendEmailHandler) return sendEmailHandler
  const db = getFirestore()
  sendEmailHandler = createSendEmailHandler({
    verifyIdToken: (token) => getAuth().verifyIdToken(token, true),
    verifyAppCheck: (token) => getAppCheck().verifyToken(token),
    reader: createFirestoreReader(db),
    consumeRateLimit: (key, count, limits) => consumeRateLimit(db, key, count, limits),
    sendMessage: resendSender(() => RESEND_API_KEY.value()),
    serverKey: () => EMAIL_SERVER_KEY.value() || '',
    logger,
  })
  return sendEmailHandler
}

/**
 * Authenticated email (docs/EMAIL_FUNCTION.md). Public at the IAM level (iOS calls it with a plain URLRequest);
 * every request is checked in code: a Firebase ID token (or the web server key), membership, template, recipients,
 * attachments and the per-sender rate limit. No CORS: neither app calls it from a browser.
 */
exports.sendEmail = onRequest(
  {
    region: 'us-central1',
    secrets: [RESEND_API_KEY, EMAIL_SERVER_KEY],
    invoker: 'public',
    cors: false,
    maxInstances: 10,
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  (req, res) => emailHandler()(req, res)
)

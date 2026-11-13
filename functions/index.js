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
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore')
const { logger } = require('firebase-functions')
const canonical = require('./loadCanonical')
const { pruneDeadPushTokens } = require('./prunePushTokens')
const { skipPushForActor } = require('./pushActorGuard')
const { recipientMayReceivePush } = require('./pushRecipientGuard')
const { removeTokenFromOtherAccounts } = require('./pushTokenOwner')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getAuth } = require('firebase-admin/auth')
const { getAppCheck } = require('firebase-admin/app-check')
const { getStorage } = require('firebase-admin/storage')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { createAdminEraserStore, eraseDueOrganizations } = require('./organizationEraser')
const { createSendEmailHandler, resendSender } = require('./email/handler')
const { createFirestoreReader } = require('./email/firestoreReader')
const { consumeRateLimit } = require('./email/rateLimit')
const { createAdminRequestDedupe } = require('./email/requestDedupe')
const { FieldPath, FieldValue } = require('firebase-admin/firestore')
const { createAuthClaimsSync, createAdminAuthClaimsStore } = require('./authClaims')

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

    // 1.16.0 (§13): never push to a token that is also on the actor's own users document — the phone in the actor's
    // hand hears nothing about what its own user did, even while an old token still sits on this document.
    let actorTokens = []
    const actorUserId = trimmed(data.actorUserId)
    if (actorUserId && actorUserId !== userId && !canonical.notificationPushesToActor(type)) {
      const actorSnap = await db.doc(`users/${actorUserId}`).get().catch(() => null)
      actorTokens = actorSnap && actorSnap.exists ? pushTokenList((actorSnap.data() || {}).pushTokens) : []
    }
    const tokens = canonical.pushTokensExcludingActor(pushTokenList(user.pushTokens), actorTokens)
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
    try {
      const batch = await getMessaging().sendEachForMulticast({
        tokens,
        notification: {
          title,
          body: message,
        },
        // 1.16.0: one payload shape for every platform (`pushPayloadFields`), so a tapped push routes like the row.
        data: canonical.pushPayloadFields({ ...data, notificationId, type, userId, organizationId: orgId }),
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

/**
 * Rulebook 1.16.0 §13: a device token belongs to exactly one account, the last one to register it. When a users
 * document gains a token (`addedPushTokens`), remove it from every other users document (`pushTokenOwnerWrites`).
 * 1.17.0: a placeholder users document (UUID-shaped id) never owns a token; its new token is removed from it instead.
 * Only removals are written, so the writes this makes never re-trigger an add.
 */
exports.pushTokenSingleOwner = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null
    if (!after) return
    const before = event.data.before && event.data.before.exists ? event.data.before.data() : null
    const added = canonical.addedPushTokens(before ? before.pushTokens : [], after.pushTokens)
    if (added.length === 0) return
    const uid = trimmed(event.params.uid)
    for (const token of added) {
      try {
        await removeTokenFromOtherAccounts({ db: getFirestore(), canonical, token, ownerUid: uid, logger })
      } catch (error) {
        logger.error('push token single-owner sweep failed', { uid, error })
      }
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
    // `requestId` idempotency: `emailRequestSends/{key}` (Admin SDK only; no security rule matches it).
    requestDedupe: createAdminRequestDedupe(db),
    sendMessage: resendSender(() => RESEND_API_KEY.value()),
    // Trimmed: a secret set from a file keeps its trailing newline (handler `sameSecret` trims too).
    serverKey: () => String(EMAIL_SERVER_KEY.value() || '').trim(),
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

/**
 * Rulebook 1.15.0 §20: once a day, erase every organisation deleted more than `DELETION_RESTORE_DAYS` (30 from 1.27.0) days ago
 * (`organizationEraseDue`). See organizationEraser.js for what is removed; the audit row is
 * `erasedOrganizations/{orgId}` `{ erasedAt, name }`.
 */
exports.eraseDeletedOrganizations = onSchedule(
  { schedule: 'every day 03:17', timeZone: 'Europe/London', region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    const db = getFirestore()
    const report = await eraseDueOrganizations({
      canonical,
      store: createAdminEraserStore(db),
      deleteStoragePrefix: (prefix) => getStorage().bucket().deleteFiles({ prefix, force: true }),
      deleteAuthUser: (uid) => getAuth().deleteUser(uid),
      logger,
    })
    logger.info('eraseDeletedOrganizations', { erased: report.map((row) => row.orgId) })
  }
)

/**
 * Rulebook 1.32.4 §16: the security rules read a person's role and company facts from their Auth custom claims (`pp`,
 * `authClaimsForPerson`). These triggers recompute them whenever what they are made of changes — the person's users
 * document (only the fields in `AUTH_CLAIMS_USER_FIELDS`, or creation / deletion), one of their memberships, or an
 * organisation's `members` map / `creatorUserId` — set them only when they changed, revoke refresh tokens when access
 * was taken away, and write the marker `users/{uid}/private/authClaims` that the apps listen to (authClaims.js).
 * Deploy: `firebase deploy --only functions:inbox-push:authClaimsOnUserWrite,functions:inbox-push:authClaimsOnMembershipWrite,functions:inbox-push:authClaimsOnOrganizationWrite`
 * (docs/scripts/backfill-auth-claims.md).
 */
let authClaimsSync = null
function claimsSync() {
  if (authClaimsSync) return authClaimsSync
  authClaimsSync = createAuthClaimsSync({
    store: createAdminAuthClaimsStore(getFirestore(), { FieldPath, FieldValue }),
    auth: getAuth(),
    canonical,
    logger,
  })
  return authClaimsSync
}

function eventDocData(snapshot) {
  return snapshot && snapshot.exists ? snapshot.data() : null
}

exports.authClaimsOnUserWrite = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const before = eventDocData(event.data && event.data.before)
    const after = eventDocData(event.data && event.data.after)
    if (!canonical.authClaimsUserInputsChanged(before, after)) return
    const result = await claimsSync().syncPerson(event.params.uid)
    if (result.changed) logger.info('auth claims updated', { uid: result.uid, revoked: result.revoked, source: 'user' })
  }
)

exports.authClaimsOnMembershipWrite = onDocumentWritten(
  { document: 'users/{uid}/orgMemberships/{orgId}', region: 'us-central1' },
  async (event) => {
    const result = await claimsSync().syncPerson(event.params.uid)
    if (result.changed) logger.info('auth claims updated', { uid: result.uid, revoked: result.revoked, source: 'membership' })
  }
)

exports.authClaimsOnOrganizationWrite = onDocumentWritten(
  { document: 'organizations/{orgId}', region: 'us-central1' },
  async (event) => {
    const before = eventDocData(event.data && event.data.before)
    const after = eventDocData(event.data && event.data.after)
    const report = await claimsSync().syncOrganizationChange(before, after)
    const changed = report.filter((row) => row.changed).map((row) => row.uid)
    if (changed.length > 0) logger.info('auth claims updated', { orgId: event.params.orgId, changed, source: 'organization' })
  }
)

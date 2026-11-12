'use strict'

/**
 * Idempotency for `sendEmail` (docs/EMAIL_FUNCTION.md "Request id"). A caller that may send the same request twice —
 * the iPhone replaying a queued material order after a crash or a timeout, or the web route retried — names it with
 * `requestId`. The first call claims `emailRequestSends/{key}` in a Firestore transaction and sends; any later call
 * with the same key gets the first call's answer back (`deduped: true`) without sending again and without counting
 * against the rate limit. A request without `requestId` is unchanged (older app builds).
 *
 * The key is the SHA-256 of the caller (uid, or `server`), the organisation, the template, the request id and the
 * recipients that will be sent to (trimmed, lower case, sorted). So the web route, which makes one call per recipient
 * with one request id, gets one key per recipient; and nobody can block another caller's request by reusing its id.
 *
 * States: `pending` while the first call is sending, `sent` once it answered. A `pending` claim younger than
 * `PENDING_STALE_MS` makes a second call wait (409, try again later); an older one belongs to a call that died
 * before it finished (the function times out after 60 s) and is taken over. A claim is released (deleted) when
 * nothing was sent — rate limited or every message refused — so a retry sends.
 *
 * Only the Admin SDK touches the collection: the security rules have no match for it (top-level, like
 * `emailRateLimits`), so apps can neither read nor clear it. Each record carries `expireAt` (30 days) so the owner may
 * add a Firestore TTL policy on it; nothing depends on that.
 */

const crypto = require('crypto')

const REQUEST_DEDUPE_COLLECTION = 'emailRequestSends'
/** A claim still `pending` after this long belongs to a call that died; the function itself times out after 60 s. */
const PENDING_STALE_MS = 5 * 60 * 1000
const RECORD_TTL_MS = 30 * 24 * 60 * 60 * 1000
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

class RequestIdError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

/**
 * `body.requestId`: '' when absent (null, undefined or ''), else 8–128 letters, digits, `-` or `_` (a UUID in any
 * case). Anything else is a 400: a build that sends a request id means it.
 */
function parseRequestId(value) {
  if (value == null || value === '') return ''
  const id = typeof value === 'string' ? value.trim() : ''
  if (!REQUEST_ID_PATTERN.test(id)) throw new RequestIdError('requestId is not valid')
  return id
}

function requestDedupeKey({ callerKey, orgId, template, requestId, recipients }) {
  const to = [...new Set((recipients || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))].sort()
  const material = JSON.stringify([String(callerKey || ''), String(orgId || ''), String(template || ''), String(requestId), to])
  return crypto.createHash('sha256').update(material).digest('hex')
}

/**
 * Pure step: what a call does given the stored record.
 * @returns {{ action: 'claim' } | { action: 'replay', response: object } | { action: 'inProgress' }}
 */
function requestDedupeDecision(stored, nowMs) {
  if (!stored || typeof stored !== 'object') return { action: 'claim' }
  if (stored.status === 'sent' && stored.response && typeof stored.response === 'object') {
    return { action: 'replay', response: stored.response }
  }
  const claimedAtMs = Number(stored.claimedAtMs)
  if (stored.status === 'pending' && Number.isFinite(claimedAtMs) && nowMs - claimedAtMs < PENDING_STALE_MS) {
    return { action: 'inProgress' }
  }
  return { action: 'claim' }
}

/** The record written when a call claims a key (no message contents; ids only). */
function pendingRecord({ orgId, uid, template, jobId, recipientCount }, nowMs) {
  return {
    status: 'pending',
    claimedAtMs: nowMs,
    expireAt: new Date(nowMs + RECORD_TTL_MS),
    orgId: orgId || null,
    uid: uid || null,
    template: template || null,
    jobId: typeof jobId === 'string' && jobId.trim() ? jobId.trim() : null,
    recipientCount: Number(recipientCount) || 0,
  }
}

/** Admin SDK store: claim (transaction), complete, release. */
function createAdminRequestDedupe(db) {
  const ref = (key) => db.collection(REQUEST_DEDUPE_COLLECTION).doc(key)
  return {
    async claim(key, details, nowMs = Date.now()) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref(key))
        const decision = requestDedupeDecision(snap.exists ? snap.data() : null, nowMs)
        if (decision.action === 'claim') tx.set(ref(key), pendingRecord(details, nowMs))
        return decision
      })
    },
    async complete(key, response, nowMs = Date.now()) {
      await ref(key).set({ status: 'sent', sentAtMs: nowMs, response }, { merge: true })
    },
    async release(key) {
      await ref(key).delete()
    },
  }
}

module.exports = {
  PENDING_STALE_MS,
  REQUEST_DEDUPE_COLLECTION,
  RequestIdError,
  createAdminRequestDedupe,
  parseRequestId,
  pendingRecord,
  requestDedupeDecision,
  requestDedupeKey,
}

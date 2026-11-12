'use strict'

/**
 * Idempotency for `sendEmail` (docs/EMAIL_FUNCTION.md "Request id"). A caller that may send the same request twice —
 * the iPhone replaying a queued material order after a crash or a timeout, or retrying after an online timeout —
 * names it with `requestId`. Once the caller has passed the membership and level checks, the first call claims
 * `emailRequestSends/{key}` in a Firestore transaction and sends; any later call with the same key gets the first
 * call's answer back (`deduped: true`) without sending again, without counting against the rate limit and without
 * re-running the checks that can change between sends (job number, wholesaler contacts) — nothing new is sent. A
 * request without `requestId` is unchanged (older app builds).
 *
 * The key is the SHA-256 of the caller (uid, or `server`), the organisation, the template, the request id, the
 * recipients asked for (trimmed, lower case, sorted) and a hash of the request's content (`requestContentHash`: the
 * template data and attachments the message is rendered from). The rendered message itself is not hashed because it
 * carries the send time. So a reused id with different content is a different request and is sent, never swallowed;
 * the web route (one call per recipient, one id) gets one key per recipient; and nobody can block another caller's
 * request by reusing its id.
 *
 * States: `pending` while the first call is sending, `sent` once it answered. A `pending` claim younger than
 * `PENDING_STALE_MS` makes a second call wait (409 `inProgress`); an older one belongs to a call that died before it
 * finished (the function times out after 60 s) and is taken over. A claim is released (deleted) when nothing was sent
 * — refused by a later check, rate limited or every message refused — so a retry sends.
 *
 * A record holds counts and ids only (organisation, uid, template, job id, recipient count, Resend message ids and the
 * positions of failed recipients in the request's own `to` list) — never an email address, CC or From name. A
 * replay rebuilds the answer from the request (`replayResponse`). Only the Admin SDK touches the collection: the
 * security rules have no match for it (top-level, like `emailRateLimits`), so apps can neither read nor clear it. Each
 * record carries `expireAt` (30 days) for an optional Firestore TTL policy; nothing depends on it.
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

/** Recipients as the key and a replay read them: trimmed, lower case, once each, sorted. */
function requestRecipients(to) {
  const list = Array.isArray(to) ? to : []
  return [...new Set(list.map((email) => String(email == null ? '' : email).trim().toLowerCase()).filter(Boolean))].sort()
}

/** JSON with object keys sorted at every level, so the same content always hashes the same. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value === undefined ? null : value)
}

/** SHA-256 of the content a message is rendered from: the template data and each attachment's name and bytes. */
function requestContentHash({ data, attachments }) {
  const files = (Array.isArray(attachments) ? attachments : []).map((row) => ({
    filename: row && typeof row.filename === 'string' ? row.filename : '',
    content: crypto.createHash('sha256').update(String((row && row.content) || '')).digest('hex'),
  }))
  return crypto.createHash('sha256').update(stableStringify({ data: data || {}, files })).digest('hex')
}

function requestDedupeKey({ callerKey, orgId, template, requestId, recipients, contentHash }) {
  const material = JSON.stringify([
    String(callerKey || ''),
    String(orgId || ''),
    String(template || ''),
    String(requestId),
    requestRecipients(recipients),
    String(contentHash || ''),
  ])
  return crypto.createHash('sha256').update(material).digest('hex')
}

/**
 * Pure step: what a call does given the stored record.
 * @returns {{ action: 'claim' } | { action: 'replay', record: object } | { action: 'inProgress' }}
 */
function requestDedupeDecision(stored, nowMs) {
  if (!stored || typeof stored !== 'object') return { action: 'claim' }
  if (stored.status === 'sent' && Number.isFinite(Number(stored.sentCount))) return { action: 'replay', record: stored }
  const claimedAtMs = Number(stored.claimedAtMs)
  if (stored.status === 'pending' && Number.isFinite(claimedAtMs) && nowMs - claimedAtMs < PENDING_STALE_MS) {
    return { action: 'inProgress' }
  }
  return { action: 'claim' }
}

/**
 * The fields written once a call has sent: counts, Resend ids and positions only. `results` / `failed` are the
 * handler's (`{ to, id }` and emails); each address is kept as its position `i` in `keyRecipients` (-1 when the
 * template does not send to the request's `to`, e.g. an invitation).
 */
function sentRecordFields({ results, failed, keyRecipients }, nowMs) {
  const position = (email) => keyRecipients.indexOf(String(email || '').trim().toLowerCase())
  return {
    status: 'sent',
    sentAtMs: nowMs,
    sentCount: results.length,
    failedCount: failed.length,
    failedPositions: failed.map(position),
    messages: results.map((row) => ({ i: position(row.to), id: row.id || null })),
  }
}

/** The answer to a repeat, rebuilt from the stored counts and ids and this (identical) request. */
function replayResponse(record, { keyRecipients, ccFor, from }) {
  const at = (i) => (Number.isInteger(i) && i >= 0 && i < keyRecipients.length ? keyRecipients[i] : null)
  const messages = Array.isArray(record.messages) ? record.messages : []
  const failedPositions = Array.isArray(record.failedPositions) ? record.failedPositions : []
  const results = messages.map((row) => {
    const to = at(row && row.i)
    return { ...(to ? { to } : {}), id: (row && row.id) || null, cc: ccFor(to) }
  })
  const failed = failedPositions.map(at).filter(Boolean)
  const failedCount = Number(record.failedCount) || failed.length
  return {
    sent: failedCount === 0,
    sentCount: Number(record.sentCount) || results.length,
    failed,
    results,
    from,
    ccSupported: true,
    deduped: true,
  }
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
    async complete(key, fields) {
      await ref(key).set(fields, { merge: true })
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
  replayResponse,
  requestContentHash,
  requestDedupeDecision,
  requestDedupeKey,
  requestRecipients,
  sentRecordFields,
  stableStringify,
}

'use strict'

/**
 * Per-sender rate limit for `sendEmail`, stored at `emailRateLimits/{key}` (key = the caller's uid, or `server` for
 * web-server mail with no signed-in user). Fixed hour and day windows; every message (one per recipient) counts.
 * Only the Admin SDK touches the collection: the security rules have no match for it, so apps can neither read nor
 * reset it.
 */

const RATE_LIMIT_COLLECTION = 'emailRateLimits'
const USER_LIMITS = Object.freeze({ perHour: 60, perDay: 300 })
const SERVER_LIMITS = Object.freeze({ perHour: 600, perDay: 3000 })

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function windowStart(nowMs, size) {
  return Math.floor(nowMs / size) * size
}

/**
 * Pure step: the stored state, the time and how many messages this request sends.
 * @returns {{ allowed: true, next: object } | { allowed: false, retryAfterSec: number, scope: 'hour' | 'day' }}
 */
function nextRateLimitState(stored, nowMs, count, limits) {
  const hourStart = windowStart(nowMs, HOUR_MS)
  const dayStart = windowStart(nowMs, DAY_MS)
  const prev = stored && typeof stored === 'object' ? stored : {}
  const hourCount = prev.hourStart === hourStart ? Number(prev.hourCount) || 0 : 0
  const dayCount = prev.dayStart === dayStart ? Number(prev.dayCount) || 0 : 0
  if (dayCount + count > limits.perDay) {
    return { allowed: false, scope: 'day', retryAfterSec: Math.max(1, Math.ceil((dayStart + DAY_MS - nowMs) / 1000)) }
  }
  if (hourCount + count > limits.perHour) {
    return { allowed: false, scope: 'hour', retryAfterSec: Math.max(1, Math.ceil((hourStart + HOUR_MS - nowMs) / 1000)) }
  }
  return {
    allowed: true,
    next: { hourStart, hourCount: hourCount + count, dayStart, dayCount: dayCount + count, updatedAtMs: nowMs },
  }
}

/** Reserves `count` messages for `key` in one Firestore transaction. */
async function consumeRateLimit(db, key, count, limits, nowMs = Date.now()) {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const result = nextRateLimitState(snap.exists ? snap.data() : null, nowMs, count, limits)
    if (result.allowed) tx.set(ref, result.next)
    return result
  })
}

module.exports = { RATE_LIMIT_COLLECTION, SERVER_LIMITS, USER_LIMITS, consumeRateLimit, nextRateLimitState }

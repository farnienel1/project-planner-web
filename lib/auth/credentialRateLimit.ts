export const AUTH_FAILURE_LIMIT = 5
export const AUTH_FAILURE_WINDOW_MS = 15 * 60 * 1000

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type AttemptStatus = { ok: true } | { ok: false; retryAfterSec: number }

function keys(scope: string, ip: string, account: string): string[] {
  return [`${scope}:ip:${ip || 'unknown'}`, `${scope}:acct:${account.trim().toLowerCase()}`]
}

function live(bucket: Bucket | undefined, now: number): Bucket | null {
  if (!bucket || bucket.resetAt <= now) return null
  return bucket
}

export function resetCredentialRateLimitForTests() {
  buckets.clear()
}

export function credentialFailureStatus(scope: string, ip: string, account: string, now: number): AttemptStatus {
  let retryAfterSec = 0
  for (const key of keys(scope, ip, account)) {
    const bucket = live(buckets.get(key), now)
    if (bucket && bucket.count >= AUTH_FAILURE_LIMIT) {
      retryAfterSec = Math.max(retryAfterSec, Math.ceil((bucket.resetAt - now) / 1000))
    }
  }
  if (retryAfterSec > 0) return { ok: false, retryAfterSec }
  return { ok: true }
}

export function recordCredentialFailure(scope: string, ip: string, account: string, now: number) {
  for (const key of keys(scope, ip, account)) {
    const bucket = live(buckets.get(key), now)
    if (!bucket) {
      buckets.set(key, { count: 1, resetAt: now + AUTH_FAILURE_WINDOW_MS })
    } else {
      bucket.count += 1
    }
  }
}

export function tooManyAttemptsMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60))
  const unit = minutes === 1 ? 'minute' : 'minutes'
  return `Too many failed attempts. Try again in ${minutes} ${unit}.`
}

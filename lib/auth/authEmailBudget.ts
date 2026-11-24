import { createHash } from 'node:crypto'
import { adminGoogleAccessToken } from '@/lib/owner/identityToolkitAdmin'
import { firestoreDocumentsBase } from '@/lib/owner/googleApis'
import { rateLimit } from '@/lib/security/rateLimit'

/**
 * How many account emails (password reset, verify email, confirm new email) one address or one account may be sent in
 * a window, kept in Firestore so every server instance shares one count (review of #361: an in-memory count let each
 * Netlify instance send its own three).
 *
 * `authEmailBudgets/{sha256(scope:key)}` `{ count, windowStartMs, expireAt }` — the key is hashed, so no email
 * address is stored. Written only by the web server with the service account; the security rules have no match for the
 * collection, so apps can neither read nor write it (default deny). `expireAt` is a Firestore TTL field (owner step:
 * enable the TTL policy, see the PR), so old documents are deleted by Firestore.
 *
 * When Firestore cannot be reached the count falls back to this instance's memory (never "unlimited").
 */

export const AUTH_EMAIL_BUDGET_COLLECTION = 'authEmailBudgets'

/** Kept a day past the window so a document never vanishes while its window still counts. */
const EXPIRE_AFTER_WINDOW_MS = 24 * 60 * 60 * 1000

// 1.83.0 §31: the same shared counter limits share-link opens (per address) and share-link creation (per account).
export type AuthEmailBudgetScope = 'password-reset' | 'verify-email' | 'change-email' | 'compliance-share-open' | 'compliance-share-create'

export function authEmailBudgetDocId(scope: AuthEmailBudgetScope, key: string): string {
  return createHash('sha256').update(`${scope}:${key.trim().toLowerCase()}`).digest('hex')
}

export type AuthEmailBudgetState = { count: number; windowStartMs: number }

/** Fixed window: the next stored state, or not allowed when the window already holds `limit` sends. */
export function nextAuthEmailBudget(
  stored: AuthEmailBudgetState | null,
  nowMs: number,
  limit: number,
  windowMs: number
): { allowed: true; next: AuthEmailBudgetState } | { allowed: false } {
  const inWindow = stored && Number.isFinite(stored.windowStartMs) && nowMs - stored.windowStartMs < windowMs
  const count = inWindow ? Math.max(0, Math.floor(stored!.count) || 0) : 0
  if (count >= limit) return { allowed: false }
  return { allowed: true, next: { count: count + 1, windowStartMs: inWindow ? stored!.windowStartMs : nowMs } }
}

type Fetcher = typeof fetch

async function adminSession() {
  const { token, projectId } = await adminGoogleAccessToken(['https://www.googleapis.com/auth/datastore'])
  const project = projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
  if (!project) throw new Error('Firebase project id is missing.')
  return { base: firestoreDocumentsBase(project), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

function readState(fields: Record<string, { integerValue?: string; doubleValue?: number }> | undefined): AuthEmailBudgetState | null {
  if (!fields) return null
  const number = (value?: { integerValue?: string; doubleValue?: number }) =>
    value ? Number(value.integerValue ?? value.doubleValue ?? NaN) : NaN
  const count = number(fields.count)
  const windowStartMs = number(fields.windowStartMs)
  return Number.isFinite(count) && Number.isFinite(windowStartMs) ? { count, windowStartMs } : null
}

/**
 * Spends one send of `scope` for `key`. True while the budget allows it. Optimistic: the write carries the read's
 * `updateTime` (or "must not exist"), and a write that lost a race is read again once.
 */
export async function consumeAuthEmailBudget(
  scope: AuthEmailBudgetScope,
  key: string,
  limit: number,
  windowMs: number,
  options: { nowMs?: number; fetcher?: Fetcher } = {}
): Promise<boolean> {
  const fetcher = options.fetcher ?? fetch
  const nowMs = options.nowMs ?? Date.now()
  const docId = authEmailBudgetDocId(scope, key)
  try {
    const session = await adminSession()
    const url = `${session.base}/${AUTH_EMAIL_BUDGET_COLLECTION}/${docId}`
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const read = await fetcher(url, { headers: session.headers, cache: 'no-store' })
      if (!read.ok && read.status !== 404) throw new Error(`budget read ${read.status}`)
      const doc = read.status === 404 ? null : ((await read.json()) as { fields?: Record<string, never>; updateTime?: string })
      const decision = nextAuthEmailBudget(readState(doc?.fields), nowMs, limit, windowMs)
      if (!decision.allowed) return false
      const precondition = doc?.updateTime
        ? `currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`
        : 'currentDocument.exists=false'
      const write = await fetcher(`${url}?${precondition}`, {
        method: 'PATCH',
        headers: session.headers,
        body: JSON.stringify({
          fields: {
            count: { integerValue: String(decision.next.count) },
            windowStartMs: { integerValue: String(decision.next.windowStartMs) },
            expireAt: { timestampValue: new Date(decision.next.windowStartMs + windowMs + EXPIRE_AFTER_WINDOW_MS).toISOString() },
          },
        }),
      })
      if (write.ok) return true
      // 400 FAILED_PRECONDITION / 409: someone else wrote first — read again once.
      if (write.status !== 400 && write.status !== 409 && write.status !== 412) throw new Error(`budget write ${write.status}`)
    }
    throw new Error('budget contention')
  } catch {
    return rateLimit(`auth-email-budget:${docId}`, limit, windowMs).ok
  }
}

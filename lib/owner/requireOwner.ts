import { NextRequest, NextResponse } from 'next/server'
import { isVerifiedPlatformOwner } from '@/lib/canonical/passwordPolicy'
import {
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
  type FirebaseAuthUser,
} from '@/lib/security/apiGuard'
import { readMfaCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { verifySignedMfaOk } from '@/lib/auth/mfa/mfaCookieVerify'

/** Owner console PLAN A3 / spec §1.3: a destructive action needs the emailed code within the last 10 minutes. */
export const OWNER_MFA_FRESH_MS = 10 * 60 * 1000
/** Clock skew allowed between the server that signed the cookie and the one reading it. */
const OWNER_MFA_SKEW_MS = 60 * 1000
/** The `code` a refused "not fresh" request carries, so the console can ask for a new code. */
export { OWNER_MFA_REVERIFY_CODE } from '@/lib/owner/ownerMfaCodes'
import { OWNER_MFA_REVERIFY_CODE } from '@/lib/owner/ownerMfaCodes'

export type OwnerSession = FirebaseAuthUser & {
  /** When the emailed code was accepted (the MFA cookie's `iat`); null for a cookie signed before `iat` existed. */
  mfaVerifiedAtMs: number | null
}

/** True when the code was accepted within OWNER_MFA_FRESH_MS. A missing or unreadable time is never fresh. */
export function ownerMfaIsFresh(iatMs: number | null | undefined, nowMs = Date.now()): boolean {
  if (typeof iatMs !== 'number' || !Number.isFinite(iatMs)) return false
  if (iatMs > nowMs + OWNER_MFA_SKEW_MS) return false
  return nowMs - iatMs <= OWNER_MFA_FRESH_MS
}

/**
 * The one guard for every `/api/owner/*` route (owner console PLAN A3):
 * 1. a signed-in Firebase user (401 otherwise);
 * 2. the verified platform owner token — the same test as the security rules' `isPlatformOwner` (rulebook 1.12.0);
 * 3. the signed MFA "ok" cookie, for that same uid (audit H1);
 * 4. with `fresh: true`, a code accepted within the last 10 minutes (refused with OWNER_MFA_REVERIFY_CODE).
 */
export async function requireOwnerSession(
  request: NextRequest,
  options: { fresh?: boolean } = {}
): Promise<OwnerSession | NextResponse> {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  if (!isVerifiedPlatformOwner({ email: user.email, emailVerified: user.emailVerified })) {
    return jsonError('Owner access required', 403)
  }
  const mfa = await verifySignedMfaOk(readMfaCookie(request, 'ok'))
  if (!mfa || mfa.uid !== user.uid) {
    return jsonError('Two-factor verification is required. Sign in again and enter the emailed code.', 403)
  }
  const mfaVerifiedAtMs = typeof mfa.iat === 'number' ? mfa.iat : null
  if (options.fresh && !ownerMfaIsFresh(mfaVerifiedAtMs)) return ownerReverifyRequiredResponse()
  return { ...user, mfaVerifiedAtMs }
}

/** The 403 a destructive action answers when the emailed code is older than 10 minutes (the console asks for a new one). */
export function ownerReverifyRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'For this action, enter a new emailed code first (the last one was more than 10 minutes ago).',
      code: OWNER_MFA_REVERIFY_CODE,
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * For routes whose dry run (`preview: true`) is read-only: the owner guard first, then — only for the real action —
 * the freshness check. Returns null when the session may go on.
 */
export function ownerFreshnessRefusal(session: OwnerSession, preview: boolean): NextResponse | null {
  return preview || ownerMfaIsFresh(session.mfaVerifiedAtMs) ? null : ownerReverifyRequiredResponse()
}

/** Owner guard without the freshness check (reads and non-destructive actions). */
export async function requireOwner(request: NextRequest): Promise<OwnerSession | NextResponse> {
  return requireOwnerSession(request)
}

import { NextRequest, NextResponse } from 'next/server'
import { isVerifiedPlatformOwner } from '@/lib/canonical/passwordPolicy'
import {
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
  type FirebaseAuthUser,
} from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { readMfaCookie } from '@/lib/auth/mfa/mfaCookiePolicy'
import { verifySignedMfaOk } from '@/lib/auth/mfa/mfaCookieVerify'

const projectId = () => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''

export async function requireOwner(request: NextRequest): Promise<FirebaseAuthUser | NextResponse> {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  // Rulebook 1.12.0: the verified owner token, the same test as the security rules' isPlatformOwner.
  if (!isVerifiedPlatformOwner({ email: user.email, emailVerified: user.emailVerified })) {
    return jsonError('Owner access required', 403)
  }
  // Owner console audit H1: the second step is checked on the server too, not only by the page middleware.
  // The same signed cookie and helper the middleware uses, bound to the same uid as the ID token.
  const mfa = await verifySignedMfaOk(readMfaCookie(request, 'ok'))
  if (!mfa || mfa.uid !== user.uid) {
    return jsonError('Two-factor verification is required. Sign in again and enter the emailed code.', 403)
  }
  return user
}

type AuditEntry = {
  action: string
  actorUid: string
  targetUserId?: string
  targetOrgId?: string
  before?: unknown
  after?: unknown
  reason?: string
  ip?: string
}

/**
 * Writes one `adminAuditLog` entry and throws when it was not stored. Destructive owner actions call this
 * before they act, and refuse when it throws (owner console audit H2).
 */
export async function writeAuditLogOrThrow(request: NextRequest, entry: AuditEntry): Promise<void> {
  const token = bearerToken(request)
  if (!token || !projectId()) throw new Error('Audit log unavailable')
  const fields: Record<string, unknown> = {
    action: { stringValue: entry.action },
    actorUid: { stringValue: entry.actorUid },
    at: { timestampValue: new Date().toISOString() },
  }
  if (entry.targetUserId) fields.targetUserId = { stringValue: entry.targetUserId }
  if (entry.targetOrgId) fields.targetOrgId = { stringValue: entry.targetOrgId }
  if (entry.reason) fields.reason = { stringValue: entry.reason }
  if (entry.ip) fields.ip = { stringValue: entry.ip }
  if (entry.before) fields.before = { stringValue: JSON.stringify(entry.before).slice(0, 1500) }
  if (entry.after) fields.after = { stringValue: JSON.stringify(entry.after).slice(0, 1500) }
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/adminAuditLog`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  )
  if (!response.ok) throw new Error(`Audit log write refused (${response.status})`)
}

/** Best-effort audit entry: failures are logged, never thrown. */
export async function writeAuditLog(request: NextRequest, entry: AuditEntry) {
  try {
    await writeAuditLogOrThrow(request, entry)
  } catch (error) {
    console.warn('[adminAuditLog]', error)
  }
}

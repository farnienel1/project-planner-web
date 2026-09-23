import { NextRequest, NextResponse } from 'next/server'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import {
  isFirebaseUser,
  jsonError,
  requireFirebaseUser,
  type FirebaseAuthUser,
} from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'

const projectId = () => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''

export async function requireOwner(request: NextRequest): Promise<FirebaseAuthUser | NextResponse> {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  if (!isPlatformOwnerEmail(user.email)) return jsonError('Owner access required', 403)
  return user
}

export async function writeAuditLog(
  request: NextRequest,
  entry: {
    action: string
    actorUid: string
    targetUserId?: string
    targetOrgId?: string
    before?: unknown
    after?: unknown
    reason?: string
    ip?: string
  }
) {
  const token = bearerToken(request)
  if (!token || !projectId()) return
  try {
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
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/adminAuditLog`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      }
    )
  } catch (error) {
    console.warn('[adminAuditLog]', error)
  }
}

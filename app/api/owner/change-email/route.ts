import { NextRequest, NextResponse } from 'next/server'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { clientIp, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { isValidEmail } from '@/lib/security/validation'
import { maskEmail } from '@/lib/auth/maskEmail'

export const runtime = 'nodejs'

function adminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string; newEmail?: string; reason?: string; sendReset?: boolean }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  const newEmail = (body.value.newEmail || '').trim().toLowerCase()
  const reason = (body.value.reason || '').trim()
  if (!uid || !isValidEmail(newEmail)) return jsonError('uid and a valid newEmail are required', 400)
  if (isPlatformOwnerEmail(newEmail)) return jsonError('That email is reserved for the platform owner.', 400)
  if (!adminConfigured()) {
    return jsonError(
      'Changing a login email needs the Firebase Admin service account (FIREBASE_SERVICE_ACCOUNT_JSON) on the server. Password reset still works without it.',
      501
    )
  }
  await writeAuditLog(request, {
    action: 'ownerChangeUserEmail.attempt',
    actorUid: owner.uid,
    targetUserId: uid,
    after: { newEmail: maskEmail(newEmail), reason },
    ip: clientIp(request),
  })
  return jsonError(
    'Changing a login email needs the Firebase Admin SDK to update Auth and every stored copy. Password reset still works without it.',
    501
  )
}

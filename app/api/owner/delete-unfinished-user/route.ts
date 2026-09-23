import { NextRequest, NextResponse } from 'next/server'
import { clientIp, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { bearerToken, firestoreDelete, firestoreGet, readString } from '@/lib/owner/firestoreRest'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { abandonedSignupCutoff } from '@/lib/owner/unfinishedSetup'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  if (!uid) return jsonError('uid is required', 400)
  const token = bearerToken(request)
  try {
    const doc = await firestoreGet(token, `users/${uid}`)
    if (!doc) return jsonError('User not found', 404)
    const email = readString(doc.fields, 'email')
    if (isPlatformOwnerEmail(email)) return jsonError('The owner account cannot be deleted.', 400)
    await firestoreDelete(token, `users/${uid}`)
    await writeAuditLog(request, {
      action: 'ownerDeleteUnfinishedUser',
      actorUid: owner.uid,
      targetUserId: uid,
      before: { email },
      reason: `abandoned-or-orphan cleanup after ${abandonedSignupCutoff().toISOString()}`,
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[owner/delete-unfinished-user]', error)
    return jsonError('Could not delete that user. Publish the updated Firestore rules first.', 502)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { clientIp, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { bearerToken, boolField, firestorePatch } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ orgId?: string; uid?: string; isInternal?: boolean }>(request)
  if (!body.ok) return body.response
  const isInternal = body.value.isInternal === true
  const orgId = (body.value.orgId || '').trim()
  const uid = (body.value.uid || '').trim()
  if (!orgId && !uid) return jsonError('orgId or uid is required', 400)
  const token = bearerToken(request)
  try {
    if (orgId) {
      await firestorePatch(token, `organizations/${orgId}`, { isInternal: boolField(isInternal), isTest: boolField(isInternal) }, [
        'isInternal',
        'isTest',
      ])
    }
    if (uid) {
      await firestorePatch(token, `users/${uid}`, { isInternal: boolField(isInternal) }, ['isInternal'])
    }
    await writeAuditLog(request, {
      action: 'ownerMarkInternal',
      actorUid: owner.uid,
      targetOrgId: orgId || undefined,
      targetUserId: uid || undefined,
      after: { isInternal },
      ip: clientIp(request),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[owner/mark-internal]', error)
    return jsonError('Could not mark that record as internal. Publish the updated Firestore rules first.', 502)
  }
}

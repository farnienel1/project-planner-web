import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog, writeAuditLogOrThrow } from '@/lib/owner/requireOwner'
import {
  bearerToken,
  firestoreDelete,
  firestoreGet,
  firestoreListCollection,
  restFieldsToPlain,
} from '@/lib/owner/firestoreRest'
import { abandonedSignupCutoff } from '@/lib/owner/unfinishedSetup'
import {
  unfinishedUserDeleteDecision,
  type UnfinishedUserDeleteInput,
} from '@/lib/owner/unfinishedUserDelete'

export const runtime = 'nodejs'

const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-delete-user', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ uid?: string }>(request)
  if (!body.ok) return body.response
  const uid = (body.value.uid || '').trim()
  if (!uid) return jsonError('uid is required', 400)
  if (!DOC_ID.test(uid)) return jsonError('uid is not valid', 400)
  const token = bearerToken(request)

  // Owner console audit H2: re-check on the server that this really is an unfinished sign-up.
  let userFields: Record<string, unknown> | undefined
  try {
    const doc = await firestoreGet(token, `users/${uid}`)
    if (!doc) return jsonError('User not found', 404)
    userFields = doc.fields
  } catch {
    return jsonError('Could not read that user. Nothing was deleted.', 503)
  }
  const user = restFieldsToPlain(userFields)

  const organizationId = typeof user.organizationId === 'string' ? user.organizationId.trim() : ''
  let homeOrg: UnfinishedUserDeleteInput['homeOrg'] = { state: 'none' }
  if (organizationId) {
    if (!DOC_ID.test(organizationId)) {
      homeOrg = { state: 'unreadable' }
    } else {
      try {
        const orgDoc = await firestoreGet(token, `organizations/${organizationId}`)
        homeOrg = orgDoc ? { state: 'found', fields: restFieldsToPlain(orgDoc.fields) } : { state: 'missing' }
      } catch {
        homeOrg = { state: 'unreadable' }
      }
    }
  }

  let memberships: UnfinishedUserDeleteInput['memberships']
  try {
    const rows = await firestoreListCollection(token, `users/${uid}/orgMemberships`, 1)
    memberships = { state: 'read', count: rows.length }
  } catch {
    memberships = { state: 'unreadable' }
  }

  const decision = unfinishedUserDeleteDecision({ uid, user, homeOrg, memberships, nowMs: Date.now() })
  if (!decision.allowed) return jsonError(decision.reason, decision.status)

  const email = typeof user.email === 'string' ? user.email : ''
  const auditBase = {
    actorUid: owner.uid,
    targetUserId: uid,
    targetOrgId: organizationId || undefined,
    before: { email, organizationId, passwordSet: user.passwordSet === true },
    reason: `abandoned-or-orphan cleanup after ${abandonedSignupCutoff().toISOString()}`,
    ip: clientIp(request),
  }
  // The audit entry is written first; if it cannot be stored, nothing is deleted.
  try {
    await writeAuditLogOrThrow(request, { ...auditBase, action: 'ownerDeleteUnfinishedUser' })
  } catch (error) {
    console.error('[owner/delete-unfinished-user] audit', error)
    return jsonError('Could not write the audit log entry, so nothing was deleted. Try again.', 502)
  }

  try {
    await firestoreDelete(token, `users/${uid}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[owner/delete-unfinished-user]', error)
    await writeAuditLog(request, { ...auditBase, action: 'ownerDeleteUnfinishedUserFailed' })
    return jsonError('Could not delete that user. Publish the updated Firestore rules first.', 502)
  }
}

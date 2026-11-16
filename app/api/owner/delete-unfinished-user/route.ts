import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner } from '@/lib/owner/requireOwner'
import { clearOwnerDirectoryCache } from '@/lib/owner/directoryServer'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { bearerToken, firestoreDelete, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import {
  adminCountCollection,
  adminLookupAuthCreatedAtMs,
  firebaseAdminConfigured,
} from '@/lib/owner/identityToolkitAdmin'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
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
  // The security rules let only the person list their own `orgMemberships`, so the owner's token can never
  // prove "not a member anywhere" (review of #340). That, and the Auth creation time, need the server key.
  if (!firebaseAdminConfigured()) {
    return jsonError(
      'Deleting unfinished sign-ups is not available until the server key (FIREBASE_SERVICE_ACCOUNT_JSON) is set up. Nothing was deleted.',
      501
    )
  }
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

  // The rulebook reader: an id, a path or a reference. A stored value it can't read is unreadable, never "none".
  const rawOrganizationId = user.organizationId
  const hasStoredOrganization =
    rawOrganizationId != null && !(typeof rawOrganizationId === 'string' && rawOrganizationId.trim() === '')
  const organizationId = hasStoredOrganization ? documentOrganizationId(rawOrganizationId) || '' : ''
  let homeOrg: UnfinishedUserDeleteInput['homeOrg'] = { state: 'none' }
  if (hasStoredOrganization) {
    if (!organizationId || !DOC_ID.test(organizationId)) {
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
    memberships = { state: 'read', count: await adminCountCollection(`users/${uid}/orgMemberships`, 1) }
  } catch {
    memberships = { state: 'unreadable' }
  }

  let authAccount: UnfinishedUserDeleteInput['authAccount']
  try {
    authAccount = { state: 'read', createdAtMs: await adminLookupAuthCreatedAtMs(uid) }
  } catch {
    authAccount = { state: 'unreadable' }
  }

  const decision = unfinishedUserDeleteDecision({ uid, user, homeOrg, memberships, authAccount, nowMs: Date.now() })
  if (!decision.allowed) return jsonError(decision.reason, decision.status)

  const email = typeof user.email === 'string' ? user.email : ''
  // Owner console PLAN A4: `requested` is written first; if it cannot be stored, nothing is deleted.
  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerDeleteUnfinishedUser',
      targetUserId: uid,
      targetOrgId: organizationId || undefined,
      before: {
        email,
        organizationId,
        passwordSet: user.passwordSet === true,
        authCreatedAt:
          authAccount.state === 'read' && authAccount.createdAtMs ? new Date(authAccount.createdAtMs).toISOString() : null,
      },
      reason: `abandoned-or-orphan cleanup after ${abandonedSignupCutoff().toISOString()}`,
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }

  try {
    await firestoreDelete(token, `users/${uid}`)
    clearOwnerDirectoryCache()
    await audit.complete({ deleted: `users/${uid}` })
    return NextResponse.json({ ok: true, requestId: audit.requestId })
  } catch (error) {
    console.error('[owner/delete-unfinished-user]', error)
    await audit.fail(error)
    return jsonError('Could not delete that user. Publish the updated Firestore rules first.', 502)
  }
}

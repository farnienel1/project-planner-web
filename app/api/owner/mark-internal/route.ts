import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner } from '@/lib/owner/requireOwner'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'
import { clearOwnerDirectoryCache } from '@/lib/owner/directoryServer'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { bearerToken, boolField, firestoreGet, firestorePatch, readBool } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

const MARK_INTERNAL_NO_ORG_MESSAGE = 'That organisation has no saved record yet (an unfinished sign-up), so it cannot be marked.'
const MARK_INTERNAL_READ_FAILED_MESSAGE = 'Could not read that organisation. Try again.'
const MARK_INTERNAL_WRITE_FAILED_MESSAGE = 'Could not save the internal flag. Try again.'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-mark-internal', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ orgId?: string; uid?: string; isInternal?: boolean }>(request)
  if (!body.ok) return body.response
  const isInternal = body.value.isInternal === true
  const orgId = (body.value.orgId || '').trim()
  const uid = (body.value.uid || '').trim()
  if (!orgId && !uid) return jsonError('orgId or uid is required', 400)
  // The owner's own profile organisation is never a customer, so it is never marked (review of #348).
  if (isPlatformOwnerSentinelOrg(orgId)) return jsonError('The owner account organisation cannot be marked.', 400)
  const token = bearerToken(request)
  // The values before the change (changed fields only, PLAN A4). An unreadable record is left out, never guessed.
  const before: Record<string, unknown> = {}
  if (orgId) {
    // An organisation with no document (an unfinished sign-up's company) is refused before the audit: the PATCH would
    // otherwise try to create organizations/{orgId} with only the two flags, which the rules refuse (owner bug 17 Nov).
    let doc: Awaited<ReturnType<typeof firestoreGet>>
    try {
      doc = await firestoreGet(token, `organizations/${orgId}`)
    } catch {
      return jsonError(MARK_INTERNAL_READ_FAILED_MESSAGE, 502)
    }
    if (!doc) return jsonError(MARK_INTERNAL_NO_ORG_MESSAGE, 404)
    before.org = { isInternal: readBool(doc.fields, 'isInternal'), isTest: readBool(doc.fields, 'isTest') }
  }
  if (uid) {
    const doc = await firestoreGet(token, `users/${uid}`).catch(() => null)
    if (doc) before.user = { isInternal: readBool(doc.fields, 'isInternal') }
  }
  const after = {
    ...(orgId ? { org: { isInternal, isTest: isInternal } } : {}),
    ...(uid ? { user: { isInternal } } : {}),
  }
  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerMarkInternal',
      targetOrgId: orgId || undefined,
      targetUserId: uid || undefined,
      before,
      after,
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
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
    clearOwnerDirectoryCache()
    await audit.complete()
    return NextResponse.json({ ok: true, requestId: audit.requestId })
  } catch (error) {
    console.error('[owner/mark-internal]', error)
    await audit.fail(error)
    return jsonError(MARK_INTERNAL_WRITE_FAILED_MESSAGE, 502)
  }
}

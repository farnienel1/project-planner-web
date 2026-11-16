import { NextRequest } from 'next/server'
import { bearerToken, firestoreGet, firestorePatch, restFieldsToPlain, stringField } from '@/lib/owner/firestoreRest'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { parseOrganizationId } from '@/lib/security/requireOrgAccess'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { ORGANIZATION_RESTORED_MESSAGE, canRestoreOrganization } from '@/lib/canonical/organizationDeletion'
import { resumeSubscription } from '@/lib/organizationDeletion/server'

export const runtime = 'nodejs'

/**
 * Rulebook §11 / §20 (`canRestoreOrganization`): a company deleted with its last member's account is scheduled with
 * `restoreBy: 'platform_owner'`, so only the platform owner may restore it — and the owner never sees the locked
 * screen that carries the super admin's Restore. This owner-only route removes `deletion` with the owner's token (the
 * security rules let the platform owner write the organisation document), resumes the subscription when it is still
 * in its period, and writes an audit row. Nothing is restored after `erased`.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-restore-org', 10, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ orgId?: string }>(request)
  if (!body.ok) return body.response
  const organizationId = parseOrganizationId(body.value.orgId)
  if (!organizationId) return jsonError('orgId is required', 400)

  const token = bearerToken(request)
  const orgDoc = await firestoreGet(token, `organizations/${organizationId}`).catch(() => null)
  if (!orgDoc) return jsonError('Organisation not found', 404)
  const org = { id: organizationId, ...restFieldsToPlain(orgDoc.fields) }
  if (!canRestoreOrganization({ org, viewerIsPlatformOwner: true })) {
    return jsonError('This organisation is not scheduled for deletion, so there is nothing to restore.', 409)
  }
  try {
    await firestorePatch(
      token,
      `organizations/${organizationId}`,
      { updatedBy: stringField(owner.uid), updatedFrom: stringField('web') },
      ['deletion', 'updatedBy', 'updatedFrom']
    )
  } catch (error) {
    console.error('[owner/restore-organisation]', error)
    return jsonError('Could not restore the organisation.', 502)
  }
  const stripe = await resumeSubscription(org)
  await writeAuditLog(request, {
    action: 'ownerRestoreOrganisation',
    actorUid: owner.uid,
    targetOrgId: organizationId,
    after: { stripe },
    ip: clientIp(request),
  })
  return Response.json({ ok: true, message: ORGANIZATION_RESTORED_MESSAGE, stripe }, { headers: { 'Cache-Control': 'no-store' } })
}

import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'
import { clientIp } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readJsonBody<{ orgId?: string }>(request)
  if (!body.ok) return body.response
  const orgId = (body.value.orgId || '').trim()
  if (!orgId) return jsonError('orgId is required', 400)
  if (isPlatformOwnerSentinelOrg(orgId)) return jsonError('The owner account organisation cannot be deleted.', 400)
  await writeAuditLog(request, {
    action: 'ownerDeleteOrganisation.blocked',
    actorUid: owner.uid,
    targetOrgId: orgId,
    reason: 'Admin SDK recursive delete is required before this action is enabled',
    ip: clientIp(request),
  })
  return jsonError(
    'Organisation deletion is irreversible and runs as a server job. It is disabled until FIREBASE_SERVICE_ACCOUNT_JSON is available so a failed load cannot wipe customer data.',
    501
  )
}

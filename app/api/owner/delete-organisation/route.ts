import { NextRequest } from 'next/server'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { isValidDocumentId } from '@/lib/security/validation'
import { requireOwner } from '@/lib/owner/requireOwner'
import { recordOwnerEvent } from '@/lib/owner/ownerAudit'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-delete-org', 10, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = await readApiBody(request, apiObject({ orgId: apiText(200) }))
  if (!body.ok) return body.response
  const orgId = body.value.orgId
  if (!orgId) return jsonError('orgId is required', 400)
  if (!isValidDocumentId(orgId)) return jsonError('orgId is not valid', 400)
  if (isPlatformOwnerSentinelOrg(orgId)) return jsonError('The owner account organisation cannot be deleted.', 400)
  // Still not built (PR 4). The refusal is recorded; a failure to record it changes nothing, so it is only logged.
  await recordOwnerEvent(
    request,
    owner.uid,
    {
      action: 'ownerDeleteOrganisation.blocked',
      targetOrgId: orgId,
      reason: 'Admin SDK recursive delete is required before this action is enabled',
    },
    { phase: 'failed' }
  ).catch((error) => console.warn('[owner/delete-organisation] audit', error))
  return jsonError(
    'Organisation deletion is irreversible and runs as a server job. It is disabled until FIREBASE_SERVICE_ACCOUNT_JSON is available so a failed load cannot wipe customer data.',
    501
  )
}

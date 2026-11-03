import { NextRequest } from 'next/server'
import { bearerToken, firestorePatch, stringField } from '@/lib/owner/firestoreRest'
import { enforceRateLimit, isFirebaseUser, jsonError, readJsonBody, requireFirebaseUser } from '@/lib/security/apiGuard'
import { parseOrganizationId } from '@/lib/security/requireOrgAccess'
import { ORGANIZATION_RESTORED_MESSAGE, canRestoreOrganization } from '@/lib/canonical/organizationDeletion'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { readOrganizationAndViewer } from '@/lib/organizationDeletion/viewer'
import { resumeSubscription } from '@/lib/organizationDeletion/server'

export const runtime = 'nodejs'

const STRIPE_RESTORE_NOTES = {
  resumed: 'The subscription carries on as before.',
  no_subscription: '',
  ended: 'The subscription has ended. Start a new one in Settings → Billing.',
  failed: 'The subscription could not be resumed automatically. Open Manage billing to keep it going.',
} as const

/**
 * Rulebook 1.15.0 §20 (`canRestoreOrganization`): the super admin removes `deletion` with their own token, so the
 * security rules decide (`orgRootSuperAdminRestore`); then the Stripe subscription is resumed when it is still in its
 * period (`cancel_at_period_end` false).
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'organization-restore', 10, 15 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const body = await readJsonBody<{ organizationId?: string }>(request)
  if (!body.ok) return body.response
  const organizationId = parseOrganizationId(body.value.organizationId)
  if (!organizationId) return jsonError('organisation is required', 400)

  const token = bearerToken(request)
  const read = await readOrganizationAndViewer(token, organizationId, user.uid)
  if (!read) return jsonError('Organisation not found', 404)
  const owner = user.emailVerified && isPlatformOwnerEmail(user.email)
  if (!canRestoreOrganization({ org: read.org, viewer: read.viewer as never, viewerIsPlatformOwner: owner })) {
    return jsonError('Only the super admin can restore this organisation.', 403)
  }
  try {
    await firestorePatch(token, `organizations/${organizationId}`, { updatedBy: stringField(user.uid), updatedFrom: stringField('web') }, [
      'deletion',
      'updatedBy',
      'updatedFrom',
    ])
  } catch (error) {
    console.error('[organization/restore]', error)
    return jsonError('Could not restore the organisation.', 403)
  }
  const stripe = await resumeSubscription(read.org)
  return Response.json(
    { ok: true, message: ORGANIZATION_RESTORED_MESSAGE, stripe, stripeNote: STRIPE_RESTORE_NOTES[stripe] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

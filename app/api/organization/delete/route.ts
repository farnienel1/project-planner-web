import { NextRequest } from 'next/server'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { clientSafeMessage, enforceRateLimit, isFirebaseUser, jsonError, readJsonBody, requireFirebaseUser } from '@/lib/security/apiGuard'
import { firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { parseOrganizationId } from '@/lib/security/requireOrgAccess'
import {
  ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE,
  isOrganizationSuperAdmin,
  organizationDeleteConfirmationError,
} from '@/lib/canonical/organizationDeletion'
import { parseOrganizationName } from '@/lib/canonical'
import { readOrganizationAndViewer } from '@/lib/organizationDeletion/viewer'
import { scheduleOrganizationDeletion } from '@/lib/organizationDeletion/server'

export const runtime = 'nodejs'

/**
 * Rulebook 1.15.0 §20: the super admin deletes the organisation (Settings → Billing → Delete organisation). The
 * organisation is locked for 30 days (restorable by the super admin), Stripe cancels at the period end with no
 * refund, and the platform owner and the super admin are emailed.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'organization-delete', 5, 15 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<{ organizationId?: string; typedName?: string; typedConfirmation?: string }>(request)
  if (!body.ok) return body.response
  const organizationId = parseOrganizationId(body.value.organizationId)
  if (!organizationId) return jsonError('organisation is required', 400)
  if (!firebaseAdminConfigured()) {
    return jsonError('Deleting an organisation is unavailable on this server. Email info@projectplanner.us.', 501)
  }

  const read = await readOrganizationAndViewer(bearerToken(request), organizationId, user.uid)
  if (!read) return jsonError('Organisation not found', 404)
  if (!isOrganizationSuperAdmin(read.viewer as never, { id: organizationId, creatorUserId: read.org.creatorUserId })) {
    return jsonError(ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE, 403)
  }
  const confirmation = organizationDeleteConfirmationError({
    organizationName: parseOrganizationName(read.org) || '',
    typedName: String(body.value.typedName ?? ''),
    typedConfirmation: String(body.value.typedConfirmation ?? ''),
  })
  if (confirmation) return jsonError(confirmation, 400)

  try {
    const result = await scheduleOrganizationDeletion({
      organizationId,
      requestedBy: user.uid,
      requestedByEmail: user.email || String(read.viewer.email || ''),
      restoreBy: 'super_admin',
    })
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[organization/delete]', error)
    return jsonError(clientSafeMessage(error, 'Could not delete the organisation.'), 502)
  }
}

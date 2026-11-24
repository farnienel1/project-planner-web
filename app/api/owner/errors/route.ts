import { NextRequest } from 'next/server'
import { isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_READ_FAILED_MESSAGE, ownerJson, ownerReadGuard } from '@/lib/owner/ownerReadRoute'
import { readClientErrorOrganisations, readClientErrors } from '@/lib/owner/clientErrorsRead'
import { CLIENT_ERROR_PLATFORMS, clientErrorGroups } from '@/lib/canonical'

export const runtime = 'nodejs'

/**
 * GET /api/owner/errors?platform=web|ios&organizationId= — the newest 1,000 client error reports matching the filters
 * (rulebook §32, D7), grouped by platform, kind, where and message key / hash with counts, newest first. Owner only (the security rules let only
 * the platform owner read `clientErrors`; the read uses the owner's own token). `organizationId=-` means reports
 * sent with no organisation open.
 */
export async function GET(request: NextRequest) {
  const owner = await ownerReadGuard(request, 'owner-errors', 30)
  if (!isFirebaseUser(owner)) return owner
  const platformRaw = request.nextUrl.searchParams.get('platform') || ''
  if (platformRaw && !(CLIENT_ERROR_PLATFORMS as readonly string[]).includes(platformRaw)) return jsonError('Unknown platform.', 400)
  const orgRaw = (request.nextUrl.searchParams.get('organizationId') || '').trim()
  if (orgRaw.length > 128 || (orgRaw && orgRaw !== '-' && !/^[A-Za-z0-9_-]+$/.test(orgRaw))) return jsonError('Unknown organisation.', 400)
  try {
    const token = bearerToken(request)
    const filter = { platform: platformRaw || null, organizationId: orgRaw ? (orgRaw === '-' ? '' : orgRaw) : null }
    const filtered = filter.platform != null || filter.organizationId != null
    const records = await readClientErrors(token, filter)
    const organisations = filtered
      ? await readClientErrorOrganisations(token)
      : [...new Set(records.map((record) => record.organizationId))].sort()
    const groups = clientErrorGroups(records, filter)
    return ownerJson({ total: records.length, organisations, groups })
  } catch (error) {
    console.error('[owner/errors]', error)
    return jsonError(OWNER_READ_FAILED_MESSAGE, 502)
  }
}

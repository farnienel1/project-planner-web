import { NextRequest, NextResponse } from 'next/server'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimitKey, isFirebaseUser, jsonError, requireFirebaseUser } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { readComplianceAsCaller, readShareLink, revokeShareLink, writeComplianceAudit } from '@/lib/compliance/server/complianceShare'

export const runtime = 'nodejs'

/** Rulebook 1.83.0 §31: an admin turns a share link off at once (the security rules decide who is an admin). */
const schema = apiObject({ organizationId: apiText(200), id: apiText(64) })

export async function POST(request: NextRequest) {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const limited = enforceRateLimitKey('compliance-share-revoke', user.uid, 60, 60 * 60 * 1000)
  if (limited) return limited
  const body = await readApiBody(request, schema)
  if (!body.ok) return body.response
  const { organizationId, id } = body.value
  if (!/^[0-9a-f]{64}$/.test(id)) return jsonError('Unknown link.', 404)
  const read = await readComplianceAsCaller(bearerToken(request), organizationId)
  if (!read.ok) return jsonError(read.status === 403 ? 'Only an admin can turn links off.' : 'Try again.', read.status)
  try {
    const link = await readShareLink(id)
    if (!link || link.organizationId !== organizationId) return jsonError('Unknown link.', 404)
    if (link.revokedAtMs == null) await revokeShareLink(id, user.uid)
  } catch {
    return jsonError('The link could not be turned off. Try again.', 503)
  }
  await writeComplianceAudit({ organizationId, action: 'link_revoked', linkId: id, actorUid: user.uid })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

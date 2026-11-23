import { NextRequest } from 'next/server'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, enforceRateLimitKey, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { requireOwnerSession } from '@/lib/owner/requireOwner'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, recordOwnerEvent } from '@/lib/owner/ownerAudit'
import { ownerJson } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, ownerPersonEmails } from '@/lib/owner/personServer'

export const runtime = 'nodejs'

/**
 * POST /api/owner/people/[uid]/reveal-email — spec §1.7: emails are masked by default and a reveal writes an audit
 * entry. The entry is stored first (`ownerRevealEmail`, phase completed); if it cannot be stored, nothing is shown.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  const limited = enforceRateLimit(request, 'owner-reveal-email', 60, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwnerSession(request)
  if (!isFirebaseUser(owner)) return owner
  const perOwner = enforceRateLimitKey('owner-reveal-email:uid', owner.uid, 60, 10 * 60 * 1000)
  if (perOwner) return perOwner
  const { uid } = await context.params
  if (!isValidDocumentId(uid)) return jsonError('That person id is not valid.', 400)
  const body = await readApiBody(request, apiObject({ reason: apiText(500) }))
  if (!body.ok) return body.response
  let emails: string[]
  try {
    const person = await loadOwnerPerson(bearerToken(request), uid)
    emails = ownerPersonEmails(person.userDocs)
  } catch (error) {
    if (error instanceof OwnerPersonNotFoundError) return jsonError(error.message, 404)
    return jsonError('Could not read that person. Try again.', 502)
  }
  try {
    await recordOwnerEvent(request, owner.uid, { action: 'ownerRevealEmail', targetUserId: uid, reason: body.value.reason || undefined })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
  return ownerJson({ emails })
}

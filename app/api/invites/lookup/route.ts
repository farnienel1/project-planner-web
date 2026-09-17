import { NextRequest } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { isValidUuid } from '@/lib/security/validation'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'invite-lookup', 30, 10 * 60 * 1000)
  if (limited) return limited

  const invitationId = request.nextUrl.searchParams.get('invitationId')?.trim()
  if (!invitationId || !isValidUuid(invitationId)) {
    return jsonError('invitationId is required', 400)
  }

  try {
    const db = getFirebaseDb()
    const invitationSnap = await getDoc(doc(db, 'invitations', invitationId))
    if (!invitationSnap.exists()) {
      return jsonError('Invitation not found', 404)
    }

    const invitation = invitationSnap.data()
    if (invitation.isUsed === true) {
      return jsonError('This invitation has already been used', 400)
    }

    return Response.json({
      invitationId,
      email: typeof invitation.email === 'string' ? invitation.email : '',
      firstName: typeof invitation.firstName === 'string' ? invitation.firstName : '',
      surname: typeof invitation.surname === 'string' ? invitation.surname : '',
      organizationId:
        typeof invitation.organizationId === 'string' ? invitation.organizationId : '',
    })
  } catch (error) {
    console.error('[invites/lookup]', error)
    return jsonError('Could not load invitation', 500)
  }
}

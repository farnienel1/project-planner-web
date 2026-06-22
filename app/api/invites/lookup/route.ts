import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const invitationId = request.nextUrl.searchParams.get('invitationId')?.trim()
  if (!invitationId) {
    return NextResponse.json({ error: 'invitationId is required' }, { status: 400 })
  }

  try {
    const db = getFirebaseDb()
    const invitationSnap = await getDoc(doc(db, 'invitations', invitationId))
    if (!invitationSnap.exists()) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const invitation = invitationSnap.data()
    if (invitation.isUsed === true) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 })
    }

    return NextResponse.json({
      invitationId,
      email: invitation.email,
      firstName: invitation.firstName,
      surname: invitation.surname,
      organizationId: invitation.organizationId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load invitation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

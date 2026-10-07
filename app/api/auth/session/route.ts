import { NextRequest } from 'next/server'

import { authResultToResponse } from '@/lib/auth/authResultResponse'
import { mintWebSession } from '@/lib/auth/webSession'
import { isFirebaseUser, jsonError, requireFirebaseUser } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  if (!idToken) return jsonError('Sign in required', 401)
  const cookie = await mintWebSession({
    idToken,
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  })
  return authResultToResponse({ status: 200, body: { ok: true }, cookie })
}

export async function DELETE() {
  return authResultToResponse({ status: 200, body: { ok: true }, clearCookie: true })
}

import { NextRequest, NextResponse } from 'next/server'

import { sendPasskeysRemovedNotice } from '@/lib/auth/passkeys/passkeyNotices'
import { passkeysOffResponse, passkeyUnavailable } from '@/lib/auth/passkeys/passkeyRoute'
import { pruneStalePasskeys } from '@/lib/auth/passkeys/passkeyService'
import { firebasePasskeyAuthAccounts, firestorePasskeyStore } from '@/lib/auth/passkeys/passkeyStore'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { enforceRateLimit, lookupFirebaseIdToken, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type Body = { email?: string }

/**
 * Called by the browser right after a password change (signed in: the ID token names the account) or a password
 * reset (signed out: the email from the reset link). It removes only the account's passkeys made BEFORE Firebase
 * Auth's own `passwordUpdatedAt` — passkeys that already no longer work (sign-in refuses them, passkeyService.ts) —
 * so the unauthenticated email form can remove nothing that still counts, and it never says whether the email has
 * an account or passkeys. The account is emailed when any were removed. Signed in, the answer says how many.
 */
export async function POST(request: NextRequest) {
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-password-changed', 10, 10 * 60 * 1000)
  if (limited) return limited
  const hasBody = Number(request.headers.get('content-length') || '0') > 0
  const body = hasBody ? await readJsonBody<Body>(request, 2048) : { ok: true as const, value: {} as Body }
  if (!body.ok) return body.response
  const auth = firebasePasskeyAuthAccounts()
  const store = firestorePasskeyStore()
  try {
    const token = bearerToken(request)
    if (token) {
      const lookup = await lookupFirebaseIdToken(token)
      if (lookup.status === 'ok') {
        const removed = await pruneStalePasskeys({ uid: lookup.user.uid, store, auth })
        if (removed > 0) await sendPasskeysRemovedNotice({ email: lookup.user.email, count: removed, idToken: token })
        return NextResponse.json({ ok: true, removed }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }
    const email = typeof body.value.email === 'string' ? body.value.email.trim().toLowerCase().slice(0, 320) : ''
    if (email && email.includes('@') && auth.uidForEmail) {
      const uid = await auth.uidForEmail(email)
      if (uid) {
        const removed = await pruneStalePasskeys({ uid, store, auth })
        if (removed > 0) await sendPasskeysRemovedNotice({ email, count: removed })
      }
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return passkeyUnavailable('password-changed', error)
  }
}

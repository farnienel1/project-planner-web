import { NextRequest, NextResponse } from 'next/server'

import { PASSWORD_CHANGED_EMAIL_MIN_MS } from '@/lib/auth/passkeys/passkeyConfig'
import { sendPasskeysRemovedNotice } from '@/lib/auth/passkeys/passkeyNotices'
import { padToMinimumDuration, passkeysOffResponse, passkeyUnavailable, runAfterResponse } from '@/lib/auth/passkeys/passkeyRoute'
import { pruneStalePasskeys } from '@/lib/auth/passkeys/passkeyService'
import { firebasePasskeyAuthAccounts, firestorePasskeyStore } from '@/lib/auth/passkeys/passkeyStore'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { enforceRateLimit, enforceRateLimitKey, lookupFirebaseIdToken, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

type Body = { email?: string }

/**
 * Called by the browser right after a password change (signed in: the ID token names the account) or a password
 * reset (signed out: the email from the reset link). It removes only the account's passkeys made BEFORE Firebase
 * Auth's own `passwordUpdatedAt` — passkeys that already no longer work (sign-in refuses them, passkeyService.ts) —
 * so the email form can remove nothing that still counts.
 *
 * The signed-out email form answers `{ ok: true }` after the same minimum time for every email and does the lookup,
 * the removal and any "passkeys removed" email after the answer is sent, so neither the body nor the timing says
 * whether the email has an account or passkeys. It is rate-limited per address and per email. Signed in, the answer
 * says how many were removed (the caller is that account); the email still goes after the answer.
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const off = passkeysOffResponse()
  if (off) return off
  const limited = enforceRateLimit(request, 'passkey-password-changed', 10, 10 * 60 * 1000)
  if (limited) return limited
  const hasBody = Number(request.headers.get('content-length') || '0') > 0
  const body = hasBody ? await readJsonBody<Body>(request, 2048) : { ok: true as const, value: {} as Body }
  if (!body.ok) return body.response
  const auth = firebasePasskeyAuthAccounts()
  const store = firestorePasskeyStore()

  const token = bearerToken(request)
  if (token) {
    try {
      const lookup = await lookupFirebaseIdToken(token)
      if (lookup.status === 'ok') {
        const removed = await pruneStalePasskeys({ uid: lookup.user.uid, store, auth })
        // Only the request that actually removed passkeys emails, and only after answering.
        if (removed > 0) {
          runAfterResponse('password-changed', () => sendPasskeysRemovedNotice({ email: lookup.user.email, count: removed, idToken: token }))
        }
        return NextResponse.json({ ok: true, removed }, { headers: { 'Cache-Control': 'no-store' } })
      }
    } catch (error) {
      return passkeyUnavailable('password-changed', error)
    }
  }

  const email = typeof body.value.email === 'string' ? body.value.email.trim().toLowerCase().slice(0, 320) : ''
  if (email) {
    const emailLimited = enforceRateLimitKey('passkey-password-changed-email', email, 5, 10 * 60 * 1000)
    if (emailLimited) return emailLimited
  }
  if (email && email.includes('@') && auth.uidForEmail) {
    const lookupEmail = auth.uidForEmail.bind(auth)
    runAfterResponse('password-changed', async () => {
      const uid = await lookupEmail(email)
      if (!uid) return
      const removed = await pruneStalePasskeys({ uid, store, auth })
      if (removed > 0) await sendPasskeysRemovedNotice({ email, count: removed })
    })
  }
  await padToMinimumDuration(startedAt, PASSWORD_CHANGED_EMAIL_MIN_MS)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

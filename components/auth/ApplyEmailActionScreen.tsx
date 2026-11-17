'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { applyActionCode, checkActionCode } from 'firebase/auth'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { awaitAppCheckToken, ensureAppCheck, initializedAppCheck } from '@/lib/firebase/appCheck'
import { ensureFirebaseApp, getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { loginPathForResetEmail, type ParsedEmailAction } from '@/lib/auth/emailAction'

type State =
  | { kind: 'checking' }
  | { kind: 'done'; email: string }
  | { kind: 'error'; message: string }

const TITLES: Record<string, { checking: string; done: string }> = {
  verifyEmail: { checking: 'Checking this link…', done: 'Email verified' },
  verifyAndChangeEmail: { checking: 'Checking this link…', done: 'Email changed' },
  recoverEmail: { checking: 'Checking this link…', done: 'Email change undone' },
}

function doneText(mode: string, email: string): string {
  if (mode === 'verifyAndChangeEmail') return `Sign in with ${email} from now on.`
  if (mode === 'recoverEmail') {
    return `Your login email is ${email} again. If you didn't ask for the change, reset your password now.`
  }
  return email ? `${email} is verified. You can sign in.` : 'Your email is verified. You can sign in.'
}

function errorText(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === 'auth/expired-action-code') return 'This link has expired. Ask for a new one.'
  if (code === 'auth/invalid-action-code') return 'This link is invalid or has already been used.'
  if (code === 'auth/email-already-in-use') return 'That email is already used by another login.'
  return 'This link could not be used. Ask for a new one.'
}

/**
 * Verify email, confirm a new login email and undo an email change (`mode` verifyEmail, verifyAndChangeEmail,
 * recoverEmail). Before 17 Nov /auth/action only handled password resets, so these links (Firebase's, which use the
 * same action URL) showed "This reset link is missing its code". Applies the code once and says what happened.
 */
export function ApplyEmailActionScreen({ action }: { action: ParsedEmailAction }) {
  const mode = action.mode || 'verifyEmail'
  const [state, setState] = useState<State>({ kind: 'checking' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const app = ensureFirebaseApp()
        ensureAppCheck(app)
        await awaitAppCheckToken(initializedAppCheck())
        const auth = getFirebaseAuth()
        const info = await checkActionCode(auth, action.oobCode)
        await applyActionCode(auth, action.oobCode)
        // verifyEmail / verifyAndChangeEmail: the address now verified; recoverEmail: the address restored.
        const email = info.data.email || ''
        if (!cancelled) setState({ kind: 'done', email })
      } catch (error) {
        if (!cancelled) setState({ kind: 'error', message: errorText(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [action.oobCode, mode])

  const titles = TITLES[mode] || TITLES.verifyEmail!
  const loginHref = state.kind === 'done' ? loginPathForResetEmail(state.email) : '/login'

  return (
    <div className="login" style={{ gridTemplateColumns: '1fr' }}>
      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <div className="mb-6 flex items-center gap-3">
            <AppLogoMark size={40} radius={12} />
            <b className="font-[family-name:var(--head)] text-lg">Project Planner</b>
          </div>
          {state.kind === 'checking' ? (
            <p className="muted">{titles.checking}</p>
          ) : state.kind === 'done' ? (
            <>
              <div className="ico-chip lg" data-hue="green">
                ✓
              </div>
              <h1 className="mt-4 text-[28px] font-extrabold">{titles.done}</h1>
              <p className="muted mt-2">{doneText(mode, state.email)}</p>
              {mode === 'recoverEmail' ? (
                <Link href={`/reset-password?email=${encodeURIComponent(state.email)}`} className="btn primary block mt-6">
                  Reset password
                </Link>
              ) : null}
              <Link href={loginHref} className={`btn ${mode === 'recoverEmail' ? '' : 'primary '}block mt-3`}>
                {loginHref === '/developer-login' ? 'Developer login' : 'Sign in'}
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[28px] font-extrabold">Link not used</h1>
              <p className="banner mt-4" data-hue="red">
                {state.message}
              </p>
              <Link href="/login" className="btn primary block mt-6">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

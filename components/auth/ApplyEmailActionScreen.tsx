'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ActionCodeOperation, applyActionCode, checkActionCode } from 'firebase/auth'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { awaitAppCheckToken, ensureAppCheck, initializedAppCheck } from '@/lib/firebase/appCheck'
import { ensureFirebaseApp, getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { loginPathForResetEmail, type ParsedEmailAction } from '@/lib/auth/emailAction'

/** What the link does, from Firebase's own answer (`checkActionCode` → `operation`), never the URL's `mode`. */
type Kind = 'verify' | 'change' | 'recover'

const COPY: Record<Kind, { title: string; button: string; done: string }> = {
  verify: { title: 'Verify your email', button: 'Verify email', done: 'Email verified' },
  change: { title: 'Confirm your new email', button: 'Confirm new email', done: 'Email changed' },
  recover: { title: 'Undo email change', button: 'Undo email change', done: 'Email change undone' },
}

function kindOf(operation: string): Kind | null {
  if (operation === ActionCodeOperation.VERIFY_EMAIL) return 'verify'
  if (operation === ActionCodeOperation.VERIFY_AND_CHANGE_EMAIL) return 'change'
  if (operation === ActionCodeOperation.RECOVER_EMAIL) return 'recover'
  return null
}

function readyText(kind: Kind, email: string, previousEmail: string): string {
  if (kind === 'change') return `Sign in with ${email} from now on${previousEmail ? ` instead of ${previousEmail}` : ''}.`
  if (kind === 'recover') return `Change your login email back to ${email}.`
  return `Confirm ${email} for your Project Planner login.`
}

function doneText(kind: Kind, email: string): string {
  if (kind === 'change') return `Sign in with ${email} from now on.`
  if (kind === 'recover') {
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

type State =
  | { step: 'checking' }
  | { step: 'ready'; kind: Kind; email: string; previousEmail: string }
  | { step: 'applying'; kind: Kind; email: string; previousEmail: string }
  | { step: 'done'; kind: Kind; email: string }
  | { step: 'error'; message: string }

/**
 * Verify email, confirm a new login email and undo an email change. Before 17 Nov /auth/action only handled password
 * resets, so these links showed "This reset link is missing its code". The link is checked first (`checkActionCode`,
 * which does not use it up) and applied only when the person presses the button (review of #361: a mail scanner
 * that opens links must not undo an email change by itself). What it does is read from Firebase's answer.
 */
export function ApplyEmailActionScreen({ action }: { action: ParsedEmailAction }) {
  const [state, setState] = useState<State>({ step: 'checking' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const app = ensureFirebaseApp()
        ensureAppCheck(app)
        await awaitAppCheckToken(initializedAppCheck())
        const info = await checkActionCode(getFirebaseAuth(), action.oobCode)
        const kind = kindOf(info.operation)
        if (cancelled) return
        if (!kind) {
          setState({ step: 'error', message: 'This link could not be used. Ask for a new one.' })
          return
        }
        setState({ step: 'ready', kind, email: info.data.email || '', previousEmail: info.data.previousEmail || '' })
      } catch (error) {
        if (!cancelled) setState({ step: 'error', message: errorText(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [action.oobCode])

  const apply = async () => {
    if (state.step !== 'ready') return
    setState({ ...state, step: 'applying' })
    try {
      await applyActionCode(getFirebaseAuth(), action.oobCode)
      setState({ step: 'done', kind: state.kind, email: state.email })
    } catch (error) {
      setState({ step: 'error', message: errorText(error) })
    }
  }

  const loginHref = state.step === 'done' ? loginPathForResetEmail(state.email) : '/login'

  return (
    <div className="login" style={{ gridTemplateColumns: '1fr' }}>
      <div className="form-side">
        <div style={{ width: 'min(420px, 100%)' }}>
          <div className="mb-6 flex items-center gap-3">
            <AppLogoMark size={40} radius={12} />
            <b className="font-[family-name:var(--head)] text-lg">Project Planner</b>
          </div>
          {state.step === 'checking' ? (
            <p className="muted">Checking this link…</p>
          ) : state.step === 'ready' || state.step === 'applying' ? (
            <>
              <h1 className="text-[28px] font-extrabold">{COPY[state.kind].title}</h1>
              <p className="muted mt-2">{readyText(state.kind, state.email, state.previousEmail)}</p>
              <button
                type="button"
                className="btn primary block mt-6"
                disabled={state.step === 'applying'}
                onClick={() => void apply()}
              >
                {state.step === 'applying' ? 'Working…' : COPY[state.kind].button}
              </button>
            </>
          ) : state.step === 'done' ? (
            <>
              <div className="ico-chip lg" data-hue="green">
                ✓
              </div>
              <h1 className="mt-4 text-[28px] font-extrabold">{COPY[state.kind].done}</h1>
              <p className="muted mt-2">{doneText(state.kind, state.email)}</p>
              {state.kind === 'recover' ? (
                <Link href={`/reset-password?email=${encodeURIComponent(state.email)}`} className="btn primary block mt-6">
                  Reset password
                </Link>
              ) : null}
              <Link href={loginHref} className={`btn ${state.kind === 'recover' ? '' : 'primary '}block mt-3`}>
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

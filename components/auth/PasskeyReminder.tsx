'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { useAuthStore } from '@/lib/stores/authStore'
import { auth } from '@/lib/firebase/config'
import { onPlatformConfigChange, webUpdateRequiredFor } from '@/lib/access/securitySwitches'
import { webUpdateGateShown } from '@/lib/app/webUpdateGate'
import {
  getAnalyticsConsent,
  shouldAutoPromptAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsentChoice,
} from '@/lib/analytics/analyticsConsent'
import { listPasskeys, passkeysAvailableHere } from '@/lib/auth/passkeys/passkeyClient'
import {
  isPasskeyReminderSilenced,
  passkeyReminderBlocked,
  passkeyReminderShows,
  passkeyReminderWorthChecking,
  PASSKEY_REMINDER_BODY,
  PASSKEY_REMINDER_CLOSE_LABEL,
  PASSKEY_REMINDER_GO_LABEL,
  PASSKEY_REMINDER_NEVER_LABEL,
  PASSKEY_REMINDER_TITLE,
  PASSKEY_SETTINGS_HREF,
  silencePasskeyReminder,
  takePasskeyReminderDue,
} from '@/lib/auth/passkeys/passkeyReminder'

function store(kind: 'local' | 'session'): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * After a password + emailed code sign-in, suggests adding a passkey once (owner 24 Nov). Rules in
 * `lib/auth/passkeys/passkeyReminder.ts`. The red ✕ (and Escape) closes it until the next code sign-in.
 */
export function PasskeyReminder() {
  const router = useRouter()
  const uid = useAuthStore((state) => state.user?.id || '')
  const signedInUser = useAuthStore((state) => state.user)
  const [open, setOpen] = useState(false)
  // Review of #449: wait while the forced-update screen or the analytics consent prompt is up (the same tests
  // WebUpdateGate and AnalyticsConsentHost use, which the dashboard renders alongside this).
  const [updateRequired, setUpdateRequired] = useState(false)
  // Read on first render (this renders nothing until the reminder opens, so no hydration mismatch).
  const [consent, setConsent] = useState<AnalyticsConsentChoice | null>(() =>
    typeof window === 'undefined' ? null : getAnalyticsConsent()
  )
  const consentRead = typeof window !== 'undefined'
  const checkedFor = useRef('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    if (!uid || checkedFor.current === uid) return
    checkedFor.current = uid
    const due = takePasskeyReminderDue(uid, store('session'))
    const available = due && passkeysAvailableHere()
    const silenced = isPasskeyReminderSilenced(uid, store('local'))
    if (!passkeyReminderWorthChecking({ due, available, silenced })) return
    let cancelled = false
    void (async () => {
      let passkeyCount: number | null = null
      try {
        passkeyCount = (await listPasskeys()).length
      } catch {
        passkeyCount = null
      }
      if (!cancelled && passkeyReminderShows({ due, available, silenced, passkeyCount })) setOpen(true)
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    const running = process.env.NEXT_PUBLIC_RULEBOOK_VERSION
    const check = () => setUpdateRequired(webUpdateRequiredFor(running))
    check()
    return onPlatformConfigChange(check)
  }, [])

  useEffect(() => subscribeAnalyticsConsent(setConsent), [])

  const firebaseUser = signedInUser ? auth?.currentUser : null
  const blocked = passkeyReminderBlocked({
    updateGateShown: webUpdateGateShown(
      updateRequired,
      firebaseUser ? { email: firebaseUser.email, emailVerified: firebaseUser.emailVerified } : null
    ),
    // Until the stored choice is read, assume the prompt may show (never flash on top of it).
    consentPromptShown: !consentRead || shouldAutoPromptAnalyticsConsent({ autoPrompt: true, choice: consent, ready: true }),
  })
  const visible = open && !blocked

  useEffect(() => {
    if (!visible) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      returnFocus.current?.focus?.()
    }
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  const close = () => setOpen(false)
  const never = () => {
    silencePasskeyReminder(uid, store('local'))
    setOpen(false)
  }
  const go = () => {
    setOpen(false)
    router.push(PASSKEY_SETTINGS_HREF)
  }

  return createPortal(
    <div className="fixed inset-0 z-100 grid place-items-center p-4" data-testid="passkey-reminder">
      <div className="absolute inset-0 bg-[rgba(10,20,40,.4)]" aria-hidden="true" onClick={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-[min(440px,calc(100vw-32px))] rounded-3xl bg-(--card) p-6 shadow-(--sh-pop)"
      >
        <div className="flex items-start gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 text-xl font-extrabold text-(--ink)">
            {PASSKEY_REMINDER_TITLE}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={PASSKEY_REMINDER_CLOSE_LABEL}
            title={PASSKEY_REMINDER_CLOSE_LABEL}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-(--red) bg-(--card) text-lg font-extrabold leading-none text-(--red) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--red)"
            data-testid="passkey-reminder-close"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p id={bodyId} className="mt-2 text-(--ink2)">
          {PASSKEY_REMINDER_BODY}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" className="btn" onClick={never} data-testid="passkey-reminder-never">
            {PASSKEY_REMINDER_NEVER_LABEL}
          </button>
          <button type="button" className="btn primary" onClick={go} data-autofocus data-testid="passkey-reminder-go">
            {PASSKEY_REMINDER_GO_LABEL}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

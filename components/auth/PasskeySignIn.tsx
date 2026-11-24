'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuthStore } from '@/lib/stores/authStore'
import { isMfaRequiredError, mfaVerifyHref } from '@/lib/auth/mfa/mfaClient'
import { safePostMfaPath } from '@/lib/auth/mfa/mfaConstants'
import {
  cancelPasskeyCeremony,
  isPasskeyCancelled,
  passkeyAutofillAvailable,
  passkeySignIn,
  passkeysAvailableHere,
} from '@/lib/auth/passkeys/passkeyClient'
import { primeWelcomeSound } from '@/lib/feedbackSounds/feedback'

/**
 * "Sign in with a passkey" (Touch ID, Face ID, Windows Hello or a phone). Renders nothing while the passkeys switch
 * is off or the browser cannot use passkeys. With `autofill`, it also offers saved passkeys in the email field's
 * autofill (the field needs `autoComplete="username webauthn"`).
 */
export function PasskeySignIn({
  next,
  ownerOnly = false,
  autofill = false,
  onError,
}: {
  next: string
  ownerOnly?: boolean
  autofill?: boolean
  onError: (message: string) => void
}) {
  const router = useRouter()
  const signInWithPasskey = useAuthStore((state) => state.signInWithPasskey)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const finishing = useRef(false)
  const fallback = ownerOnly ? '/developer' : '/dashboard'

  useEffect(() => {
    setAvailable(passkeysAvailableHere())
  }, [])

  async function finish(result: { customToken: string; next: string }) {
    finishing.current = true
    const destination = safePostMfaPath(result.next || next, fallback)
    try {
      await signInWithPasskey(result.customToken, { next: destination })
    } catch (error) {
      if (isMfaRequiredError(error)) {
        router.replace(mfaVerifyHref(destination))
        return
      }
      finishing.current = false
      onError(error instanceof Error ? error.message : 'Passkey sign-in failed.')
    }
  }

  useEffect(() => {
    if (!autofill || !available) return
    let cancelled = false
    void (async () => {
      if (!(await passkeyAutofillAvailable()) || cancelled) return
      try {
        const result = await passkeySignIn({ next, ownerOnly, autofill: true })
        if (!cancelled) await finish(result)
      } catch (error) {
        if (!cancelled && !isPasskeyCancelled(error)) onError(error instanceof Error ? error.message : 'Passkey sign-in failed.')
      }
    })()
    return () => {
      cancelled = true
      if (!finishing.current) cancelPasskeyCeremony()
    }
    // Start once per page; `finish` reads the latest props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofill, available])

  if (!available) return null

  const start = async () => {
    if (busy) return
    setBusy(true)
    onError('')
    // Inside the button press: arms the sign-in chord and starts audio (sounds on only). The code screen this hands over
    // to plays it once the passkey sign-in is confirmed, before it navigates.
    primeWelcomeSound()
    try {
      const result = await passkeySignIn({ next, ownerOnly })
      await finish(result)
    } catch (error) {
      if (!isPasskeyCancelled(error)) onError(error instanceof Error ? error.message : 'Passkey sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={busy}
      className="btn block mt-3"
      style={{ height: 52 }}
      data-testid="passkey-sign-in"
    >
      {busy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
    </button>
  )
}

'use client'

/**
 * Rulebook §18 forced update on web: when `platformConfig/app.minimumWebVersion` is above this build
 * (`appUpdateRequired`, via `webUpdateRequiredFor`), the signed-in app shows only a reload screen, so an open tab on
 * an old build stops writing old shapes. The running build is the rulebook version this web build was packed with
 * (`NEXT_PUBLIC_RULEBOOK_VERSION`, the same number Settings shows as "Rules x.y.z"); web releases follow it.
 */
import { useEffect, useState } from 'react'
import { onPlatformConfigChange, webUpdateRequiredFor } from '@/lib/access/securitySwitches'
import { auth } from '@/lib/firebase/config'
import { webUpdateGateShown } from '@/lib/app/webUpdateGate'
import { useAuthStore } from '@/lib/stores/authStore'

export const WEB_UPDATE_REQUIRED_TITLE = 'A new version of Project Planner is available'
export const WEB_UPDATE_REQUIRED_MESSAGE = 'Reload the page to carry on. Nothing you saved is lost.'

export function WebUpdateGate() {
  const running = process.env.NEXT_PUBLIC_RULEBOOK_VERSION
  const [required, setRequired] = useState(false)
  // Re-checked when the signed-in user changes (the store user changes with the Firebase user).
  const signedInUser = useAuthStore((state) => state.user)
  useEffect(() => {
    const check = () => setRequired(webUpdateRequiredFor(running))
    check()
    return onPlatformConfigChange(check)
  }, [running])
  const firebaseUser = signedInUser ? auth?.currentUser : null
  if (!webUpdateGateShown(required, firebaseUser ? { email: firebaseUser.email, emailVerified: firebaseUser.emailVerified } : null)) {
    return null
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[var(--bg,#fff)] p-6" role="alertdialog" aria-modal="true" aria-labelledby="web-update-title">
      <div className="max-w-sm text-center">
        <h1 id="web-update-title" className="text-xl font-extrabold">
          {WEB_UPDATE_REQUIRED_TITLE}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink2)]">{WEB_UPDATE_REQUIRED_MESSAGE}</p>
        <button type="button" className="btn primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}

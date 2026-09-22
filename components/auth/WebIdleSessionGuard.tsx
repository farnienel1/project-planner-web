'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerSession } from '@/lib/platform/owner'
import {
  WEB_IDLE_STORAGE_KEY,
  isWebIdleExpired,
  readWebIdleLastActivity,
  touchWebIdleActivity,
} from '@/lib/auth/webIdleSession'

const CHECK_EVERY_MS = 60_000

/**
 * Extends the web idle clock on real use (click / key / pointer).
 * A 60s timer plus tab-focus covers leaving a page open unattended.
 * No extra Firebase reads.
 */
export function WebIdleSessionGuard() {
  const signedIn = useAuthStore((state) => Boolean(state.firebaseUser || state.user))
  const ownerEmail = useAuthStore((state) => state.firebaseUser?.email || state.user?.email)
  const ownerOrg = useAuthStore((state) => state.user?.organizationId)
  const ownerSession = isPlatformOwnerSession(ownerEmail, ownerOrg)
  const signOut = useAuthStore((state) => state.signOut)
  const signingOut = useRef(false)

  useEffect(() => {
    if (!signedIn || ownerSession) {
      signingOut.current = false
      return
    }

    const logoutIfIdle = () => {
      if (signingOut.current) return false
      if (!isWebIdleExpired(Date.now(), readWebIdleLastActivity())) return false
      signingOut.current = true
      void signOut({ idle: true }).catch(() => {
        signingOut.current = false
      })
      return true
    }

    const onActivity = () => {
      if (logoutIfIdle()) return
      touchWebIdleActivity()
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      onActivity()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== WEB_IDLE_STORAGE_KEY) return
      logoutIfIdle()
    }

    if (logoutIfIdle()) return

    document.addEventListener('pointerdown', onActivity, { capture: true, passive: true })
    document.addEventListener('keydown', onActivity, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)
    const timer = window.setInterval(logoutIfIdle, CHECK_EVERY_MS)

    return () => {
      document.removeEventListener('pointerdown', onActivity, true)
      document.removeEventListener('keydown', onActivity, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(timer)
    }
  }, [ownerSession, signedIn, signOut])

  return null
}

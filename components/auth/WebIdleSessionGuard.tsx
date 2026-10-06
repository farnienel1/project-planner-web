'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerSession } from '@/lib/platform/owner'
import {
  WEB_IDLE_STORAGE_KEY,
  WEB_IDLE_TIMEOUT_MS,
  isWebIdleExpired,
  noteWebIdleActivity,
  readWebIdleLastActivity,
} from '@/lib/auth/webIdleSession'

/**
 * Clicks, keys, pointer movement, scrolling, and route changes.
 * Visibility alone does not count — coming back only checks the deadline.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'mousedown', 'click', 'keydown', 'wheel', 'scroll'] as const

/**
 * Signs out after 30 minutes with no real use.
 * The deadline is last activity, not the login time. Each activity
 * re-arms the timer. A hard timeout started at sign-in is not used.
 */
export function WebIdleSessionGuard() {
  const pathname = usePathname()
  const signedIn = useAuthStore((state) => Boolean(state.firebaseUser || state.user))
  const mfaPending = useAuthStore((state) => state.mfaPending)
  const ownerEmail = useAuthStore((state) => state.firebaseUser?.email || state.user?.email)
  const ownerOrg = useAuthStore((state) => state.user?.organizationId)
  const ownerSession = isPlatformOwnerSession(ownerEmail, ownerOrg)
  const signOut = useAuthStore((state) => state.signOut)
  const signingOut = useRef(false)
  const armedFor = useRef(0)
  const rearmRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!signedIn || ownerSession || mfaPending) {
      signingOut.current = false
      rearmRef.current = () => {}
      return
    }

    const logoutIfIdle = () => {
      if (signingOut.current) return true
      if (!isWebIdleExpired(Date.now(), readWebIdleLastActivity())) return false
      signingOut.current = true
      void signOut({ idle: true }).catch(() => {
        signingOut.current = false
      })
      return true
    }

    let timer = 0
    let lastArmAt = 0

    const arm = () => {
      const last = readWebIdleLastActivity() ?? Date.now()
      const deadline = last + WEB_IDLE_TIMEOUT_MS
      if (armedFor.current === deadline) return
      armedFor.current = deadline
      window.clearTimeout(timer)
      const delay = Math.max(0, deadline - Date.now())
      timer = window.setTimeout(() => {
        armedFor.current = 0
        if (!logoutIfIdle()) arm()
      }, delay)
    }

    const onActivity = () => {
      if (signingOut.current) return
      if (logoutIfIdle()) return
      const now = Date.now()
      noteWebIdleActivity(now)
      if (now - lastArmAt < 1000) return
      lastArmAt = now
      arm()
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (logoutIfIdle()) return
      arm()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== WEB_IDLE_STORAGE_KEY) return
      if (logoutIfIdle()) return
      arm()
    }

    const requestArm = () => {
      if (signingOut.current) return
      if (logoutIfIdle()) return
      arm()
    }
    rearmRef.current = requestArm

    if (readWebIdleLastActivity() == null) noteWebIdleActivity()
    if (logoutIfIdle()) {
      rearmRef.current = () => {}
      return
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)
    arm()

    return () => {
      rearmRef.current = () => {}
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity, true)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
      window.clearTimeout(timer)
      armedFor.current = 0
    }
  }, [mfaPending, ownerSession, signedIn, signOut])

  useEffect(() => {
    if (!signedIn || ownerSession || mfaPending || signingOut.current) return
    if (isWebIdleExpired(Date.now(), readWebIdleLastActivity())) return
    noteWebIdleActivity()
    rearmRef.current()
  }, [mfaPending, ownerSession, pathname, signedIn])

  return null
}

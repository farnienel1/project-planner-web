/**
 * Whether to treat the browser as online for the offline banner (UI only). The decision is
 * `shouldShowOfflineBanner` in lib/onlineStatus.ts: the browser's "offline" is confirmed with a real
 * request after a short grace period, re-checked on focus, on the tab being shown and on a timer,
 * and cleared as soon as any check succeeds.
 */
'use client'

import { useEffect, useState } from 'react'
import {
  OFFLINE_GRACE_MS,
  OFFLINE_RECHECK_MS,
  probeReachability,
  shouldShowOfflineBanner,
} from '@/lib/onlineStatus'

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let disposed = false
    let offlineSinceMs: number | null = null
    let timer: number | null = null
    let probing = false

    const clearTimer = () => {
      if (timer != null) window.clearTimeout(timer)
      timer = null
    }
    const schedule = (ms: number) => {
      clearTimer()
      timer = window.setTimeout(() => void check(), ms)
    }
    const backOnline = () => {
      offlineSinceMs = null
      clearTimer()
      setOnline(true)
    }

    const check = async () => {
      if (disposed || probing) return
      if (navigatorOnline()) return backOnline()
      if (offlineSinceMs == null) offlineSinceMs = Date.now()
      probing = true
      const probe = await probeReachability()
      probing = false
      if (disposed) return
      const nowMs = Date.now()
      const nav = navigatorOnline()
      if (nav || probe === 'ok') {
        // The network works: hide now. If the browser still says offline (a stuck false), keep a slow re-check.
        setOnline(true)
        if (nav) return backOnline()
        offlineSinceMs = nowMs
        return schedule(OFFLINE_RECHECK_MS)
      }
      const show = shouldShowOfflineBanner({ navigatorOnline: nav, offlineSinceMs, nowMs, probe })
      setOnline(!show)
      const graceLeft = offlineSinceMs + OFFLINE_GRACE_MS - nowMs
      schedule(show ? OFFLINE_RECHECK_MS : Math.max(graceLeft, 0) || OFFLINE_RECHECK_MS)
    }

    const suspect = () => {
      if (offlineSinceMs == null) offlineSinceMs = Date.now()
      schedule(OFFLINE_GRACE_MS)
    }
    const recheckNow = () => {
      if (navigatorOnline()) return backOnline()
      if (offlineSinceMs == null) return suspect()
      void check()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheckNow()
    }

    if (!navigatorOnline()) suspect()
    window.addEventListener('online', backOnline)
    window.addEventListener('offline', suspect)
    window.addEventListener('focus', recheckNow)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      clearTimer()
      window.removeEventListener('online', backOnline)
      window.removeEventListener('offline', suspect)
      window.removeEventListener('focus', recheckNow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return online
}

/**
 * Whether to treat the browser as online for the offline banner (UI only). The transitions are
 * `onlineStatusStep` in lib/onlineStatus.ts; this hook wires them to browser events, one timer and
 * `probeReachability`, and publishes the result for background checks (`setConfirmedOffline`).
 */
'use client'

import { useEffect, useState } from 'react'
import {
  INITIAL_ONLINE_STATUS,
  onlineStatusStep,
  probeReachability,
  registerOnlineStatusOwner,
  setConfirmedOffline,
  type OnlineStatusEvent,
} from '@/lib/onlineStatus'

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let disposed = false
    let state = INITIAL_ONLINE_STATUS
    let timer: number | null = null
    registerOnlineStatusOwner(true)

    const clearTimer = () => {
      if (timer != null) window.clearTimeout(timer)
      timer = null
    }

    const dispatch = (event: OnlineStatusEvent) => {
      if (disposed) return
      const next = onlineStatusStep(state, event)
      state = next.state
      setConfirmedOffline(state.showBanner)
      setOnline(!state.showBanner)
      if (next.effects.schedule !== 'keep') {
        clearTimer()
        if (next.effects.schedule != null) {
          timer = window.setTimeout(() => {
            timer = null
            dispatch({
              type: 'timer',
              navigatorOnline: navigatorOnline(),
              nowMs: Date.now(),
              hidden: document.visibilityState === 'hidden',
            })
          }, next.effects.schedule)
        }
      }
      if (next.effects.probe) {
        void probeReachability().then((probe) =>
          dispatch({ type: 'probeResult', probe, navigatorOnline: navigatorOnline(), nowMs: Date.now() })
        )
      }
    }

    const recheck = () => dispatch({ type: 'recheck', navigatorOnline: navigatorOnline(), nowMs: Date.now() })
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck()
    }

    recheck()
    window.addEventListener('online', recheck)
    window.addEventListener('offline', recheck)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      clearTimer()
      registerOnlineStatusOwner(false)
      window.removeEventListener('online', recheck)
      window.removeEventListener('offline', recheck)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return online
}

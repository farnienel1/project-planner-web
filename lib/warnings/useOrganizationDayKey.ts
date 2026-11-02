'use client'

import { useEffect, useState } from 'react'
import { dayKeyInOrganizationZone } from '@/lib/canonical'

const CHECK_EVERY_MS = 60_000

/**
 * Today's organisation day key, kept current while a tab stays open.
 * It moves on within a minute of midnight in the organisation zone, and is re-checked as soon as the window
 * regains focus or the tab becomes visible again (timers are throttled in background tabs). Screens put it in
 * their memo inputs so the warning window, counts and Daily Overview move to the new day without a reload.
 */
export function useOrganizationDayKey(timeZone: string): string {
  const [dayKey, setDayKey] = useState(() => dayKeyInOrganizationZone(new Date().toISOString(), timeZone))

  useEffect(() => {
    const check = () => {
      const next = dayKeyInOrganizationZone(new Date().toISOString(), timeZone)
      setDayKey((current) => (current === next ? current : next))
    }
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') check()
    }
    check()
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timeZone])

  return dayKey
}

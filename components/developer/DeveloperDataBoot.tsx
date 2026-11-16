'use client'

import { useEffect } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'
import { consoleEventsSince } from '@/lib/analytics/consolePeriod'

const TOKEN_REFRESH_MS = 50 * 60 * 1000

export function DeveloperDataBoot() {
  const load = useAnalyticsStore((state) => state.load)
  const loadBoard = useFeedbackStore((state) => state.loadBoard)
  const firebaseUser = useAuthStore((state) => state.firebaseUser)
  const period = useConsolePrefs((state) => state.period)

  useEffect(() => {
    void loadBoard(true)
  }, [loadBoard])

  // Owner console PR 1: events and sessions are loaded for the chosen period only (and again when it widens).
  useEffect(() => {
    void load(consoleEventsSince(period))
  }, [load, period])

  useEffect(() => {
    if (!firebaseUser || !isPlatformOwnerEmail(firebaseUser.email)) return
    void firebaseUser.getIdToken(true).catch(() => undefined)
    const timer = window.setInterval(() => {
      void firebaseUser.getIdToken(true).catch(() => undefined)
    }, TOKEN_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [firebaseUser])

  return null
}

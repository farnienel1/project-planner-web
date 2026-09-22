'use client'

import { useEffect } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'

const TOKEN_REFRESH_MS = 50 * 60 * 1000

export function DeveloperDataBoot() {
  const load = useAnalyticsStore((state) => state.load)
  const loadBoard = useFeedbackStore((state) => state.loadBoard)
  const firebaseUser = useAuthStore((state) => state.firebaseUser)

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

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

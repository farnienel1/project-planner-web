'use client'

import { useEffect } from 'react'
import { useAnalyticsStore } from '@/lib/analytics/analyticsStore'
import { useFeedbackStore } from '@/lib/feedback/feedbackStore'

export function DeveloperDataBoot() {
  const load = useAnalyticsStore((state) => state.load)
  const loadBoard = useFeedbackStore((state) => state.loadBoard)

  useEffect(() => {
    void load()
    void loadBoard(true)
  }, [load, loadBoard])

  return null
}

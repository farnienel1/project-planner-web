'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { endSession, startOrTouchSession, trackEvent } from '@/lib/analytics/trackEvent'
import { runWhenIdle } from '@/lib/analytics/runWhenIdle'
import type { ProductEventName } from '@/lib/analytics/events'

function eventForPath(pathname: string): ProductEventName | null {
  if (pathname === '/dashboard') return 'dashboard_viewed'
  if (pathname.includes('/health-safety')) return 'health_safety_viewed'
  if (pathname.includes('/materials')) return 'materials_viewed'
  if (pathname.includes('/schedule') || pathname.includes('/daily-overview') || pathname.includes('/my-schedule')) {
    return 'schedule_viewed'
  }
  if (pathname.includes('/timesheets')) return 'timesheet_viewed'
  if (pathname.includes('/weekly-report')) return 'report_viewed'
  if (/\/dashboard\/(projects|small-works)\/[^/]+$/.test(pathname)) return 'project_viewed'
  return null
}

export function ProductAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const userId = useAuthStore((s) => s.user?.id)
  const organizationId = useAuthStore((s) => s.organization?.id)
  const lastPath = useRef('')

  useEffect(() => {
    if (!userId) return
    return runWhenIdle(() => {
      void startOrTouchSession({ userId, organizationId, path: pathname })
    })
  }, [userId, organizationId, pathname])

  useEffect(() => {
    if (!userId) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    const eventName = eventForPath(pathname)
    if (!eventName) return
    return runWhenIdle(() => {
      void trackEvent(eventName, { userId, organizationId, metadata: { path: pathname } })
    })
  }, [pathname, userId, organizationId])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void endSession()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  return children
}

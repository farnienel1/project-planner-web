'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { endSession, startOrTouchSession, trackEvent } from '@/lib/analytics/trackEvent'
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
  const { user, organization } = useAuthStore()
  const lastPath = useRef('')

  useEffect(() => {
    if (!user) return
    void startOrTouchSession({
      userId: user.id,
      organizationId: organization?.id,
      path: pathname,
    })
  }, [user, organization?.id, pathname])

  useEffect(() => {
    if (!user) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    const eventName = eventForPath(pathname)
    if (!eventName) return
    void trackEvent(eventName, {
      userId: user.id,
      organizationId: organization?.id,
      metadata: { path: pathname },
    })
  }, [pathname, user, organization?.id])

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

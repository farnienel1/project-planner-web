'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { canOpenJobScheduling } from '@/lib/permissions'

/** Shown on a job's scheduling pages to someone who may not schedule (an operative opening the URL directly). */
export const JOB_SCHEDULING_NO_ACCESS_TITLE = "You can't open scheduling"
export const JOB_SCHEDULING_NO_ACCESS_MESSAGE = 'Scheduling is for admins and managers. Your own bookings are on My Schedule.'

/**
 * A job's scheduling pages (`/schedule`, `/schedule/operatives`, `/schedule/subcontractors`, projects and small works)
 * render their content only for someone who may schedule (`canOpenJobScheduling` → rulebook `canScheduleOperatives`).
 * An operative who opens the URL directly sees "no access" and nothing of the page loads.
 */
export function JobSchedulingGate({ jobHref, children }: { jobHref: string; children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)
  if (!user) return loading ? <LoadingSpinner /> : null
  if (!canOpenJobScheduling(user)) {
    return (
      <div className="card pad text-center">
        <h2 className="h2">{JOB_SCHEDULING_NO_ACCESS_TITLE}</h2>
        <p className="mt-2 text-(--ink3)">{JOB_SCHEDULING_NO_ACCESS_MESSAGE}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={jobHref} className="btn sm ghost">
            Back to job
          </Link>
          <Link href="/dashboard/my-schedule" className="btn sm primary">
            My Schedule
          </Link>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

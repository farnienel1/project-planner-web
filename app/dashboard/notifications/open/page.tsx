'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { jobIdQueryValues } from '@/lib/canonical'
import {
  NOTIFICATION_JOB_SECTIONS,
  jobSectionPath,
  type NotificationJobSection,
} from '@/lib/notifications/notificationHref'

/**
 * Rulebook 1.79.0 §13: a notice that names a job section (toolbox talk → Health & safety, a material line → Materials)
 * on a row that does not say which collection the job is in (rows written before 1.79.0). The job is read by id — a
 * read every member may make (§17) — in `projects`, then `smallWorks`, in each spelling of the id
 * (`jobIdQueryValues`), and the page moves to that job's section. An id that names no job (an older toolbox row carries
 * the talk's issue id) shows a short note and the job lists.
 */
export default function NotificationJobResolverPage() {
  return (
    <Suspense fallback={<p className="muted pad">Opening…</p>}>
      <NotificationJobResolver />
    </Suspense>
  )
}

function NotificationJobResolver() {
  const router = useRouter()
  const params = useSearchParams()
  const { organization } = useAuthStore()
  const jobId = (params.get('job') || '').trim()
  const rawSection = params.get('section') || ''
  const section: NotificationJobSection = (NOTIFICATION_JOB_SECTIONS as ReadonlyArray<string>).includes(rawSection)
    ? (rawSection as NotificationJobSection)
    : 'health-safety'
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const orgId = organization?.id
    if (!orgId || !db || !jobId) {
      if (!jobId) setMissing(true)
      return
    }
    const firestore = db
    let cancelled = false
    ;(async () => {
      for (const collection of ['projects', 'smallWorks'] as const) {
        for (const id of jobIdQueryValues([jobId])) {
          try {
            const snap = await getDoc(doc(firestore, 'organizations', orgId, collection, id))
            if (cancelled) return
            if (snap.exists()) {
              router.replace(jobSectionPath(collection, snap.id, section))
              return
            }
          } catch {
            // Not readable by this viewer: try the next place.
          }
        }
      }
      if (!cancelled) setMissing(true)
    })()
    return () => {
      cancelled = true
    }
  }, [organization?.id, jobId, section, router])

  if (!missing) return <p className="muted pad">Opening…</p>
  return (
    <div className="card pad">
      <h1>This notice&apos;s job could not be found</h1>
      <p className="muted">It may have been removed, or the notice is older than the job link. Open the job from its list.</p>
      <p>
        <Link href="/dashboard/projects">Projects</Link> · <Link href="/dashboard/small-works">Small works</Link> ·{' '}
        <Link href="/dashboard/notifications">Notifications</Link>
      </p>
    </div>
  )
}

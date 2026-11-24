'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { healthSafetyDocumentIds, healthSafetyIssueJob, jobIdQueryValues } from '@/lib/canonical'
import { healthSafetyDocPath } from '@/lib/healthSafety/healthSafetyPaths'
import { useProjectStore } from '@/lib/stores/projectStore'
import { urlDocumentId } from '@/lib/firebase/urlDocumentId'
import {
  NOTIFICATION_JOB_SECTIONS,
  jobSectionPath,
  type NotificationJobSection,
} from '@/lib/notifications/notificationHref'

/**
 * Rulebook 1.79.0 §13: a notice that names a job section (toolbox talk → Health & safety, a material line → Materials)
 * on a row that does not say which collection the job is in (rows written before 1.79.0). The job is read by id — a
 * read every member may make (§17) — in `projects`, then `smallWorks`, in each spelling of the id
 * (`jobIdQueryValues`), and the page moves to that job's section. Rulebook 1.82.0 (owner 24 Nov, item 4): an older
 * toolbox row carries the talk's issue id instead; for a Health & safety notice the page then reads the health &
 * safety documents of the jobs this viewer holds (single-document reads the team may make) and opens the job whose
 * documents hold that issue (`healthSafetyIssueJob`). Nothing is written. Otherwise a short note and the job lists.
 */
const ISSUE_LOOKUP_MAX_JOBS = 300
const ISSUE_LOOKUP_BATCH = 10
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
  // Taken from the URL: refused when empty, a path ("/") or over 200 characters (shows the not-found note).
  const jobId = urlDocumentId(params.get('job')) ?? ''
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
      if (section === 'health-safety') {
        const store = useProjectStore.getState()
        await Promise.allSettled([store.loadProjects(orgId), store.loadSmallWorks(orgId)])
        if (cancelled) return
        const { projects, smallWorks } = useProjectStore.getState()
        const jobs = [
          ...projects.map((job) => ({ jobId: job.id, collection: 'projects' as const })),
          ...smallWorks.map((job) => ({ jobId: job.id, collection: 'smallWorks' as const })),
        ].slice(0, ISSUE_LOOKUP_MAX_JOBS)
        const read = async (segments: string[]) => {
          try {
            const snap = await getDoc(doc(firestore, segments[0], ...segments.slice(1)))
            return snap.exists() ? (snap.data() as Record<string, unknown>) : null
          } catch {
            return null
          }
        }
        for (let at = 0; at < jobs.length; at += ISSUE_LOOKUP_BATCH) {
          const batch = jobs.slice(at, at + ISSUE_LOOKUP_BATCH)
          const candidates = await Promise.all(
            batch.map(async (job) => {
              const isSmallWorks = job.collection === 'smallWorks'
              const documents = await Promise.all([
                read(healthSafetyDocPath(orgId, job.jobId, isSmallWorks).segments),
                ...healthSafetyDocumentIds(job.jobId, isSmallWorks).map((id) => read(['organizations', orgId, 'settings', id])),
              ])
              return { ...job, documents }
            })
          )
          if (cancelled) return
          const found = healthSafetyIssueJob({ issueId: jobId, candidates })
          if (found) {
            router.replace(jobSectionPath(found.collection, found.jobId, section))
            return
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

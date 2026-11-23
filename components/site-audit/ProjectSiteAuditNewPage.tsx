'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import type { Project } from '@/types'
import { useSiteAuditJobContext } from '@/components/site-audit/useSiteAuditJobContext'
import {
  SITE_AUDIT_JOB_REFUSED_MESSAGE,
  SITE_AUDIT_JOBS_FAILED_MESSAGE,
  siteAuditJobAllowed,
  siteAuditJobPageGrant,
} from '@/lib/siteAudit/siteAuditCreateDraft'

/**
 * New site audit from a job's Site audits page, as its own page (owner request 23 Nov). The job is this one (step 1
 * shows as done); the steps and the save are the create flow's. Cancel and a saved audit return to the job's Site
 * audits. Who may create is the same test the job page uses for its New audit buttons; owner decision 23 Nov: only on
 * a job the person sees (rulebook §21 `visibleJobs`, `siteAuditJobAllowed`) — an operative opening another job's URL
 * is refused, as the job list never offers it.
 */
export function ProjectSiteAuditNewPage({ project, basePath }: { project: Project; basePath: string }) {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { loadAudits } = useSiteAuditStore()
  const canCreate = !isOperativeMode(user) || user?.permissions.siteAudit === true
  const back = () => router.push(`${basePath}/site-audit`)
  const jobContext = useSiteAuditJobContext()
  const allowed = siteAuditJobAllowed({
    job: project,
    viewer: jobContext.viewer,
    context: jobContext.context,
    contextLoaded: jobContext.contextLoaded,
    contextFailed: jobContext.contextFailed,
  })
  // Once allowed for this job, the form stays (a booking or task change mid-audit never unmounts it).
  const [grantedJobId, setGrantedJobId] = useState<string | null>(null)
  const grant = siteAuditJobPageGrant({ grantedJobId, jobId: project.id, allowed })
  // Kept during render (React's "adjust state when a prop changes" pattern), so the very next check already sees it.
  if (grant.grantedJobId !== grantedJobId) setGrantedJobId(grant.grantedJobId)

  if (!canCreate) {
    return <p className="py-8 text-center text-sm text-(--ink3)">You can&apos;t create site audits.</p>
  }
  if (grant.show === 'loading') return <p className="py-8 text-center text-sm text-(--ink3)">Loading…</p>
  if (grant.show === 'failed') {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-(--red)">{SITE_AUDIT_JOBS_FAILED_MESSAGE}</p>
        <button type="button" onClick={jobContext.retry} className="pu-btn sm mt-3">
          Retry
        </button>
      </div>
    )
  }
  if (grant.show === 'refused') return <p className="py-8 text-center text-sm text-(--ink3)">{SITE_AUDIT_JOB_REFUSED_MESSAGE}</p>
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h2 className="mb-3 text-lg font-bold text-(--ink)">New site audit</h2>
      <SiteAuditCreateFlow
        project={project}
        onClose={back}
        onCreated={() => {
          if (organization?.id) loadAudits(organization.id)
        }}
      />
    </div>
  )
}

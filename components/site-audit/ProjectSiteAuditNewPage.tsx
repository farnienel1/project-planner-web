'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import type { Project } from '@/types'

/**
 * New site audit from a job's Site audits page, as its own page (owner request 23 Nov). The job is this one (step 1
 * shows as done); the steps and the save are the create flow's. Cancel and a saved audit return to the job's Site
 * audits. Who may create is the same test the job page uses for its New audit buttons.
 */
export function ProjectSiteAuditNewPage({ project, basePath }: { project: Project; basePath: string }) {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { loadAudits } = useSiteAuditStore()
  const canCreate = !isOperativeMode(user) || user?.permissions.siteAudit === true
  const back = () => router.push(`${basePath}/site-audit`)

  if (!canCreate) {
    return <p className="py-8 text-center text-sm text-(--ink3)">You can&apos;t create site audits.</p>
  }
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

'use client'

import { SiteAuditAccess } from '@/components/site-audit/SiteAuditAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditSection } from '@/components/projects/features/ProjectSiteAuditSection'

export default function ProjectSiteAuditPage() {
  return (
    <SiteAuditAccess>
      <ProjectFeaturePageShell title="Site audits" backLabel="Back to project">
        {(project) => <ProjectSiteAuditSection project={project} />}
      </ProjectFeaturePageShell>
    </SiteAuditAccess>
  )
}

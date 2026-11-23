'use client'

import { SiteAuditAccess } from '@/components/site-audit/SiteAuditAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditNewPage } from '@/components/site-audit/ProjectSiteAuditNewPage'

export default function ProjectNewSiteAuditPage() {
  return (
    <SiteAuditAccess>
      <ProjectFeaturePageShell title="New site audit" backLabel="Back to project">
        {(project) => <ProjectSiteAuditNewPage project={project} basePath={`/dashboard/projects/${project.id}`} />}
      </ProjectFeaturePageShell>
    </SiteAuditAccess>
  )
}

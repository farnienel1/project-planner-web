'use client'

import { SiteAuditAccess } from '@/components/site-audit/SiteAuditAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditNewPage } from '@/components/site-audit/ProjectSiteAuditNewPage'

export default function SmallWorkNewSiteAuditPage() {
  return (
    <SiteAuditAccess>
      <ProjectFeaturePageShell title="New site audit" backLabel="Back to small work" collection="smallWorks">
        {(work) => <ProjectSiteAuditNewPage project={work} basePath={`/dashboard/small-works/${work.id}`} />}
      </ProjectFeaturePageShell>
    </SiteAuditAccess>
  )
}

'use client'

import { SiteAuditAccess } from '@/components/site-audit/SiteAuditAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditSection } from '@/components/projects/features/ProjectSiteAuditSection'

export default function SmallWorkSiteAuditPage() {
  return (
    <SiteAuditAccess>
      <ProjectFeaturePageShell title="Site audits" backLabel="Back to small work" collection="smallWorks">
        {(work) => <ProjectSiteAuditSection project={work} />}
      </ProjectFeaturePageShell>
    </SiteAuditAccess>
  )
}

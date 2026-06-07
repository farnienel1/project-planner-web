'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditSection } from '@/components/projects/features/ProjectSiteAuditSection'

export default function SmallWorkSiteAuditPage() {
  return (
    <ProjectFeaturePageShell title="Site audit" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectSiteAuditSection project={work} />}
    </ProjectFeaturePageShell>
  )
}

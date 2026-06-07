'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectSiteAuditSection } from '@/components/projects/features/ProjectSiteAuditSection'

export default function ProjectSiteAuditPage() {
  return (
    <ProjectFeaturePageShell title="Site audit" backLabel="Back to project">
      {(project) => <ProjectSiteAuditSection project={project} />}
    </ProjectFeaturePageShell>
  )
}

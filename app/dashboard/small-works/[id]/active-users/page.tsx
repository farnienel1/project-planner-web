'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectActiveUsersSection } from '@/components/projects/features/ProjectActiveUsersSection'

export default function SmallWorkActiveUsersPage() {
  return (
    <ProjectFeaturePageShell title="Active users" backLabel="Back to small work" collection="smallWorks">
      {(work) => (
        <ProjectActiveUsersSection project={work} basePath={`/dashboard/small-works/${work.id}`} />
      )}
    </ProjectFeaturePageShell>
  )
}

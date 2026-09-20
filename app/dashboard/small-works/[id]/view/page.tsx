'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectVisibilityPage } from '@/components/projects/ProjectVisibilityPage'

export default function SmallWorkViewPage() {
  return (
    <ProjectFeaturePageShell title="View" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectVisibilityPage project={work} collection="smallWorks" />}
    </ProjectFeaturePageShell>
  )
}

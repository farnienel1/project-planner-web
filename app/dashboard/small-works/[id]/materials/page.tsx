'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectMaterialsSection } from '@/components/projects/features/ProjectMaterialsSection'

export default function SmallWorkMaterialsPage() {
  return (
    <ProjectFeaturePageShell title="Materials" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectMaterialsSection project={work} />}
    </ProjectFeaturePageShell>
  )
}

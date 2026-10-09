'use client'

import { MaterialsAccess } from '@/components/projects/MaterialsAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectMaterialsSection } from '@/components/projects/features/ProjectMaterialsSection'

export default function SmallWorkMaterialsPage() {
  return (
    <MaterialsAccess>
      <ProjectFeaturePageShell title="Materials" backLabel="Back to small work" collection="smallWorks">
        {(work) => <ProjectMaterialsSection project={work} />}
      </ProjectFeaturePageShell>
    </MaterialsAccess>
  )
}

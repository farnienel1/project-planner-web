'use client'

import { MaterialsAccess } from '@/components/projects/MaterialsAccess'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectMaterialsSection } from '@/components/projects/features/ProjectMaterialsSection'

export default function ProjectMaterialsPage() {
  return (
    <MaterialsAccess>
      <ProjectFeaturePageShell title="Materials" backLabel="Back to project">
        {(project) => <ProjectMaterialsSection project={project} />}
      </ProjectFeaturePageShell>
    </MaterialsAccess>
  )
}

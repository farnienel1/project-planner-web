'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationAccess } from '@/components/variations/VariationAccess'
import { VariationsWorkspace } from '@/components/variations/VariationsWorkspace'

export default function ProjectVariationsPage() {
  return (
    <VariationAccess>
      <ProjectFeaturePageShell title="Variations" backLabel="Back to project">
        {(project) => <VariationsWorkspace project={project} parentType="project" />}
      </ProjectFeaturePageShell>
    </VariationAccess>
  )
}

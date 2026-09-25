'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationsWorkspace } from '@/components/variations/VariationsWorkspace'

export default function ProjectVariationsPage() {
  return (
    <ProjectFeaturePageShell title="Variations" backLabel="Back to project">
      {(project) => <VariationsWorkspace project={project} parentType="project" />}
    </ProjectFeaturePageShell>
  )
}

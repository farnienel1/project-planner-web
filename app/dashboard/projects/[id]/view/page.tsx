'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectVisibilityPage } from '@/components/projects/ProjectVisibilityPage'

export default function ProjectViewPage() {
  return (
    <ProjectFeaturePageShell title="View" backLabel="Back to project">
      {(project) => <ProjectVisibilityPage project={project} collection="projects" />}
    </ProjectFeaturePageShell>
  )
}

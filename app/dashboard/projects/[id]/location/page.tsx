'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectLocationPage } from '@/components/projects/ProjectLocationPage'

export default function ProjectLocationPageRoute() {
  return (
    <ProjectFeaturePageShell title="Location" backLabel="Back to project">
      {(project) => <ProjectLocationPage project={project} collection="projects" />}
    </ProjectFeaturePageShell>
  )
}

'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectTasksSection } from '@/components/projects/features/ProjectFeaturePages'

export default function ProjectTasksPage() {
  return (
    <ProjectFeaturePageShell title="Tasks" backLabel="Back to project">
      {(project) => <ProjectTasksSection project={project} />}
    </ProjectFeaturePageShell>
  )
}

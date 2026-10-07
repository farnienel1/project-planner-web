'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectActiveUsersSection } from '@/components/projects/features/ProjectActiveUsersSection'

export default function ProjectActiveUsersPage() {
  return (
    <ProjectFeaturePageShell title="Active users" backLabel="Back to project">
      {(project) => (
        <ProjectActiveUsersSection project={project} basePath={`/dashboard/projects/${project.id}`} />
      )}
    </ProjectFeaturePageShell>
  )
}

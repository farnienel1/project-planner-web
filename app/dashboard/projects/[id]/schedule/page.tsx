'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'

export default function ProjectSchedulePage() {
  return (
    <ProjectFeaturePageShell title="Scheduling" backLabel="Back to project">
      {(project) => (
        <ProjectScheduleSection
          project={project}
          scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
        />
      )}
    </ProjectFeaturePageShell>
  )
}

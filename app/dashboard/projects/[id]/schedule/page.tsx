'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'
import { JobSchedulingGate } from '@/components/projects/scheduling/JobSchedulingGate'

export default function ProjectSchedulePage() {
  return (
    <ProjectFeaturePageShell title="Scheduling" backLabel="Back to project">
      {(project) => (
        <JobSchedulingGate jobHref={`/dashboard/projects/${project.id}`}>
          <ProjectScheduleSection
            project={project}
            scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
          />
        </JobSchedulingGate>
      )}
    </ProjectFeaturePageShell>
  )
}

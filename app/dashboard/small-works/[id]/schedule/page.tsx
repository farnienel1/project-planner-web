'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'
import { JobSchedulingGate } from '@/components/projects/scheduling/JobSchedulingGate'

export default function SmallWorkSchedulePage() {
  return (
    <ProjectFeaturePageShell title="Scheduling" backLabel="Back to small work" collection="smallWorks">
      {(work) => (
        <JobSchedulingGate jobHref={`/dashboard/small-works/${work.id}`}>
          <ProjectScheduleSection
            project={work}
            scheduleBasePath={`/dashboard/small-works/${work.id}/schedule`}
          />
        </JobSchedulingGate>
      )}
    </ProjectFeaturePageShell>
  )
}

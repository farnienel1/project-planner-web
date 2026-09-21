'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'

export default function SmallWorkSchedulePage() {
  return (
    <ProjectFeaturePageShell title="Scheduling" backLabel="Back to small work" collection="smallWorks">
      {(work) => (
        <ProjectScheduleSection
          project={work}
          scheduleBasePath={`/dashboard/small-works/${work.id}/schedule`}
        />
      )}
    </ProjectFeaturePageShell>
  )
}

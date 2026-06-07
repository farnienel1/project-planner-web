'use client'

import { useAuthStore } from '@/lib/stores/authStore'
import { ProjectScheduleWeekOverview } from '@/components/projects/scheduling/ProjectScheduleWeekOverview'
import type { Project } from '@/types'

export function ProjectScheduleSection({
  project,
  scheduleBasePath,
}: {
  project: Project
  scheduleBasePath: string
}) {
  const { organization } = useAuthStore()

  if (!organization?.id) return null

  return (
    <ProjectScheduleWeekOverview
      project={project}
      organizationId={organization.id}
      scheduleBasePath={scheduleBasePath}
    />
  )
}

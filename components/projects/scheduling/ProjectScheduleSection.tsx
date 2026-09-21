'use client'

import { useAuthStore } from '@/lib/stores/authStore'
import { ProjectScheduleWeekOverview } from '@/components/projects/scheduling/ProjectScheduleWeekOverview'
import type { Project } from '@/types'

export function ProjectScheduleSection({
  project,
  scheduleBasePath,
  variant = 'full',
}: {
  project: Project
  scheduleBasePath: string
  variant?: 'full' | 'hub'
}) {
  const { organization } = useAuthStore()

  if (!organization?.id) return null

  return (
    <ProjectScheduleWeekOverview
      project={project}
      organizationId={organization.id}
      scheduleBasePath={scheduleBasePath}
      variant={variant}
    />
  )
}

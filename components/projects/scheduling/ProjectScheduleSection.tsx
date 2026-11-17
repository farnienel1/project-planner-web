'use client'

import { useAuthStore } from '@/lib/stores/authStore'
import { canOpenJobScheduling } from '@/lib/permissions'
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
  const { organization, user } = useAuthStore()

  // Rulebook §2 `canScheduleOperatives`: a job's scheduling grid (with Quick add and the booking sheets) is never shown
  // to an operative, wherever it is embedded.
  if (!organization?.id || !canOpenJobScheduling(user)) return null

  return (
    <ProjectScheduleWeekOverview
      project={project}
      organizationId={organization.id}
      scheduleBasePath={scheduleBasePath}
      variant={variant}
    />
  )
}

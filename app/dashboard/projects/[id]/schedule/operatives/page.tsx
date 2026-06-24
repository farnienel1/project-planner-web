'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ScheduleOperativeForm } from '@/components/projects/scheduling/ScheduleOperativeForm'

export default function ProjectScheduleOperativesPage() {
  return (
    <ProjectRecordPageShell>
      {(project) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/projects/${project.id}/schedule`} label="Back to scheduling" />
          <PageHeader title="Schedule booking" description="Pick dates first, then add operatives or managers" />
          <ScheduleOperativeForm
            project={project}
            scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
          />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

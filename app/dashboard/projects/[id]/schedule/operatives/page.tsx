'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { JobSchedulingGate } from '@/components/projects/scheduling/JobSchedulingGate'
import { ScheduleOperativeForm } from '@/components/projects/scheduling/ScheduleOperativeForm'

export default function ProjectScheduleOperativesPage() {
  return (
    <ProjectRecordPageShell>
      {(project) => (
        <JobSchedulingGate jobHref={`/dashboard/projects/${project.id}`}>
          <div className="space-y-6">
            <FormBackLink href={`/dashboard/projects/${project.id}/schedule`} label="Back to scheduling" />
            <PageHeader title="Schedule booking" description="Pick dates first, then add operatives or managers" />
            <ScheduleOperativeForm
              project={project}
              scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
            />
          </div>
        </JobSchedulingGate>
      )}
    </ProjectRecordPageShell>
  )
}

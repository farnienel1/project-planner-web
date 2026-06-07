'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ScheduleSubcontractorForm } from '@/components/projects/scheduling/ScheduleSubcontractorForm'

export default function ProjectScheduleSubcontractorsPage() {
  return (
    <ProjectRecordPageShell>
      {(project) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/projects/${project.id}/schedule`} label="Back to scheduling" />
          <PageHeader title="Schedule sub contractor" description={project.siteName} />
          <ScheduleSubcontractorForm
            project={project}
            scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
          />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

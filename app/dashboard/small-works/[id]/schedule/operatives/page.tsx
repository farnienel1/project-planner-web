'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ScheduleOperativeForm } from '@/components/projects/scheduling/ScheduleOperativeForm'

export default function SmallWorkScheduleOperativesPage() {
  return (
    <ProjectRecordPageShell collection="smallWorks">
      {(work) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/small-works/${work.id}/schedule`} label="Back to scheduling" />
          <PageHeader title="Schedule booking" description="Pick dates first, then add operatives or managers" />
          <ScheduleOperativeForm
            project={work}
            scheduleBasePath={`/dashboard/small-works/${work.id}/schedule`}
            managerLocationType="small_work"
          />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

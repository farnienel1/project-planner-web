'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ScheduleSubcontractorForm } from '@/components/projects/scheduling/ScheduleSubcontractorForm'

export default function SmallWorkScheduleSubcontractorsPage() {
  return (
    <ProjectRecordPageShell collection="smallWorks">
      {(work) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/small-works/${work.id}/schedule`} label="Back to scheduling" />
          <PageHeader title="Schedule sub contractor" description={work.siteName} />
          <ScheduleSubcontractorForm
            project={work}
            scheduleBasePath={`/dashboard/small-works/${work.id}/schedule`}
          />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

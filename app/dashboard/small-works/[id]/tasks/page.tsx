'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectTasksSection } from '@/components/projects/features/ProjectFeaturePages'

export default function SmallWorkTasksPage() {
  return (
    <ProjectRecordPageShell collection="smallWorks">
      {(work) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/small-works/${work.id}`} label="Back to small work" />
          <PageHeader title="Tasks" description={`${work.siteName} task board`} />
          <ProjectTasksSection project={work} />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

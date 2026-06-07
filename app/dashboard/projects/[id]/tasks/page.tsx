'use client'

import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectTasksSection } from '@/components/projects/features/ProjectFeaturePages'

export default function ProjectTasksPage() {
  return (
    <ProjectRecordPageShell>
      {(project) => (
        <div className="space-y-6">
          <FormBackLink href={`/dashboard/projects/${project.id}`} label="Back to project" />
          <PageHeader title="Tasks" description={`${project.siteName} task board`} />
          <ProjectTasksSection project={project} />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

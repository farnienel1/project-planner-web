'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectTasksSection } from '@/components/projects/features/ProjectFeaturePages'

export default function SmallWorkTasksPage() {
  return (
    <ProjectFeaturePageShell title="Tasks" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectTasksSection project={work} />}
    </ProjectFeaturePageShell>
  )
}

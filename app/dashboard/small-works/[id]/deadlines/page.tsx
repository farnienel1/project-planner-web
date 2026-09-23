'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectDeadlinesSection } from '@/components/projects/features/ProjectDeadlinesSection'

export default function SmallWorkDeadlinesPage() {
  return (
    <ProjectFeaturePageShell title="Deadlines" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectDeadlinesSection project={work} isSmallWorks />}
    </ProjectFeaturePageShell>
  )
}

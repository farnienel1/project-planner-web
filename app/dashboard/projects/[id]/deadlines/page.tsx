'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectDeadlinesSection } from '@/components/projects/features/ProjectDeadlinesSection'

export default function ProjectDeadlinesPage() {
  return (
    <ProjectFeaturePageShell title="Deadlines" backLabel="Back to project">
      {(project) => <ProjectDeadlinesSection project={project} isSmallWorks={false} />}
    </ProjectFeaturePageShell>
  )
}

'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectHealthSafetySection } from '@/components/projects/features/ProjectHealthSafetySection'

export default function ProjectHealthSafetyPage() {
  return (
    <ProjectFeaturePageShell title="Health & Safety" backLabel="Back to project">
      {(project) => <ProjectHealthSafetySection project={project} isSmallWorks={false} />}
    </ProjectFeaturePageShell>
  )
}

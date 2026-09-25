'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationTrackerScreen } from '@/components/variations/VariationTrackerScreen'

export default function ProjectVariationTrackerPage() {
  return (
    <ProjectFeaturePageShell title="Variation tracker" backLabel="Back to project">
      {(project) => <VariationTrackerScreen project={project} parentType="project" />}
    </ProjectFeaturePageShell>
  )
}

'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationTrackerScreen } from '@/components/variations/VariationTrackerScreen'

export default function SmallWorkVariationTrackerPage() {
  return (
    <ProjectFeaturePageShell title="Variation tracker" backLabel="Back to small work" collection="smallWorks">
      {(work) => <VariationTrackerScreen project={work} parentType="smallWork" />}
    </ProjectFeaturePageShell>
  )
}

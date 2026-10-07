'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationAccess } from '@/components/variations/VariationAccess'
import { VariationTrackerScreen } from '@/components/variations/VariationTrackerScreen'

export default function SmallWorkVariationTrackerPage() {
  return (
    <VariationAccess>
      <ProjectFeaturePageShell title="Variation tracker" backLabel="Back to small work" collection="smallWorks">
        {(work) => <VariationTrackerScreen project={work} parentType="smallWork" />}
      </ProjectFeaturePageShell>
    </VariationAccess>
  )
}

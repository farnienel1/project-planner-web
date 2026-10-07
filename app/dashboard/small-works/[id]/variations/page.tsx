'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationAccess } from '@/components/variations/VariationAccess'
import { VariationsWorkspace } from '@/components/variations/VariationsWorkspace'

export default function SmallWorkVariationsPage() {
  return (
    <VariationAccess>
      <ProjectFeaturePageShell title="Variations" backLabel="Back to small work" collection="smallWorks">
        {(work) => <VariationsWorkspace project={work} parentType="smallWork" />}
      </ProjectFeaturePageShell>
    </VariationAccess>
  )
}

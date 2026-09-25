'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { VariationsWorkspace } from '@/components/variations/VariationsWorkspace'

export default function SmallWorkVariationsPage() {
  return (
    <ProjectFeaturePageShell title="Variations" backLabel="Back to small work" collection="smallWorks">
      {(work) => <VariationsWorkspace project={work} parentType="smallWork" />}
    </ProjectFeaturePageShell>
  )
}

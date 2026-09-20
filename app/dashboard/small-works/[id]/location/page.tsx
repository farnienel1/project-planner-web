'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectLocationPage } from '@/components/projects/ProjectLocationPage'

export default function SmallWorkLocationPageRoute() {
  return (
    <ProjectFeaturePageShell title="Location" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectLocationPage project={work} collection="smallWorks" />}
    </ProjectFeaturePageShell>
  )
}

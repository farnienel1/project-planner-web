'use client'

import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'
import { ProjectHealthSafetySection } from '@/components/projects/features/ProjectHealthSafetySection'

export default function SmallWorkHealthSafetyPage() {
  return (
    <ProjectFeaturePageShell title="H&S" backLabel="Back to small work" collection="smallWorks">
      {(work) => <ProjectHealthSafetySection project={work} isSmallWorks={true} />}
    </ProjectFeaturePageShell>
  )
}

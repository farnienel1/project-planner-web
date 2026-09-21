'use client'

import { useParams } from 'next/navigation'
import { FeaturesPage } from '@/components/marketing/FeaturesPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { MODULES, type MarketingModuleId } from '@/lib/marketing/content'
import { NotFoundPage } from '@/components/marketing/NotFoundPage'

export default function FeatureModuleRoute() {
  const params = useParams()
  const moduleParam = typeof params.module === 'string' ? params.module : ''
  const moduleId = MODULES.find((mod) => mod.id === moduleParam)?.id as MarketingModuleId | undefined
  if (!moduleId) {
    return (
      <MarketingShell>
        <NotFoundPage />
      </MarketingShell>
    )
  }
  return (
    <MarketingShell>
      <FeaturesPage moduleId={moduleId} />
    </MarketingShell>
  )
}

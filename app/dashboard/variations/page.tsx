'use client'

import { VariationAccess } from '@/components/variations/VariationAccess'
import { VariationsRollup } from '@/components/variations/VariationsRollup'

export default function VariationsPage() {
  return (
    <VariationAccess>
      <VariationsRollup />
    </VariationAccess>
  )
}

'use client'

import { useParams } from 'next/navigation'
import { DeveloperOrganisationDetailScreen } from '@/components/developer/DeveloperOrganisationDetail'

export default function DeveloperOrganisationDetailPage() {
  const params = useParams()
  return <DeveloperOrganisationDetailScreen organisationId={decodeURIComponent(String(params.id || ''))} />
}

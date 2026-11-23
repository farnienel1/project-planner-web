'use client'

import { useParams } from 'next/navigation'
import { DeveloperPersonScreen } from '@/components/developer/DeveloperPerson'

export default function DeveloperPersonPage() {
  const params = useParams()
  return <DeveloperPersonScreen uid={decodeURIComponent(String(params.uid || ''))} />
}

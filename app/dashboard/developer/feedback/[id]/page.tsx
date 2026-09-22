'use client'

import { useParams } from 'next/navigation'
import { DeveloperFeedbackDetailScreen } from '@/components/developer/DeveloperFeedbackDetail'

export default function DeveloperFeedbackDetailPage() {
  const params = useParams()
  return <DeveloperFeedbackDetailScreen ideaId={String(params.id || '')} />
}

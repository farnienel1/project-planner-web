'use client'

import { useParams } from 'next/navigation'
import { FeedbackDetailScreen } from '@/components/feedback/FeedbackDetailScreen'

export default function IdeaDetailPage() {
  const params = useParams()
  return <FeedbackDetailScreen ideaId={String(params.id || '')} />
}

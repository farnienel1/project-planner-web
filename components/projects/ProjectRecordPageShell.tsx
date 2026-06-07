'use client'

import { useParams } from 'next/navigation'
import { useLoadedProjectRecord } from '@/lib/hooks/useLoadedProjectRecord'
import { ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

export function ProjectRecordPageShell({
  collection = 'projects',
  children,
}: {
  collection?: 'projects' | 'smallWorks'
  children: (record: Project) => React.ReactNode
}) {
  const params = useParams()
  const { record, loading, error } = useLoadedProjectRecord(params.id, collection)

  if (loading) return <LoadingSpinner />
  if (error || !record) return <ErrorBanner message={error || 'Record not found.'} />

  return <>{children(record)}</>
}

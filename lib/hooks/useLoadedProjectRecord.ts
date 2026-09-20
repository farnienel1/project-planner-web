/**
 * iOS parity source: Views/ProjectDetailView.swift project load for job tiles
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import type { Project } from '@/types'

export function useLoadedProjectRecord(
  recordId: string | string[] | undefined,
  collection: 'projects' | 'smallWorks' = 'projects'
) {
  const { organization, loading: authLoading } = useAuthStore()
  const { getProject } = useProjectStore()
  const [record, setRecord] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const id = Array.isArray(recordId) ? recordId[0] : recordId

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }
    if (!id) {
      setRecord(null)
      setError('Record not found.')
      setLoading(false)
      return
    }
    if (!organization?.id) {
      setRecord(null)
      setError('Record not found.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getProject(organization.id, String(id), collection)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setError('Record not found.')
          setRecord(null)
        } else {
          setRecord(result)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load record.')
        setRecord(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, organization?.id, id, collection, getProject])

  return { record, loading, error, organization }
}

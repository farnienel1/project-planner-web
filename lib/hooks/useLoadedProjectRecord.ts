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
  const { getProject, projects, smallWorks } = useProjectStore()
  const id = Array.isArray(recordId) ? recordId[0] : recordId
  const needle = String(id || '').trim().toLowerCase()
  const stored =
    (collection === 'smallWorks' ? smallWorks : projects).find((row) => row.id.toLowerCase() === needle) ||
    [...projects, ...smallWorks].find((row) => row.id.toLowerCase() === needle) ||
    null
  const [record, setRecord] = useState<Project | null>(stored)
  const [loading, setLoading] = useState(!stored)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (stored) {
      setRecord(stored)
      setLoading(false)
      setError(null)
    }
  }, [stored?.id, stored?.updatedAt])

  useEffect(() => {
    if (authLoading) {
      if (!stored) setLoading(true)
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
    if (!stored) {
      setLoading(true)
      setError(null)
    }

    getProject(organization.id, String(id), collection)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          if (!stored) {
            setError('Record not found.')
            setRecord(null)
          }
        } else {
          setRecord(result)
          setError(null)
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

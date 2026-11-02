'use client'

/**
 * Settings panels read the live `organizations/{orgId}` listener (`useOrganizationDocument`), not a
 * one-off `getDoc`. Each panel keeps its own unsaved draft; `useApplyLiveWhenClean` replaces that
 * draft from the live document only while it has no unsaved edits. Nothing is written until Save.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { organizationDetailsFromData, type OrganizationDetails } from '@/lib/settings/organizationSettings'

export type LiveOrganizationStatus = 'loading' | 'ready' | 'failed'

export function useLiveOrganizationDetails(): {
  organizationId: string
  data: Record<string, unknown> | null
  details: OrganizationDetails | null
  status: LiveOrganizationStatus
} {
  const { organizationId, data, loaded, error } = useOrganizationDocument()
  const details = useMemo(
    () => (organizationId && data ? organizationDetailsFromData(organizationId, data as Record<string, unknown>) : null),
    [organizationId, data]
  )
  const status: LiveOrganizationStatus = !loaded ? 'loading' : error || !data ? 'failed' : 'ready'
  return { organizationId, data: (data as Record<string, unknown> | null) ?? null, details, status }
}

/**
 * Push `source` (the saved values, from the live document) into the panel's draft while the draft
 * is clean. A change that arrives while the user is editing is applied once the draft is clean again
 * (after Save, or after the edits are undone).
 */
export function useApplyLiveWhenClean<T>(input: {
  source: T | null
  status: LiveOrganizationStatus
  dirty: boolean
  apply: (next: T) => void
  onFailed: () => void
}): void {
  const { source, status, dirty, apply, onFailed } = input
  const lastApplied = useRef<string | null>(null)
  const applyRef = useRef(apply)
  const failedRef = useRef(onFailed)
  useEffect(() => {
    applyRef.current = apply
    failedRef.current = onFailed
  })

  useEffect(() => {
    if (status === 'failed') {
      if (lastApplied.current == null) failedRef.current()
      return
    }
    if (status !== 'ready' || source == null || dirty) return
    const key = JSON.stringify(source)
    if (key === lastApplied.current) return
    lastApplied.current = key
    applyRef.current(source)
  }, [source, status, dirty])
}

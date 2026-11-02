'use client'

/**
 * Live `organizations/{orgId}` document for the open company.
 *
 * Every settings panel and every money display reads this store, so a save on iOS or in another
 * browser tab appears without a reload. Panels keep their own unsaved draft and only replace it from
 * this store while the draft is clean.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { doc, onSnapshot, type DocumentData, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { organizationTimeZone, resolveOrganizationCurrency } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'

type OrganizationDocumentState = {
  organizationId: string
  data: DocumentData | null
  loaded: boolean
  error: string | null
}

export const useOrganizationDocumentStore = create<OrganizationDocumentState>(() => ({
  organizationId: '',
  data: null,
  loaded: false,
  error: null,
}))

let unsubscribe: Unsubscribe | null = null
let listeningTo = ''
let listeners = 0

function startListening(organizationId: string) {
  if (listeningTo === organizationId && unsubscribe) return
  unsubscribe?.()
  unsubscribe = null
  listeningTo = organizationId
  useOrganizationDocumentStore.setState({ organizationId, data: null, loaded: false, error: null })
  if (!organizationId) return
  unsubscribe = onSnapshot(
    doc(getFirebaseDb(), 'organizations', organizationId),
    (snap) => {
      if (listeningTo !== organizationId) return
      useOrganizationDocumentStore.setState({
        organizationId,
        data: snap.exists() ? snap.data() : null,
        loaded: true,
        error: null,
      })
    },
    (error) => {
      if (listeningTo !== organizationId) return
      useOrganizationDocumentStore.setState({ loaded: true, error: error.message })
    }
  )
}

function stopListening() {
  unsubscribe?.()
  unsubscribe = null
  listeningTo = ''
}

/** Subscribe while mounted. Several components share one listener. */
export function useOrganizationDocument(): OrganizationDocumentState {
  const organizationId = useAuthStore((state) => state.organization?.id || '')
  useEffect(() => {
    listeners += 1
    startListening(organizationId)
    return () => {
      listeners -= 1
      if (listeners <= 0) {
        listeners = 0
        stopListening()
      }
    }
  }, [organizationId])
  const state = useOrganizationDocumentStore()
  if (state.organizationId !== organizationId) {
    return { organizationId, data: null, loaded: false, error: null }
  }
  return state
}

/** The organisation currency code (live). */
export function useOrganizationCurrency(): string {
  const { data } = useOrganizationDocument()
  return resolveOrganizationCurrency(data)
}

/** The organisation business time zone (live). */
export function useOrganizationTimeZone(): string {
  const { data } = useOrganizationDocument()
  const country = data && typeof data.countryCode === 'string' ? data.countryCode : null
  return organizationTimeZone(country)
}

/** Non-hook read for code outside React (exports, PDFs). Falls back to the country default. */
export function currentOrganizationCurrency(): string {
  return resolveOrganizationCurrency(useOrganizationDocumentStore.getState().data)
}

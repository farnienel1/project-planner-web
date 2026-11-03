'use client'

import { create } from 'zustand'
import { doc, setDoc } from 'firebase/firestore'
import { deleteBookingWithTombstone } from '@/lib/bookings/bookingTombstoneWrite'
import { auth, db } from '@/lib/firebase/config'
import { MissingDocumentError, savePartialDocument } from '@/lib/firebase/partialWrite'
import { BOOKING_REPLAY_REFUSED_MESSAGE, writeMetadataFields } from '@/lib/canonical'
import { managerSiteBookingUpdateWriteFields } from '@/lib/canonical/workDocumentReaders'
import { forgetOrgCollectionDoc, isOrgCollectionSubscribed, subscribeOrgCollection, unsubscribeOrgCollection, type OrgCollectionDoc } from '@/lib/firebase/subscribeOrgCollection'
import { forgetOrgPlanDoc, subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { bookingPlanInputs, bookingPlanParts, webJobAccessViewer } from '@/lib/access/readPlan'
import { useAuthStore } from '@/lib/stores/authStore'
import { organizationIdsMatch } from '@/lib/orgMembership/webActiveOrg'
import { retainParsedRows } from '@/lib/staff/rosterRetain'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import { londonMidnight } from '@/lib/ios-parity/londonTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import {
  logSkippedDocument,
  parseManagerSiteBooking,
  serializeManagerSiteBooking,
} from '@/lib/ios-parity/converters'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  bookingDownloadConstraints,
  bookingDownloadQueryId,
  launchBookingNeededDayKeys,
  nextBookingDownload,
  type BookingDownload,
  type BookingDownloadRequest,
} from '@/lib/firebase/bookingDownloadBound'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'

let managerDownloadOrgId = ''
let managerDownload: BookingDownload = { loadedFromDayKey: null, fullHistory: false }

/**
 * Rulebook 1.10.0 §17: a viewer who may not read every booking runs `bookingQueryPlan` — one query per visible job
 * (`locationId in` every spelling of its id) and their own manager site bookings, each with the download bound;
 * everyone else keeps the whole-collection listener.
 */
function subscribeBookingsFor(
  key: string,
  organizationId: string,
  collectionName: 'managerSiteBookings',
  onDocs: (docs: OrgCollectionDoc[]) => void,
  onError: (error: { message: string }) => void,
  options: { queryId: string; constraints: ReturnType<typeof bookingDownloadConstraints> }
): void {
  const inputs = bookingPlanInputs()
  const parts = bookingPlanParts(
    webJobAccessViewer(useAuthStore.getState().user),
    collectionName,
    inputs.visibleJobIds,
    inputs.ownBookingIds,
    options.constraints,
    options.queryId
  )
  if (parts === null) {
    unsubscribeOrgPlan(key)
    subscribeOrgCollection(key, organizationId, collectionName, onDocs, onError, options)
    return
  }
  unsubscribeOrgCollection(key)
  void subscribeOrgPlan(key, organizationId, collectionName, parts, onDocs, onError)
}

function organizationDataFor(organizationId: string): Record<string, unknown> | null {
  const state = useOrganizationDocumentStore.getState()
  return state.organizationId === organizationId ? ((state.data as Record<string, unknown> | null) ?? null) : null
}

function requireDb() {
  if (!db) throw new Error('Firebase is not configured')
  return db
}

export type SaveManagerSiteBookingInput = {
  userId: string
  date: Date
  timeSlot: string
  locationType: ManagerLocationType
  locationId?: string
  customLocationName?: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
}

interface ManagerScheduleState {
  managerSiteBookings: ManagerSiteBooking[]
  loading: boolean
  error: string | null
  /** Same listener bound as bookings (canonical `bookingLoadStart`); see `useBookingStore.loadBookings`. */
  loadManagerSiteBookings: (
    organizationId: string,
    options?: BookingDownloadRequest & { force?: boolean }
  ) => Promise<void>
  saveManagerSiteBooking: (organizationId: string, booking: SaveManagerSiteBookingInput) => Promise<void>
  updateManagerSiteBooking: (
    organizationId: string,
    bookingId: string,
    updates: Partial<SaveManagerSiteBookingInput>
  ) => Promise<void>
  deleteManagerSiteBooking: (organizationId: string, bookingId: string) => Promise<void>
}

export const useManagerScheduleStore = create<ManagerScheduleState>((set, get) => ({
  managerSiteBookings: [],
  loading: false,
  error: null,

  loadManagerSiteBookings: async (organizationId, options) => {
    if (!organizationId || !db) return
    if (managerDownloadOrgId !== organizationId) {
      managerDownloadOrgId = organizationId
      managerDownload = { loadedFromDayKey: null, fullHistory: false }
    }
    const next = nextBookingDownload(
      managerDownload,
      launchBookingNeededDayKeys(new Date(), organizationDataFor(organizationId)),
      options
    )
    managerDownload = { loadedFromDayKey: next.loadedFromDayKey, fullHistory: next.fullHistory }
    const queryId = bookingDownloadQueryId(managerDownload)
    const current = get().managerSiteBookings
    const foreign =
      current.length > 0 &&
      current.every((row) => row.organizationId && !organizationIdsMatch(row.organizationId, organizationId))
    const already = isOrgCollectionSubscribed('managerSiteBookings', organizationId, queryId)
    if (foreign) set({ managerSiteBookings: [], loading: true, error: null })
    else if (already || current.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    subscribeBookingsFor(
      'managerSiteBookings',
      organizationId,
      'managerSiteBookings',
      (docs) => {
        const managerSiteBookings: ManagerSiteBooking[] = []
        for (const entry of docs) {
          const parsed = parseManagerSiteBooking(entry.id, entry.data, organizationId)
          if (parsed.ok) managerSiteBookings.push(parsed.value)
          else logSkippedDocument('managerSiteBookings', entry.id, parsed.errors)
        }
        const previous = get().managerSiteBookings.filter(
          (row) => !row.organizationId || organizationIdsMatch(row.organizationId, organizationId)
        )
        set({
          managerSiteBookings: retainParsedRows(docs.length, previous, managerSiteBookings),
          loading: false,
        })
      },
      (error) => set({ error: error.message, loading: false }),
      { queryId, constraints: bookingDownloadConstraints(managerDownload) }
    )
  },

  saveManagerSiteBooking: async (organizationId: string, booking: SaveManagerSiteBookingInput) => {
    const firestore = requireDb()
    if (!organizationId.trim()) throw new Error('Missing organisation for booking')
    const id = newUppercaseUuid()
    const now = new Date()
    const next: ManagerSiteBooking = {
      id,
      userId: booking.userId,
      date: londonMidnight(booking.date, organizationZoneOr()),
      timeSlot: booking.timeSlot,
      locationType: booking.locationType,
      locationId: booking.locationId,
      customLocationName: booking.customLocationName,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
      isBreakRemoved: booking.isBreakRemoved === true,
      createdAt: now,
      updatedAt: now,
      organizationId,
    }
    const payload = serializeManagerSiteBooking({ ...next, organizationId })
    // Rulebook §1 / 1.9.0: a create carries write metadata (`writeMetadataFields`).
    await setDoc(
      doc(firestore, 'organizations', organizationId, 'managerSiteBookings', id),
      { ...payload, ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}) },
      { merge: true }
    )
    const without = get().managerSiteBookings.filter((row) => row.id !== next.id)
    set({ managerSiteBookings: [...without, next] })
  },

  updateManagerSiteBooking: async (organizationId, bookingId, updates) => {
    const firestore = requireDb()
    const existing = get().managerSiteBookings.find((row) => row.id === bookingId)
    if (!existing) throw new Error('Booking not found')
    const next: ManagerSiteBooking = {
      ...existing,
      ...updates,
      id: bookingId,
      date: londonMidnight(updates.date || existing.date, organizationZoneOr()),
      updatedAt: new Date(),
      organizationId,
    }
    const payload = serializeManagerSiteBooking({ ...next, organizationId })
    // Rulebook 1.9.0 `managerSiteBookingUpdateWriteFields`: only the changed fields, with write metadata; an edit of
    // a booking deleted on another device is refused, never re-created.
    try {
      await savePartialDocument(
        doc(firestore, 'organizations', organizationId, 'managerSiteBookings', bookingId),
        payload,
        managerSiteBookingUpdateWriteFields,
        { userId: auth?.currentUser?.uid ?? null, missing: 'refuse' }
      )
    } catch (error: unknown) {
      if (error instanceof MissingDocumentError) {
        set({ managerSiteBookings: get().managerSiteBookings.filter((row) => row.id !== bookingId) })
        throw new Error(BOOKING_REPLAY_REFUSED_MESSAGE)
      }
      throw error
    }
    set({
      managerSiteBookings: get().managerSiteBookings.map((row) => (row.id === bookingId ? next : row)),
    })
  },

  deleteManagerSiteBooking: async (organizationId: string, bookingId: string) => {
    const firestore = requireDb()
    await deleteBookingWithTombstone(firestore, { organizationId, collection: 'managerSiteBookings', bookingId })
    forgetOrgPlanDoc('managerSiteBookings', organizationId, bookingId)
    forgetOrgCollectionDoc('managerSiteBookings', organizationId, bookingId)
    set({
      managerSiteBookings: get().managerSiteBookings.filter((booking) => booking.id !== bookingId),
    })
  },
}))

/** The organisation the manager site booking listener is open for ('' before the first load). */
export function managerSiteBookingsOrganizationId(): string {
  return managerDownloadOrgId
}

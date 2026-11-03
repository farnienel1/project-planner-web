'use client'

import { create } from 'zustand'
import { doc, setDoc } from 'firebase/firestore'
import { deleteBookingWithTombstone } from '@/lib/bookings/bookingTombstoneWrite'
import { auth, db } from '@/lib/firebase/config'
import { MissingDocumentError, savePartialDocument } from '@/lib/firebase/partialWrite'
import { bookingUpdateWriteFields } from '@/lib/canonical/workDocumentReaders'
import { BOOKING_REPLAY_REFUSED_MESSAGE } from '@/lib/canonical/bookingTombstones'
import { forgetOrgCollectionDoc, isOrgCollectionSubscribed, subscribeOrgCollection, unsubscribeOrgCollection, type OrgCollectionDoc } from '@/lib/firebase/subscribeOrgCollection'
import { forgetOrgPlanDoc, subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { bookingPlanInputs, bookingPlanParts, webJobAccessViewer } from '@/lib/access/readPlan'
import { useAuthStore } from '@/lib/stores/authStore'
import { captureOrganizationContext, organizationContextStillCurrent, writeMetadataFields } from '@/lib/canonical'
import { organizationIdsMatch } from '@/lib/orgMembership/webActiveOrg'
import { retainParsedRows } from '@/lib/staff/rosterRetain'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import { londonMidnight } from '@/lib/ios-parity/londonTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { logSkippedDocument, parseBooking, serializeBooking } from '@/lib/ios-parity/converters'
import { resolveBookingJobCollection } from '@/lib/bookings/jobCollection'
import type { Booking } from '@/types'
import {
  bookingDownloadConstraints,
  bookingDownloadQueryId,
  launchBookingNeededDayKeys,
  nextBookingDownload,
  type BookingDownload,
  type BookingDownloadRequest,
} from '@/lib/firebase/bookingDownloadBound'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'

/** Current listener bound per organisation. A new organisation starts again from the launch bound. */
let bookingDownloadOrgId = ''
let bookingDownload: BookingDownload = { loadedFromDayKey: null, fullHistory: false }

/**
 * Rulebook 1.10.0 §17: a viewer who may not read every booking runs `bookingQueryPlan` — one query per visible job
 * (every spelling of its id) and their own bookings, each with the download bound; everyone else keeps the
 * whole-collection listener.
 */
function subscribeBookingsFor(
  key: string,
  organizationId: string,
  collectionName: 'bookings',
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

export type LoadBookingsOptions = BookingDownloadRequest & { force?: boolean }

interface BookingState {
  bookings: Booking[]
  loading: boolean
  ready: boolean
  error: string | null
  /**
   * Live bookings for the organisation. Without options the listener starts at canonical
   * `bookingLoadStart` (this week's Monday or the warning window start, whichever is earlier).
   * `fromDayKey` moves the start earlier for a screen showing older days; `fullHistory` loads
   * the whole archive (weekly report, timesheets history, job totals). The bound never moves later.
   */
  loadBookings: (organizationId: string, options?: LoadBookingsOptions) => Promise<void>
  /**
   * Rulebook 1.20.2: a create always gets a fresh document id and a plain create write — never a caller-chosen id or a
   * merge, so a new booking can never land on (and overwrite fields of) an existing booking.
   */
  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>
  deleteBooking: (id: string, organizationId: string) => Promise<void>
  getBookingsForDate: (date: Date) => Booking[]
  getBookingsForOperative: (operativeId: string, date: Date) => Booking[]
  checkConflict: (operativeId: string, date: Date, timeSlot: string) => Booking | null
}

function requireDb() {
  if (!db) throw new Error('Firebase is not configured')
  return db
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  loading: false,
  ready: false,
  error: null,

  loadBookings: async (organizationId: string, options?: LoadBookingsOptions) => {
    if (!organizationId || !db) return
    if (bookingDownloadOrgId !== organizationId) {
      bookingDownloadOrgId = organizationId
      bookingDownload = { loadedFromDayKey: null, fullHistory: false }
    }
    const next = nextBookingDownload(
      bookingDownload,
      launchBookingNeededDayKeys(new Date(), organizationDataFor(organizationId)),
      options
    )
    bookingDownload = { loadedFromDayKey: next.loadedFromDayKey, fullHistory: next.fullHistory }
    const queryId = bookingDownloadQueryId(bookingDownload)
    const current = get().bookings
    const foreign =
      current.length > 0 &&
      current.every((row) => row.organizationId && !organizationIdsMatch(row.organizationId, organizationId))
    const already = isOrgCollectionSubscribed('bookings', organizationId, queryId)
    if (foreign) set({ bookings: [], loading: true, ready: false, error: null })
    else if (already || current.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    subscribeBookingsFor('bookings', organizationId, 'bookings', (docs) => {
      const bookings: Booking[] = []
      for (const entry of docs) {
        const parsed = parseBooking(entry.id, entry.data, organizationId)
        if (parsed.ok) bookings.push(parsed.value)
        else logSkippedDocument('bookings', entry.id, parsed.errors)
      }
      const previous = get().bookings.filter(
        (row) => !row.organizationId || organizationIdsMatch(row.organizationId, organizationId)
      )
      set({ bookings: retainParsedRows(docs.length, previous, bookings), loading: false, ready: true })
    }, (error) => {
      set({ error: error.message, loading: false })
    }, { queryId, constraints: bookingDownloadConstraints(bookingDownload) })
  },

  createBooking: async (bookingData) => {
    const firestore = requireDb()
    const organizationId = bookingData.organizationId?.trim() || ''
    if (!organizationId) throw new Error('Missing organisation for booking')
    const id = newUppercaseUuid()
    const now = new Date()
    // Rulebook 1.11.0: every booking carries its job's collection (`jobCollection`).
    const jobCollection = bookingData.jobCollection ?? (await resolveBookingJobCollection(organizationId, bookingData.projectId)) ?? undefined
    const booking: Booking = {
      ...bookingData,
      id,
      date: londonMidnight(bookingData.date instanceof Date ? bookingData.date : new Date(bookingData.date), organizationZoneOr()),
      createdAt: now,
      updatedAt: now,
      organizationId,
      ...(jobCollection ? { jobCollection } : {}),
    }
    const payload = serializeBooking(booking)
    const captured = captureOrganizationContext()
    // Rulebook §1 / 1.9.0: a create carries write metadata (`writeMetadataFields`).
    await setDoc(
      doc(firestore, 'organizations', organizationId, 'bookings', id),
      { ...payload, ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}) }
    )
    if (!organizationContextStillCurrent(organizationId, captured)) return
    const { bookings } = get()
    if (!bookings.some((row) => row.id === id)) {
      set({ bookings: [...bookings, booking] })
    }
    // Rulebook 1.10.0 §13: the booked person gets `booking_created` (never the booker).
    void (async () => {
      const [{ notifyBookingCreated }, { useOrgUserStore }, { useOperativeStore }, { useProjectStore }, { useAuthStore }] =
        await Promise.all([
          import('@/lib/notifications/bookingNotices'),
          import('@/lib/stores/siteAuditStore'),
          import('@/lib/stores/operativeStore'),
          import('@/lib/stores/projectStore'),
          import('@/lib/stores/authStore'),
        ])
      const { projects, smallWorks } = useProjectStore.getState()
      const job = [...projects, ...smallWorks].find((row) => row.id.toLowerCase() === String(booking.projectId || '').toLowerCase())
      await notifyBookingCreated({
        booking,
        job,
        actor: useAuthStore.getState().user,
        users: useOrgUserStore.getState().users,
        operatives: useOperativeStore.getState().operatives,
        timeZone: organizationZoneOr(),
      })
    })().catch(() => undefined)
  },

  updateBooking: async (id, updates) => {
    const firestore = requireDb()
    const { bookings } = get()
    const booking = bookings.find((row) => row.id === id)
    if (!booking) return
    const organizationId = booking.organizationId || ''
    if (!organizationId) throw new Error('Missing organisation for booking')
    const nextJobId = updates.projectId ?? booking.projectId
    const jobChanged = String(nextJobId).toLowerCase() !== String(booking.projectId).toLowerCase()
    // Rulebook 1.11.0: an edit writes the job's collection too (adds it to a booking saved before 1.11.0).
    const jobCollection =
      (jobChanged ? updates.jobCollection : updates.jobCollection ?? booking.jobCollection) ??
      (await resolveBookingJobCollection(organizationId, nextJobId)) ??
      undefined
    const next: Booking = {
      ...booking,
      ...updates,
      id,
      date: londonMidnight((updates.date as Date | undefined) || booking.date, organizationZoneOr()),
      updatedAt: new Date(),
      ...(jobCollection ? { jobCollection } : {}),
    }
    const payload = serializeBooking(next)
    const captured = captureOrganizationContext()
    // Rulebook §1/§2: only the changed fields (`bookingUpdateWriteFields`); an edit never re-creates a booking
    // that was deleted elsewhere.
    try {
      await savePartialDocument(doc(firestore, 'organizations', organizationId, 'bookings', id), payload, bookingUpdateWriteFields, {
        userId: auth?.currentUser?.uid ?? null,
        missing: 'refuse',
        // Diff against the booking this edit started from, so only `updates` are written (never a stale field
        // over another device's change).
        base: serializeBooking(booking),
      })
    } catch (error: unknown) {
      if (error instanceof MissingDocumentError) {
        set({ bookings: get().bookings.filter((row) => row.id !== id), error: BOOKING_REPLAY_REFUSED_MESSAGE })
        throw new Error(BOOKING_REPLAY_REFUSED_MESSAGE)
      }
      throw error
    }
    if (!organizationContextStillCurrent(organizationId, captured)) return
    set({
      bookings: get().bookings.map((row) => (row.id === id ? next : row)),
    })
  },

  deleteBooking: async (id, organizationId) => {
    const firestore = requireDb()
    const { bookings } = get()
    try {
      await deleteBookingWithTombstone(firestore, { organizationId, collection: 'bookings', bookingId: id })
      forgetOrgPlanDoc('bookings', organizationId, id)
      forgetOrgCollectionDoc('bookings', organizationId, id)
      set({ bookings: bookings.filter((row) => row.id !== id) })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete booking' })
      throw error
    }
  },

  getBookingsForDate: (date: Date) => {
    const target = londonMidnight(date, organizationZoneOr())
    return get().bookings.filter((booking) => {
      const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
      return londonMidnight(bookingDate, organizationZoneOr()).getTime() === target.getTime()
    })
  },

  getBookingsForOperative: (operativeId: string, date: Date) => {
    return get().getBookingsForDate(date).filter((booking) => booking.operativeId === operativeId)
  },

  checkConflict: (operativeId: string, date: Date, timeSlot: string) => {
    return (
      get().getBookingsForOperative(operativeId, date).find((booking) => {
        return booking.timeSlot === timeSlot || booking.timeSlot === 'FULL DAY' || timeSlot === 'FULL DAY'
      }) || null
    )
  },
}))

/** The organisation the booking listener is open for ('' before the first load). */
export function bookingsOrganizationId(): string {
  return bookingDownloadOrgId
}

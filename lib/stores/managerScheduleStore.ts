'use client'

import { create } from 'zustand'
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { deleteBookingWithTombstone } from '@/lib/bookings/bookingTombstoneWrite'
import { resolveBookingJobCollection } from '@/lib/bookings/jobCollection'
import { auth, db } from '@/lib/firebase/config'
import { MissingDocumentError, addPartialDocumentToBatch, createWritePayload, savePartialDocument } from '@/lib/firebase/partialWrite'
import { addBookingReplaceToBatch, commitBookingReplace, forgetReplacedBookings } from '@/lib/bookings/bookingReplaceWrite'
import type { BookingReplaceOptions } from '@/lib/stores/bookingStore'
import { BOOKING_REPLAY_REFUSED_MESSAGE, writeMetadataFields } from '@/lib/canonical'
import { managerSiteBookingUpdateWriteFields } from '@/lib/canonical/workDocumentReaders'
import { forgetOrgCollectionDoc, isOrgCollectionSubscribed, subscribeOrgCollection, unsubscribeOrgCollection, type OrgCollectionDoc } from '@/lib/firebase/subscribeOrgCollection'
import { forgetOrgPlanDoc, subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { bookingPlanInputs, bookingPlanParts, webJobAccessViewer } from '@/lib/access/readPlan'
import { securitySwitchesReady } from '@/lib/access/securitySwitches'
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
  /** Rulebook 1.11.0: the job's collection for a job-linked booking; resolved from the job when not given. */
  jobCollection?: 'projects' | 'smallWorks'
  /** Rulebook 1.32.0 §25 (decision A): set on create only when the person changed the pre-filled organisation rate. */
  otMultiplierOverride?: number | null
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
  saveManagerSiteBooking: (organizationId: string, booking: SaveManagerSiteBookingInput, options?: BookingReplaceOptions) => Promise<void>
  updateManagerSiteBooking: (
    organizationId: string,
    bookingId: string,
    updates: Partial<SaveManagerSiteBookingInput>,
    options?: BookingReplaceOptions
  ) => Promise<void>
  deleteManagerSiteBooking: (organizationId: string, bookingId: string) => Promise<void>
}

export const useManagerScheduleStore = create<ManagerScheduleState>((set, get) => ({
  managerSiteBookings: [],
  loading: false,
  error: null,

  loadManagerSiteBookings: async (organizationId, options) => {
    if (!organizationId || !db) return
    // Rulebook 1.26.0: plan for the `enforcedReads` switch as the rules read it now (first read of platformConfig/app).
    await securitySwitchesReady()
    void import('@/lib/access/readPlanSync').then((sync) => sync.followSecuritySwitches()).catch(() => undefined)
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

  saveManagerSiteBooking: async (organizationId: string, booking: SaveManagerSiteBookingInput, options) => {
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
      ...(typeof booking.otMultiplierOverride === 'number' ? { otMultiplierOverride: booking.otMultiplierOverride } : {}),
      createdAt: now,
      updatedAt: now,
      organizationId,
    }
    // Rulebook 1.11.0: a job-linked manager booking carries its job's collection (`jobCollection`).
    if (booking.locationType === 'project' || booking.locationType === 'small_work') {
      next.jobCollection = booking.jobCollection ?? (await resolveBookingJobCollection(organizationId, booking.locationId)) ?? undefined
    }
    const payload = serializeManagerSiteBooking({ ...next, organizationId })
    // Rulebook §1 / 1.9.0: a create carries write metadata (`writeMetadataFields`). 1.20.2: a fresh id and a plain
    // create write (no merge), so it can never land on an existing booking.
    const createFields = { ...createWritePayload(payload), ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}) }
    const replaces = options?.replaces ?? []
    if (replaces.length > 0) {
      // Rulebook 1.41.0 §5 (`bookingReplaceWrites`): the create and each replaced delete + tombstone in one batch.
      const removed = await commitBookingReplace(firestore, {
        organizationId,
        booking: { collection: 'managerSiteBookings', bookingId: id },
        replaced: replaces,
        write: (batch, ref) => batch.set(ref, createFields),
      })
      await forgetReplacedBookings(organizationId, removed)
    } else {
      await setDoc(doc(firestore, 'organizations', organizationId, 'managerSiteBookings', id), createFields)
    }
    const without = get().managerSiteBookings.filter((row) => row.id !== next.id)
    set({ managerSiteBookings: [...without, next] })
  },

  updateManagerSiteBooking: async (organizationId, bookingId, updates, options) => {
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
    if (next.locationType === 'project' || next.locationType === 'small_work') {
      const sameJob = String(next.locationId ?? '').toLowerCase() === String(existing.locationId ?? '').toLowerCase()
      next.jobCollection =
        (sameJob ? updates.jobCollection ?? existing.jobCollection : updates.jobCollection) ??
        (await resolveBookingJobCollection(organizationId, next.locationId)) ??
        undefined
    } else {
      next.jobCollection = undefined
    }
    const payload = serializeManagerSiteBooking({ ...next, organizationId })
    // Rulebook 1.9.0 `managerSiteBookingUpdateWriteFields`: only the changed fields, with write metadata; an edit of
    // a booking deleted on another device is refused, never re-created.
    try {
      const replaces = options?.replaces ?? []
      const ref = doc(firestore, 'organizations', organizationId, 'managerSiteBookings', bookingId)
      if (replaces.length > 0) {
        // Rulebook 1.41.0 §5: the edit and each replaced delete + tombstone in one batch (a missing booking is refused).
        if (!(await getDoc(ref)).exists()) throw new MissingDocumentError(ref.path)
        const batch = writeBatch(firestore)
        await addPartialDocumentToBatch(batch, ref, payload, managerSiteBookingUpdateWriteFields, {
          userId: auth?.currentUser?.uid ?? null,
          base: serializeManagerSiteBooking({ ...existing, organizationId }),
        })
        const removed = addBookingReplaceToBatch(firestore, batch, {
          organizationId,
          booking: { collection: 'managerSiteBookings', bookingId },
          replaced: replaces,
        })
        await batch.commit()
        await forgetReplacedBookings(organizationId, removed)
      } else {
        await savePartialDocument(ref, payload, managerSiteBookingUpdateWriteFields, {
          userId: auth?.currentUser?.uid ?? null,
          missing: 'refuse',
          // Diff against the booking this edit started from: only `updates` are written.
          base: serializeManagerSiteBooking({ ...existing, organizationId }),
        })
      }
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
    notifyOvertimeReopenedSoon(organizationId, existing, next)
  },

  deleteManagerSiteBooking: async (organizationId: string, bookingId: string) => {
    const firestore = requireDb()
    const removed = get().managerSiteBookings.find((booking) => booking.id === bookingId)
    await deleteBookingWithTombstone(firestore, { organizationId, collection: 'managerSiteBookings', bookingId })
    if (removed) notifyOvertimeReopenedSoon(organizationId, removed, null)
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

/**
 * Rulebook 1.33.0 §25 (reopen): a changed or deleted manager site booking reopens its PAYE overtime line (a PAYE
 * manager's own site booking carries overtime like a labour booking); the person, and their line manager when the line
 * had been returned, are told. Best effort, after the write; never blocks it. The labour twin is in `bookingStore.ts`.
 */
function notifyOvertimeReopenedSoon(organizationId: string, before: ManagerSiteBooking, after: ManagerSiteBooking | null): void {
  void (async () => {
    const [{ notifyOvertimeLineReopened }, { overtimeBookingInputs }, { useOrgUserStore }, { useOperativeStore }, { useProjectStore }] =
      await Promise.all([
        import('@/lib/overtime/overtimeReopenNotice'),
        import('@/lib/overtime/overtimeData'),
        import('@/lib/stores/siteAuditStore'),
        import('@/lib/stores/operativeStore'),
        import('@/lib/stores/projectStore'),
      ])
    const { projects, smallWorks } = useProjectStore.getState()
    const timeZone = organizationZoneOr()
    const toInput = (row: ManagerSiteBooking) =>
      overtimeBookingInputs({ bookings: [], managerSiteBookings: [row], projects, smallWorks, timeZone })[0] ?? null
    const beforeInput = toInput(before)
    if (!beforeInput || !organizationId) return
    await notifyOvertimeLineReopened({
      organizationId,
      before: beforeInput,
      after: after ? toInput(after) : null,
      organization: useOrganizationDocumentStore.getState().data ?? {},
      timeZone,
      users: useOrgUserStore.getState().users,
      operatives: useOperativeStore.getState().operatives,
    })
  })().catch(() => undefined)
}

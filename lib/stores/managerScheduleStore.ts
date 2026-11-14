'use client'

import { bookingCoverageAfterPublish, bookingCoverageOnSubscribe } from '@/lib/firebase/orgCollectionMerge'
import { create } from 'zustand'
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { addBookingDeleteWithTombstone, commitBookingMove, deleteBookingWithTombstone } from '@/lib/bookings/bookingTombstoneWrite'
import { BOOKING_TOMBSTONE_COLLECTION, captureOrganizationContext, organizationContextStillCurrent } from '@/lib/canonical'
import { resolveBookingJobCollection } from '@/lib/bookings/jobCollection'
import { announceSignedTimesheetDelete } from '@/lib/bookings/signedTimesheetDeleteNotice'
import { auth, db } from '@/lib/firebase/config'
import { MissingDocumentError, addPartialDocumentToBatch, createWritePayload, savePartialDocument } from '@/lib/firebase/partialWrite'
import { commitBookingReplace, forgetReplacedBookings } from '@/lib/bookings/bookingReplaceWrite'
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
  onDocs: (docs: OrgCollectionDoc[], meta?: { authoritative: boolean }) => void,
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
  /** Rulebook 1.43.0: what the last snapshot covers (see `useBookingStore.coverage`). */
  coverage: { organizationId: string; fullHistory: boolean; fromDayKey: string | null } | null
  /** Same listener bound as bookings (canonical `bookingLoadStart`); see `useBookingStore.loadBookings`. */
  loadManagerSiteBookings: (
    organizationId: string,
    options?: BookingDownloadRequest & { force?: boolean }
  ) => Promise<void>
  saveManagerSiteBooking: (organizationId: string, booking: SaveManagerSiteBookingInput, options?: BookingReplaceOptions) => Promise<void>
  /**
   * Owner answer 11 Nov (item 4): a labour booking moved to the manager schedule (Other) — the new manager site booking
   * and the delete of the labour booking with its tombstone in ONE batch.
   */
  moveBookingIntoManagerSchedule: (
    organizationId: string,
    booking: SaveManagerSiteBookingInput,
    fromBookingId: string
  ) => Promise<void>
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
  coverage: null,

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
    if (foreign) set({ managerSiteBookings: [], loading: true, error: null, coverage: null })
    else if (already || current.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    // Review r318: a new query (a wider bound, a re-plan) starts with no coverage until it answers.
    set({ coverage: bookingCoverageOnSubscribe(get().coverage, already) })
    const coverage = { organizationId, fullHistory: managerDownload.fullHistory, fromDayKey: managerDownload.loadedFromDayKey }
    subscribeBookingsFor(
      'managerSiteBookings',
      organizationId,
      'managerSiteBookings',
      (docs, meta) => {
        const managerSiteBookings: ManagerSiteBooking[] = []
        for (const entry of docs) {
          const parsed = parseManagerSiteBooking(entry.id, entry.data, organizationId)
          if (parsed.ok) managerSiteBookings.push(parsed.value)
          else logSkippedDocument('managerSiteBookings', entry.id, parsed.errors)
        }
        const previous = get().managerSiteBookings.filter(
          (row) => !row.organizationId || organizationIdsMatch(row.organizationId, organizationId)
        )
        const rows = retainParsedRows(docs.length, previous, managerSiteBookings)
        // 1.43.0: `coverage` only from a server answer of this query (see `useBookingStore`).
        set({ managerSiteBookings: rows, loading: false, coverage: bookingCoverageAfterPublish(coverage, meta) })
      },
      (error) => set({ error: error.message, loading: false }),
      { queryId, constraints: bookingDownloadConstraints(managerDownload) }
    )
  },

  moveBookingIntoManagerSchedule: async (organizationId: string, booking: SaveManagerSiteBookingInput, fromBookingId: string) => {
    const firestore = requireDb()
    if (!organizationId.trim()) throw new Error('Missing organisation for booking')
    const deletedBy = auth?.currentUser?.uid
    if (!deletedBy) throw new Error('Sign in again to move this booking.')
    const captured = captureOrganizationContext()
    const { next, payload } = await managerSiteBookingCreate(organizationId, booking)
    const batch = writeBatch(firestore)
    batch.set(doc(firestore, 'organizations', organizationId, 'managerSiteBookings', next.id), {
      ...createWritePayload(payload),
      ...(writeMetadataFields(deletedBy, 'web') ?? {}),
    })
    addBookingDeleteWithTombstone(firestore, batch, { organizationId, collection: 'bookings', bookingId: fromBookingId, deletedBy })
    // Review (11 Nov): a source deleted on another device writes nothing and reads "This was deleted on another device."
    await commitBookingMove({
      sourceExists: async () => (await getDoc(doc(firestore, 'organizations', organizationId, 'bookings', fromBookingId))).exists(),
      tombstoneExists: async () => (await getDoc(doc(firestore, 'organizations', organizationId, BOOKING_TOMBSTONE_COLLECTION, fromBookingId))).exists(),
      commit: () => batch.commit(),
      missing: () => new MissingDocumentError(`organizations/${organizationId}/bookings/${fromBookingId}`),
    })
    // The organisation was switched while the move was written: the write stands, this screen's lists are not touched.
    if (!organizationContextStillCurrent(organizationId, captured)) return
    set({ managerSiteBookings: [...get().managerSiteBookings.filter((row) => row.id !== next.id), next] })
    const { notifyBookingRemovedSoon } = await import('@/lib/stores/bookingStore')
    notifyBookingRemovedSoon(fromBookingId)
  },

  saveManagerSiteBooking: async (organizationId: string, booking: SaveManagerSiteBookingInput, options) => {
    const firestore = requireDb()
    if (!organizationId.trim()) throw new Error('Missing organisation for booking')
    const { next, payload } = await managerSiteBookingCreate(organizationId, booking)
    // Rulebook §1 / 1.9.0: a create carries write metadata (`writeMetadataFields`). 1.20.2: a fresh id and a plain
    // create write (no merge), so it can never land on an existing booking.
    const createFields = { ...createWritePayload(payload), ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}) }
    const replaces = options?.replaces ?? []
    if (replaces.length > 0) {
      // Rulebook 1.41.0 §5 (`bookingReplaceWrites`): the create and each replaced delete + tombstone in one checked transaction.
      const removed = await commitBookingReplace(firestore, {
        organizationId,
        booking: { collection: 'managerSiteBookings', bookingId: next.id },
        replaced: replaces,
        write: (tx, ref) => {
          tx.set(ref, createFields)
        },
      })
      await forgetReplacedBookings(organizationId, removed)
    } else {
      await setDoc(doc(firestore, 'organizations', organizationId, 'managerSiteBookings', next.id), createFields)
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
        const removed = await commitBookingReplace(firestore, {
          organizationId,
          booking: { collection: 'managerSiteBookings', bookingId: bookingId },
          replaced: replaces,
          existing: true,
          write: async (tx, ref) => {
            await addPartialDocumentToBatch(tx, ref, payload, managerSiteBookingUpdateWriteFields, {
              userId: auth?.currentUser?.uid ?? null,
              base: serializeManagerSiteBooking({ ...existing, organizationId }),
            })
          },
        })
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
    if (removed) {
      notifyOvertimeReopenedSoon(organizationId, removed, null)
      // Rulebook 1.33.0 §2: a day on a signed or exported timesheet warns (`bookingDeleteSignedTimesheetWarning`);
      // the delete has already gone ahead.
      announceSignedTimesheetDelete({ organizationId, personId: removed.userId, date: removed.date })
    }
    forgetOrgPlanDoc('managerSiteBookings', organizationId, bookingId)
    forgetOrgCollectionDoc('managerSiteBookings', organizationId, bookingId)
    set({
      managerSiteBookings: get().managerSiteBookings.filter((booking) => booking.id !== bookingId),
    })
  },
}))


/** The new manager site booking and its create payload (a fresh id), shared by a save and a move (1.39.0). */
async function managerSiteBookingCreate(
  organizationId: string,
  booking: SaveManagerSiteBookingInput
): Promise<{ next: ManagerSiteBooking; payload: ReturnType<typeof serializeManagerSiteBooking> }> {
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
  return { next, payload: serializeManagerSiteBooking({ ...next, organizationId }) }
}

/** The organisation the manager site booking listener is open for ('' before the first load). */
export function managerSiteBookingsOrganizationId(): string {
  return managerDownloadOrgId
}

/** A manager site booking moved out by a batched move (1.39.0): its PAYE overtime line reopens, as a delete does. */
export function notifyManagerSiteBookingRemovedSoon(organizationId: string, bookingId: string): void {
  // As `deleteManagerSiteBooking`: the plan and collection caches forget the document.
  forgetOrgPlanDoc('managerSiteBookings', organizationId, bookingId)
  forgetOrgCollectionDoc('managerSiteBookings', organizationId, bookingId)
  const state = useManagerScheduleStore.getState()
  const removed = state.managerSiteBookings.find((row) => row.id === bookingId)
  if (!removed) return
  useManagerScheduleStore.setState({ managerSiteBookings: state.managerSiteBookings.filter((row) => row.id !== bookingId) })
  notifyOvertimeReopenedSoon(organizationId, removed, null)
}

/**
 * Rulebook 1.33.0 §25 (reopen): a changed or deleted manager site booking reopens its PAYE overtime line (a PAYE
 * manager's own site booking carries overtime like a labour booking); the person, and their line manager when the line
 * had been returned, are told. Best effort, after the write; never blocks it. The labour twin is in `bookingStore.ts`.
 */
export function notifyOvertimeReopenedSoon(organizationId: string, before: ManagerSiteBooking, after: ManagerSiteBooking | null): void {
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

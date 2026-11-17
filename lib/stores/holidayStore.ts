'use client'

import { create } from 'zustand'
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import {
  holidayDecisionWriteFields,
  holidayRequestWriteFields,
  parseHolidayDecisionNote,
  parseHolidayDocument,
  writeMetadataFields,
} from '@/lib/canonical'
import {
  forgetOrgCollectionDoc,
  subscribeOrgCollectionLoaded,
  unsubscribeOrgCollection,
  type OrgCollectionDoc,
} from '@/lib/firebase/subscribeOrgCollection'
import { forgetOrgPlanDoc, subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { leavePlanKey, leavePlanParts, leaveReplanTarget, ownBookingIdsFor, webJobAccessViewer } from '@/lib/access/readPlan'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { onPlatformConfigChange, operativeOwnLeaveFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { captureOrganizationContext, currentOrganizationId, organizationContextStillCurrent, type OrganizationContextSnapshot } from '@/lib/canonical'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import type { HolidayBooking, HolidayStatus, HolidayTimeSlot } from '@/types'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import { newUuid, parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { changedFirestoreFields } from '@/lib/firebase/changedFields'

/** `updatedBy` / `updatedFrom` + server `updatedAt` on every holiday write. */
function holidayWriteMetadata() {
  return { ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}), updatedAt: serverTimestamp() }
}

/**
 * One `holidayBookings` document as a `HolidayBooking`. The document is read only through the rulebook
 * reader `parseHolidayDocument` (rulebook §9): keys, status words, ids and organisation-zone day keys are
 * the same as on iOS. `startDate` / `endDate` are midnight of those day keys in the organisation zone.
 */
export function mapHolidayBooking(
  docId: string,
  data: Record<string, unknown>,
  orgId: string,
  timeZone?: string | null
): HolidayBooking | null {
  const zone = organizationZoneOr(timeZone)
  const parsed = parseHolidayDocument(docId, data, zone)
  if (!parsed) return null

  return {
    id: parsed.id,
    organizationId: parsed.organizationId ?? orgId,
    userId: parsed.userId ?? undefined,
    operativeId: parsed.operativeId ?? undefined,
    startDate: dateFromDayKeyInZone(parsed.startDayKey, zone),
    endDate: dateFromDayKeyInZone(parsed.endDayKey, zone),
    startDayKey: parsed.startDayKey,
    endDayKey: parsed.endDayKey,
    dayKeyTimeZone: zone,
    status: parsed.status,
    timeSlot: parsed.timeSlot,
    approvedByUserId: parsed.approvedByUserId ?? undefined,
    approvedAt: parseFirestoreDate(data.approvedAt),
    cancellationRequestedAt: parseFirestoreDate(data.cancellationRequestedAt),
    cancellationRequestedByUserId: parsed.cancellationRequestedByUserId ?? undefined,
    decisionNote: parsed.decisionNote ?? undefined,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
  }
}

function holidayPayload(booking: HolidayBooking) {
  return {
    id: booking.id,
    organizationId: booking.organizationId,
    userId: booking.userId || null,
    operativeId: booking.operativeId || null,
    startDate: Timestamp.fromDate(booking.startDate),
    endDate: Timestamp.fromDate(booking.endDate),
    status: booking.status,
    timeSlot: booking.timeSlot,
    approvedByUserId: booking.approvedByUserId || null,
    approvedAt: booking.approvedAt ? Timestamp.fromDate(booking.approvedAt) : null,
    cancellationRequestedAt: booking.cancellationRequestedAt
      ? Timestamp.fromDate(booking.cancellationRequestedAt)
      : null,
    cancellationRequestedByUserId: booking.cancellationRequestedByUserId || null,
    // Only written when set, so a merge from an older screen never clears an iOS decision note.
    ...(parseHolidayDecisionNote(booking.decisionNote) ? { decisionNote: parseHolidayDecisionNote(booking.decisionNote) } : {}),
    createdAt: Timestamp.fromDate(booking.createdAt),
    updatedAt: Timestamp.fromDate(booking.updatedAt),
  }
}

export type HolidayRequestCreate = {
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey: string
  timeSlot: HolidayTimeSlot
  status: HolidayStatus
  approvedByUserId?: string | null
}

interface HolidayState {
  bookings: HolidayBooking[]
  loading: boolean
  error: string | null
  loadedOrgId: string | null
  loadBookings: (organizationId: string) => Promise<void>
  saveBooking: (organizationId: string, booking: HolidayBooking) => Promise<void>
  deleteBooking: (organizationId: string, id: string) => Promise<void>
  requestCancellation: (organizationId: string, booking: HolidayBooking, userId: string) => Promise<void>
  /** One document per request range (`holidayRequestWriteFields`). Returns the saved bookings. */
  createRequests: (organizationId: string, requests: HolidayRequestCreate[], timeZone?: string) => Promise<HolidayBooking[]>
  /** Approve or decline in one partial update (`holidayDecisionWriteFields`). */
  decideBooking: (
    organizationId: string,
    booking: HolidayBooking,
    decision: { status: 'approved' | 'rejected'; approverUid: string; decisionNote?: string | null }
  ) => Promise<void>
}

export function isPendingHolidayRequest(booking: HolidayBooking): boolean {
  return (
    (booking.status === 'pending' || booking.cancellationRequestedAt != null) &&
    (booking.operativeId != null || booking.userId != null)
  )
}

let holidayOrgId = ''
const HOLIDAY_LISTENER_KEY = 'holidayStore:holidayBookings'
/** Rulebook 1.56.0: the organisation `loadBookings` was last asked for, and the leave plan (and user) its listener runs. */
let holidayRequestedOrgId: string | null = null
let holidayPlannedKey: string | null = null
let holidayPlannedUserId: string | null = null
/**
 * Review of #356 (third): the load in progress — recorded synchronously before any await — so a re-plan for the same
 * organisation, user and plan never starts another load (no re-entry loop). `token` tells a superseded load to stop.
 */
let holidayInFlight: { token: number; orgId: string; userId: string | null; key: string } | null = null
let holidayLoadToken = 0
/** The newest `loadBookings` call; a superseded call settles when this one does (review of #356, fourth). */
let holidayLatestLoad: { token: number; promise: Promise<void> } | null = null
/**
 * Review of #356 (fourth): re-plans after a refusal are capped per organisation, user and plan — the first retry
 * after `HOLIDAY_RETRY_BACKOFF_MS[0]`, the next after `[1]`, then none until the inputs (the plan) change. A screen's
 * own `loadBookings` call (open, refresh) is never held back.
 */
export const HOLIDAY_RETRY_BACKOFF_MS = [30_000, 120_000] as const
const holidayFailures = new Map<string, { count: number; nextAllowedAt: number }>()
const failureKey = (orgId: string, userId: string | null, key: string) => `${orgId}|${userId ?? ''}|${key}`

/** Review of #356 (final, S2): a plan that works for a company and user clears every failure record of that pair. */
function clearHolidayFailuresFor(orgId: string, userId: string | null): void {
  const prefix = `${orgId}|${userId ?? ''}|`
  for (const id of [...holidayFailures.keys()]) if (id.startsWith(prefix)) holidayFailures.delete(id)
}

function recordHolidayFailure(orgId: string, userId: string | null, key: string): void {
  const id = failureKey(orgId, userId, key)
  const count = (holidayFailures.get(id)?.count ?? 0) + 1
  const wait = HOLIDAY_RETRY_BACKOFF_MS[count - 1]
  holidayFailures.set(id, { count, nextAllowedAt: wait === undefined ? Number.POSITIVE_INFINITY : holidayListeners.now() + wait })
}
let followingPlatformConfig = false

/** The listener calls, swappable in tests (a subscribe that stays pending, a refusal). */
const holidayListeners = {
  subscribeCollectionLoaded: subscribeOrgCollectionLoaded,
  subscribePlan: subscribeOrgPlan,
  unsubscribeCollection: unsubscribeOrgCollection,
  unsubscribePlan: unsubscribeOrgPlan,
  switchesReady: securitySwitchesReady,
  operativeOwnLeave: operativeOwnLeaveFor,
  now: () => Date.now(),
}

/** Tests only: replace some listener calls; returns a restore function. */
export function setHolidayListenersForTests(overrides: Partial<typeof holidayListeners>): () => void {
  const saved = { ...holidayListeners }
  Object.assign(holidayListeners, overrides)
  return () => {
    Object.assign(holidayListeners, saved)
    holidayRequestedOrgId = null
    holidayPlannedKey = null
    holidayPlannedUserId = null
    holidayInFlight = null
    holidayLatestLoad = null
    holidayFailures.clear()
    holidayOrgId = ''
  }
}

/**
 * Review of #356: an async result of a leave load still belongs to the screen — the organisation context it started
 * in is still the open one (`organizationContextStillCurrent`: same company, same epoch, so a company switch or a
 * sign-out after an organisation was adopted blocks it; nothing is gated before the first adoption).
 */
function holidayResultCurrent(organizationId: string, captured: OrganizationContextSnapshot): boolean {
  return organizationContextStillCurrent(organizationId, captured)
}

/**
 * The signed-in user's leave plan for `organizationId` now (`leaveQueryPlan` through `leavePlanParts`): their own ids
 * are worked out here, at plan time, from the auth user and the operatives rows (`bookingIdsForAccount`), never from
 * inputs that may not have arrived yet; the `operativeOwnLeave` switch as `platformConfig/app` says now.
 */
function currentLeavePlanParts(organizationId: string) {
  const user = useAuthStore.getState().user
  return leavePlanParts(
    webJobAccessViewer(user),
    ownBookingIdsFor(user, useOperativeStore.getState().operatives),
    user?.email ?? null,
    holidayListeners.operativeOwnLeave(organizationId)
  )
}

/** Drop the leave rows on screen (review of #356): a previous user's, or a whole company's after the plan narrowed. */
function clearHolidayRows(): void {
  holidayOrgId = ''
  useHolidayStore.setState({ bookings: [], loadedOrgId: null })
}

/**
 * Rulebook 1.56.0: re-plan the leave listener of the organisation last requested when the signed-in user, their
 * operatives rows or the `operativeOwnLeave` switch changed the plan (`leaveReplanTarget`) — only while that
 * organisation is still the open one, and never while a load of the same organisation, user and plan is in progress
 * (review of #356: no re-entry). Signed out: forget the plan and the rows.
 */
export function replanHolidayBookings(): void {
  const user = useAuthStore.getState().user
  if (!user) {
    holidayRequestedOrgId = null
    holidayPlannedKey = null
    holidayPlannedUserId = null
    holidayInFlight = null
    holidayLoadToken += 1
    holidayFailures.clear()
    holidayListeners.unsubscribeCollection(HOLIDAY_LISTENER_KEY)
    holidayListeners.unsubscribePlan(HOLIDAY_LISTENER_KEY)
    clearHolidayRows()
    return
  }
  if (!holidayRequestedOrgId) return
  const nextKey = leavePlanKey(currentLeavePlanParts(holidayRequestedOrgId))
  const inFlight = holidayInFlight
  if (inFlight && inFlight.orgId === holidayRequestedOrgId && inFlight.userId === user.id && inFlight.key === nextKey) return
  // Review of #356 (fourth): a plan that was refused is retried only after its backoff, at most twice, until it changes.
  const failure = holidayFailures.get(failureKey(holidayRequestedOrgId, user.id, nextKey))
  if (failure && holidayListeners.now() < failure.nextAllowedAt) return
  const target = leaveReplanTarget({
    requestedOrgId: holidayRequestedOrgId,
    currentOrgId: currentOrganizationId(),
    contextAdopted: captureOrganizationContext().epoch > 0,
    plannedKey: inFlight ? null : holidayPlannedUserId === user.id ? holidayPlannedKey : null,
    nextKey,
    signedIn: true,
  })
  if (target) void useHolidayStore.getState().loadBookings(target).catch(() => undefined)
}

export const useHolidayStore = create<HolidayState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  loadedOrgId: null,

  // Rulebook 1.9.0 §1 / §10 (`LIVE_COLLECTIONS`): annual leave is a live listener wherever it is shown (annual leave,
  // My Schedule, Daily Overview, warnings, Home). The load resolves on the first snapshot; a decision or request made
  // on any platform arrives through the same listener.
  loadBookings: (organizationId) => {
    if (!organizationId) return Promise.resolve()
    const token = holidayLoadToken + 1
    const promise = runHolidayLoad(organizationId)
    holidayLatestLoad = { token, promise }
    return promise
  },

  saveBooking: async (organizationId, booking) => {
    const id = booking.id || newUuid()
    const payload = holidayPayload({ ...booking, id, updatedAt: new Date() })
    const ref = doc(db, 'organizations', organizationId, 'holidayBookings', id)
    const previous = booking.id ? get().bookings.find((row) => row.id === booking.id) : undefined
    if (previous) {
      // An edit is a partial update of the fields this save changed (rulebook §1, §9): never a whole-document
      // rewrite from the local copy, and never `createdAt` / a client `updatedAt`.
      const { createdAt: _created, updatedAt: _updated, ...next } = payload
      const { createdAt: _pc, updatedAt: _pu, ...before } = holidayPayload(previous)
      void _created
      void _updated
      void _pc
      void _pu
      const changed = changedFirestoreFields(next, before)
      if (Object.keys(changed).length > 0) {
        await updateDoc(ref, { ...changed, ...holidayWriteMetadata() })
      }
    } else {
      await setDoc(ref, { ...payload, ...holidayWriteMetadata() }, { merge: true })
    }
    // Rulebook 1.9.0 (L14): a save that finishes after the user switched company never touches the new one's list.
    if (!liveResultStillCurrent(organizationId)) return
    const mapped = mapHolidayBooking(id, payload as unknown as Record<string, unknown>, organizationId)
    if (!mapped) return
    const { bookings } = get()
    set({
      bookings: [...bookings.filter((b) => b.id !== id), mapped].sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    })
  },

  deleteBooking: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'holidayBookings', id))
    markRowsRemoved(`holidayBookings:${organizationId}`, [id])
    forgetOrgCollectionDoc(HOLIDAY_LISTENER_KEY, organizationId, id)
    forgetOrgPlanDoc(HOLIDAY_LISTENER_KEY, organizationId, id)
    if (!liveResultStillCurrent(organizationId)) return
    set({ bookings: get().bookings.filter((b) => b.id !== id) })
  },

  createRequests: async (organizationId, requests, timeZone) => {
    const saved: HolidayBooking[] = []
    // One request of several ranges (rulebook §9 `holidayRequestRanges`) is written in one batch: all of it or none,
    // never half a request.
    const batch = writeBatch(db)
    let batched = 0
    for (const request of requests) {
      const id = newUuid()
      const fields = holidayRequestWriteFields({ ...request, id, organizationId, timeZone })
      if (!fields) continue
      const { startDateMs, endDateMs, startDayKey: _start, endDayKey: _end, ...stored } = fields
      void _start
      void _end
      const now = new Date()
      const payload = {
        ...stored,
        startDate: Timestamp.fromMillis(startDateMs),
        endDate: Timestamp.fromMillis(endDateMs),
        approvedAt: stored.status === 'approved' ? Timestamp.fromDate(now) : null,
        cancellationRequestedAt: null,
        createdAt: Timestamp.fromDate(now),
        ...holidayWriteMetadata(),
      }
      batch.set(doc(db, 'organizations', organizationId, 'holidayBookings', id), payload, { merge: true })
      batched += 1
      const mapped = mapHolidayBooking(
        id,
        { ...payload, updatedAt: Timestamp.fromDate(now) } as unknown as Record<string, unknown>,
        organizationId,
        timeZone
      )
      if (mapped) saved.push(mapped)
    }
    if (batched > 0) await batch.commit()
    if (saved.length > 0 && liveResultStillCurrent(organizationId)) {
      const ids = new Set(saved.map((row) => row.id))
      set({
        bookings: [...get().bookings.filter((b) => !ids.has(b.id)), ...saved].sort(
          (a, b) => b.startDate.getTime() - a.startDate.getTime()
        ),
      })
    }
    return saved
  },

  decideBooking: async (organizationId, booking, decision) => {
    const fields = holidayDecisionWriteFields(decision)
    if (!fields) throw new Error('That decision is not valid.')
    const now = new Date()
    await updateDoc(doc(db, 'organizations', organizationId, 'holidayBookings', booking.id), {
      ...fields,
      approvedAt: Timestamp.fromDate(now),
      ...holidayWriteMetadata(),
    })
    if (!liveResultStillCurrent(organizationId)) return
    const updated: HolidayBooking = {
      ...booking,
      status: fields.status,
      approvedByUserId: fields.approvedByUserId,
      approvedAt: now,
      decisionNote: fields.decisionNote ?? undefined,
      updatedAt: now,
    }
    set({ bookings: get().bookings.map((row) => (row.id === booking.id ? updated : row)) })
  },

  requestCancellation: async (organizationId, booking, userId) => {
    const updated: HolidayBooking = {
      ...booking,
      cancellationRequestedAt: new Date(),
      cancellationRequestedByUserId: userId,
      updatedAt: new Date(),
    }
    await get().saveBooking(organizationId, updated)
  },
}))


/**
 * Review of #356 (fourth): a superseded load settles when the newest load settles, never earlier, so a caller that
 * waits for "annual leave loaded" (pull-to-refresh `settle('annual leave')`) is not told it is done too soon.
 */
async function waitForNewerLoad(token: number): Promise<void> {
  const latest = holidayLatestLoad
  if (latest && latest.token !== token) await latest.promise.catch(() => undefined)
}

/** One `loadBookings` run (the store method records it as the newest load). */
async function runHolidayLoad(organizationId: string): Promise<void> {
    // Review of #356 (third): everything below up to the first await runs synchronously, so a re-plan triggered while
    // this load is pending sees it in `holidayInFlight` and never starts another one.
    const captured = captureOrganizationContext()
    const token = ++holidayLoadToken
    const startUserId = useAuthStore.getState().user?.id ?? null
    holidayRequestedOrgId = organizationId
    holidayInFlight = { token, orgId: organizationId, userId: startUserId, key: leavePlanKey(currentLeavePlanParts(organizationId)) }
    if (useHolidayStore.getState().loadedOrgId !== organizationId) useHolidayStore.setState({ loading: true, error: null })
    // Rulebook 1.56.0 §9 / §17: readPlanSync re-plans this listener when the signed-in user or the operatives rows
    // change; every read of platformConfig/app re-plans it when the `operativeOwnLeave` switch changes. Starting them
    // never re-plans (no re-entry).
    void import('@/lib/access/readPlanSync').then((sync) => sync.startReadPlanSync()).catch(() => undefined)
    if (!followingPlatformConfig) {
      followingPlatformConfig = true
      onPlatformConfigChange(() => replanHolidayBookings())
    }
    // Review of #356 (final, S4): superseded means a newer load (or a sign-out) started — never "this load freed its
    // own in-flight slot", so the post-success check below still runs.
    const superseded = () => holidayLoadToken !== token
    const releaseSlot = () => {
      if (holidayInFlight?.token === token) holidayInFlight = null
    }
    await holidayListeners.switchesReady()
    // A newer load (another company, user or plan) or a company switch took over while the switches were read.
    if (superseded()) return waitForNewerLoad(token)
    if (!holidayResultCurrent(organizationId, captured)) {
      // Review of #356 (final, S1): the company switched while the switches were read. Free the slot so switching back
      // plans again, and leave no "loading" behind.
      releaseSlot()
      // Another company's planned key must not stand in for this one on the way back (review of #356).
      holidayPlannedKey = null
      useHolidayStore.setState({ loading: false })
      return
    }
    const onDocs = (docs: OrgCollectionDoc[], meta?: { authoritative: boolean }) => {
      if (!liveResultStillCurrent(organizationId)) return
      const bookings = docs
        .map((entry) => mapHolidayBooking(entry.id, entry.data, organizationId))
        .filter((item): item is HolidayBooking => item !== null)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      const previous = holidayOrgId === organizationId ? useHolidayStore.getState().bookings : []
      const kept = retainScopedRows(`holidayBookings:${organizationId}`, previous, bookings, meta)
      holidayOrgId = organizationId
      useHolidayStore.setState({ bookings: kept, loading: false, error: null, loadedOrgId: organizationId })
    }
    // Rulebook 1.56.0 (`leaveQueryPlan`): with `operativeOwnLeave` on, an operative listens only to their own leave —
    // never the whole collection; everyone else (and everyone while the switch is off) keeps the whole collection.
    const userId = useAuthStore.getState().user?.id ?? null
    const parts = currentLeavePlanParts(organizationId)
    const key = leavePlanKey(parts)
    holidayInFlight = { token, orgId: organizationId, userId, key }
    // Review of #356: never keep another user's rows, or a whole company's rows once the plan narrows.
    if ((holidayPlannedUserId !== null && holidayPlannedUserId !== userId) || (holidayPlannedKey === 'all' && key !== 'all')) {
      clearHolidayRows()
    }
    holidayPlannedKey = null
    let failed = false
    let failureRecorded = false
    try {
      if (parts === null) {
        holidayListeners.unsubscribePlan(HOLIDAY_LISTENER_KEY)
        await holidayListeners.subscribeCollectionLoaded(HOLIDAY_LISTENER_KEY, organizationId, 'holidayBookings', onDocs)
      } else {
        holidayListeners.unsubscribeCollection(HOLIDAY_LISTENER_KEY)
        let failure: { message: string } | null = null
        await holidayListeners.subscribePlan(HOLIDAY_LISTENER_KEY, organizationId, 'holidayBookings', parts, onDocs, (error) => {
          failure = error
          // An older load's listener never records a failure or shows an error once a newer load started.
          if (superseded()) return
          // Review of #356 (final, S3): at most one failure per load, however many query parts are refused.
          if (!failureRecorded) recordHolidayFailure(organizationId, userId, key)
          failureRecorded = true
          // Review of #356: a later listener error (e.g. a refusal once the Phase B rules are on) reaches the screen
          // too, not only the first load's.
          if (holidayResultCurrent(organizationId, captured)) {
            holidayPlannedKey = null
            useHolidayStore.setState({ error: error.message || 'Failed to load annual leave', loading: false })
          }
        })
        if (failure) throw failure
        if (parts.length === 0 && holidayResultCurrent(organizationId, captured)) {
          holidayOrgId = organizationId
          useHolidayStore.setState({ bookings: [], loading: false, error: null, loadedOrgId: organizationId })
        }
      }
    } catch (error: unknown) {
      failed = true
      if (!superseded() && holidayResultCurrent(organizationId, captured)) {
        useHolidayStore.setState({
          error: error instanceof Error ? error.message : (error as { message?: string })?.message || 'Failed to load annual leave',
          loading: false,
          loadedOrgId: organizationId,
        })
      }
    } finally {
      if (!superseded()) {
        // Always free the in-flight slot, also after a company switch, so switching back re-plans (review of #356).
        releaseSlot()
        if (failed) {
          // `failure` from the error callback was recorded there; a thrown refusal is recorded here.
          if (!failureRecorded) recordHolidayFailure(organizationId, userId, key)
        } else if (holidayResultCurrent(organizationId, captured)) {
          // The plan counts as running only after a successful subscribe in the company still open (a refused one
          // is retried with backoff; one that finished after a company switch is planned again on the way back).
          holidayPlannedKey = key
          holidayPlannedUserId = userId
          clearHolidayFailuresFor(organizationId, userId)
        }
      }
    }
    if (superseded()) return waitForNewerLoad(token)
    if (!holidayResultCurrent(organizationId, captured)) {
      // The company switched during the subscribe: leave no "loading" behind (as when it switches earlier).
      useHolidayStore.setState({ loading: false })
      return
    }
    if (failed) return
    useHolidayStore.setState({ loading: false })
    // The inputs may have changed while this load was in progress (re-plans were skipped): check once more.
    replanHolidayBookings()
}

export { newUuid as newHolidayId }

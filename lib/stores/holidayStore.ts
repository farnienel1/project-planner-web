'use client'

import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import {
  holidayDecisionWriteFields,
  holidayRequestWriteFields,
  normalizeHolidayStatus,
  normalizeHolidayTimeSlot,
  parseHolidayDecisionNote,
  writeMetadataFields,
} from '@/lib/canonical'
import { withAuthReadRetry } from '@/lib/firebase/waitForAuthToken'
import type { HolidayBooking, HolidayStatus, HolidayTimeSlot } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'

function parseHolidayStatus(value: unknown): HolidayStatus {
  return normalizeHolidayStatus(value)
}

function parseHolidayTimeSlot(value: unknown): HolidayTimeSlot {
  return normalizeHolidayTimeSlot(value)
}

/** `updatedBy` / `updatedFrom` + server `updatedAt` on every holiday write. */
function holidayWriteMetadata() {
  return { ...(writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}), updatedAt: serverTimestamp() }
}

export function mapHolidayBooking(docId: string, data: Record<string, unknown>, orgId: string): HolidayBooking | null {
  const startDate = parseFirestoreDate(data.startDate)
  const endDate = parseFirestoreDate(data.endDate)
  if (!startDate || !endDate) return null

  return {
    id: parseUuid(data.id, docId),
    organizationId: parseString(data.organizationId, orgId),
    userId: parseOptionalString(data.userId),
    operativeId: parseOptionalString(data.operativeId),
    startDate,
    endDate,
    status: parseHolidayStatus(data.status),
    timeSlot: parseHolidayTimeSlot(data.timeSlot),
    approvedByUserId: parseOptionalString(data.approvedByUserId),
    approvedAt: parseFirestoreDate(data.approvedAt),
    cancellationRequestedAt: parseFirestoreDate(data.cancellationRequestedAt),
    cancellationRequestedByUserId: parseOptionalString(data.cancellationRequestedByUserId),
    decisionNote: parseHolidayDecisionNote(data.decisionNote) ?? undefined,
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

export const useHolidayStore = create<HolidayState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  loadedOrgId: null,

  loadBookings: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'holidayBookings')
      const snapshot = await withAuthReadRetry(() => getDocs(ref))
      const bookings = snapshot.docs
        .map((entry) => mapHolidayBooking(entry.id, entry.data() as Record<string, unknown>, organizationId))
        .filter((item): item is HolidayBooking => item !== null)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      const previous = holidayOrgId === organizationId ? get().bookings : []
      const kept = retainScopedRows(`holidayBookings:${organizationId}`, previous, bookings)
      holidayOrgId = organizationId
      set({ bookings: kept, loading: false, loadedOrgId: organizationId })
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load holiday bookings',
        loading: false,
        loadedOrgId: organizationId,
      })
    }
  },

  saveBooking: async (organizationId, booking) => {
    const id = booking.id || newUuid()
    const payload = holidayPayload({ ...booking, id, updatedAt: new Date() })
    await setDoc(
      doc(db, 'organizations', organizationId, 'holidayBookings', id),
      { ...payload, ...holidayWriteMetadata() },
      { merge: true }
    )
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
    set({ bookings: get().bookings.filter((b) => b.id !== id) })
  },

  createRequests: async (organizationId, requests, timeZone) => {
    const saved: HolidayBooking[] = []
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
      await setDoc(doc(db, 'organizations', organizationId, 'holidayBookings', id), payload, { merge: true })
      const mapped = mapHolidayBooking(
        id,
        { ...payload, updatedAt: Timestamp.fromDate(now) } as unknown as Record<string, unknown>,
        organizationId
      )
      if (mapped) saved.push(mapped)
    }
    if (saved.length > 0) {
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

export { newUuid as newHolidayId }

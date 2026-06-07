'use client'

import { create } from 'zustand'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { HolidayBooking, HolidayStatus, HolidayTimeSlot } from '@/types'
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'

function parseHolidayStatus(value: unknown): HolidayStatus {
  const raw = parseString(value, 'pending')
  return raw === 'approved' || raw === 'rejected' || raw === 'pending' ? raw : 'pending'
}

function parseHolidayTimeSlot(value: unknown): HolidayTimeSlot {
  const raw = parseString(value, 'FULL DAY')
  return raw === 'AM' || raw === 'PM' || raw === 'FULL DAY' ? raw : 'FULL DAY'
}

function mapHolidayBooking(docId: string, data: Record<string, unknown>, orgId: string): HolidayBooking | null {
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
    createdAt: Timestamp.fromDate(booking.createdAt),
    updatedAt: Timestamp.fromDate(booking.updatedAt),
  }
}

interface HolidayState {
  bookings: HolidayBooking[]
  loading: boolean
  error: string | null
  loadBookings: (organizationId: string) => Promise<void>
  saveBooking: (organizationId: string, booking: HolidayBooking) => Promise<void>
  deleteBooking: (organizationId: string, id: string) => Promise<void>
}

export const useHolidayStore = create<HolidayState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,

  loadBookings: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'holidayBookings')
      const snapshot = await getDocs(ref)
      const bookings = snapshot.docs
        .map((entry) => mapHolidayBooking(entry.id, entry.data() as Record<string, unknown>, organizationId))
        .filter((item): item is HolidayBooking => item !== null)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      set({ bookings, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load holiday bookings', loading: false })
    }
  },

  saveBooking: async (organizationId, booking) => {
    const id = booking.id || newUuid()
    const payload = holidayPayload({ ...booking, id, updatedAt: new Date() })
    await setDoc(doc(db, 'organizations', organizationId, 'holidayBookings', id), payload, { merge: true })
    const mapped = mapHolidayBooking(id, payload as unknown as Record<string, unknown>, organizationId)
    if (!mapped) return
    const { bookings } = get()
    set({
      bookings: [...bookings.filter((b) => b.id !== id), mapped].sort((a, b) => b.startDate.getTime() - a.startDate.getTime()),
    })
  },

  deleteBooking: async (organizationId, id) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'holidayBookings', id))
    set({ bookings: get().bookings.filter((b) => b.id !== id) })
  },
}))

export { newUuid as newHolidayId }

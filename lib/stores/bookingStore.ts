'use client'

import { create } from 'zustand'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { forgetOrgCollectionDoc, isOrgCollectionSubscribed, subscribeOrgCollection } from '@/lib/firebase/subscribeOrgCollection'
import { captureOrganizationContext, organizationContextStillCurrent } from '@/lib/canonical'
import { organizationIdsMatch } from '@/lib/orgMembership/webActiveOrg'
import { retainParsedRows } from '@/lib/staff/rosterRetain'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import { londonMidnight } from '@/lib/ios-parity/londonTime'
import { logSkippedDocument, parseBooking, serializeBooking } from '@/lib/ios-parity/converters'
import type { Booking } from '@/types'

interface BookingState {
  bookings: Booking[]
  loading: boolean
  ready: boolean
  error: string | null
  loadBookings: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
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

  loadBookings: async (organizationId: string) => {
    if (!organizationId || !db) return
    const current = get().bookings
    const foreign =
      current.length > 0 &&
      current.every((row) => row.organizationId && !organizationIdsMatch(row.organizationId, organizationId))
    const already = isOrgCollectionSubscribed('bookings', organizationId)
    if (foreign) set({ bookings: [], loading: true, ready: false, error: null })
    else if (already || current.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    subscribeOrgCollection('bookings', organizationId, 'bookings', (docs) => {
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
    })
  },

  createBooking: async (bookingData) => {
    const firestore = requireDb()
    const organizationId = bookingData.organizationId?.trim() || ''
    if (!organizationId) throw new Error('Missing organisation for booking')
    const id = (bookingData.id?.trim() || newUppercaseUuid()).toUpperCase()
    const now = new Date()
    const booking: Booking = {
      ...bookingData,
      id,
      date: londonMidnight(bookingData.date instanceof Date ? bookingData.date : new Date(bookingData.date)),
      createdAt: now,
      updatedAt: now,
      organizationId,
    }
    const payload = serializeBooking(booking)
    const captured = captureOrganizationContext()
    await setDoc(doc(firestore, 'organizations', organizationId, 'bookings', id), payload, { merge: true })
    if (!organizationContextStillCurrent(organizationId, captured)) return
    const { bookings } = get()
    if (!bookings.some((row) => row.id === id)) {
      set({ bookings: [...bookings, booking] })
    }
  },

  updateBooking: async (id, updates) => {
    const firestore = requireDb()
    const { bookings } = get()
    const booking = bookings.find((row) => row.id === id)
    if (!booking) return
    const organizationId = booking.organizationId || ''
    if (!organizationId) throw new Error('Missing organisation for booking')
    const next: Booking = {
      ...booking,
      ...updates,
      id,
      date: londonMidnight((updates.date as Date | undefined) || booking.date),
      updatedAt: new Date(),
    }
    const payload = serializeBooking(next)
    const captured = captureOrganizationContext()
    await setDoc(doc(firestore, 'organizations', organizationId, 'bookings', id), payload, { merge: true })
    if (!organizationContextStillCurrent(organizationId, captured)) return
    set({
      bookings: get().bookings.map((row) => (row.id === id ? next : row)),
    })
  },

  deleteBooking: async (id, organizationId) => {
    const firestore = requireDb()
    const { bookings } = get()
    try {
      await deleteDoc(doc(firestore, 'organizations', organizationId, 'bookings', id))
      forgetOrgCollectionDoc('bookings', organizationId, id)
      set({ bookings: bookings.filter((row) => row.id !== id) })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete booking' })
      throw error
    }
  },

  getBookingsForDate: (date: Date) => {
    const target = londonMidnight(date)
    return get().bookings.filter((booking) => {
      const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
      return londonMidnight(bookingDate).getTime() === target.getTime()
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

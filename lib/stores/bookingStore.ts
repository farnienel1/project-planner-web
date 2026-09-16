'use client'

import { create } from 'zustand'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { isOrgCollectionSubscribed, subscribeOrgCollection } from '@/lib/firebase/subscribeOrgCollection'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import { logSkippedDocument, parseBooking, serializeBooking } from '@/lib/ios-parity/converters'
import type { Booking } from '@/types'

interface BookingState {
  bookings: Booking[]
  loading: boolean
  error: string | null
  loadBookings: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>
  deleteBooking: (id: string, organizationId: string) => Promise<void>
  getBookingsForDate: (date: Date) => Booking[]
  getBookingsForOperative: (operativeId: string, date: Date) => Booking[]
  checkConflict: (operativeId: string, date: Date, timeSlot: string) => Booking | null
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,

  loadBookings: async (organizationId: string) => {
    if (!organizationId || !db) return
    if (isOrgCollectionSubscribed('bookings', organizationId)) {
      set({ loading: false })
      return
    }
    set({ loading: true, error: null })
    subscribeOrgCollection('bookings', organizationId, 'bookings', (docs) => {
      const bookings: Booking[] = []
      for (const entry of docs) {
        const parsed = parseBooking(entry.id, entry.data, organizationId)
        if (parsed.ok) bookings.push(parsed.value)
        else logSkippedDocument('bookings', entry.id, parsed.errors)
      }
      set({ bookings, loading: false })
    }, (error) => {
      set({ error: error.message, loading: false })
    })
  },

  createBooking: async (bookingData) => {
    const organizationId = bookingData.organizationId || ''
    const id = bookingData.id?.trim() || newUppercaseUuid()
    const now = new Date()
    const booking: Booking = {
      ...bookingData,
      id,
      createdAt: now,
      updatedAt: now,
      organizationId,
    }
    const payload = serializeBooking(booking)
    await setDoc(doc(db, 'organizations', organizationId, 'bookings', id), payload, { merge: true })
    const { bookings } = get()
    if (!bookings.some((row) => row.id === id)) {
      set({ bookings: [...bookings, booking] })
    }
  },

  updateBooking: async (id, updates) => {
    const { bookings } = get()
    const booking = bookings.find((row) => row.id === id)
    if (!booking) return
    const organizationId = booking.organizationId || ''
    const next: Booking = { ...booking, ...updates, id, updatedAt: new Date() }
    const payload = serializeBooking(next)
    await setDoc(doc(db, 'organizations', organizationId, 'bookings', id), payload, { merge: true })
    set({
      bookings: bookings.map((row) => (row.id === id ? next : row)),
    })
  },

  deleteBooking: async (id, organizationId) => {
    const { bookings } = get()
    try {
      await deleteDoc(doc(db, 'organizations', organizationId, 'bookings', id))
      set({ bookings: bookings.filter((row) => row.id !== id) })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete booking' })
      throw error
    }
  },

  getBookingsForDate: (date: Date) => {
    const dateStr = date.toDateString()
    return get().bookings.filter((booking) => {
      const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
      return bookingDate.toDateString() === dateStr
    })
  },

  getBookingsForOperative: (operativeId: string, date: Date) => {
    const dateStr = date.toDateString()
    return get().bookings.filter((booking) => {
      const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
      return booking.operativeId === operativeId && bookingDate.toDateString() === dateStr
    })
  },

  checkConflict: (operativeId: string, date: Date, timeSlot: string) => {
    const dateStr = date.toDateString()
    return (
      get().bookings.find((booking) => {
        const bookingDate = booking.date instanceof Date ? booking.date : new Date(booking.date)
        return (
          booking.operativeId === operativeId &&
          bookingDate.toDateString() === dateStr &&
          (booking.timeSlot === timeSlot || booking.timeSlot === 'FULL DAY' || timeSlot === 'FULL DAY')
        )
      }) || null
    )
  },
}))

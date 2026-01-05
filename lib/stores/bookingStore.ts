'use client'

import { create } from 'zustand'
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { Booking } from '@/types'

interface BookingState {
  bookings: Booking[]
  loading: boolean
  error: string | null
  loadBookings: (organizationId: string) => Promise<void>
  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
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
    set({ loading: true, error: null })
    try {
      const bookingsRef = collection(db, 'organizations', organizationId, 'bookings')
      const snapshot = await getDocs(bookingsRef)
      const bookings = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          operativeId: data.operativeId || '',
          projectId: data.projectId || '',
          date: data.date?.toDate() || new Date(),
          timeSlot: data.timeSlot || '',
          bookedBy: data.bookedBy || '',
          notes: data.notes || '',
          status: data.status || 'confirmed',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Booking
      })
      set({ bookings, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },
  
  createBooking: async (bookingData) => {
    const { bookings } = get()
    const organizationId = bookingData.organizationId || ''
    
    try {
      const bookingsRef = collection(db, 'organizations', organizationId, 'bookings')
      const newBooking = {
        ...bookingData,
        date: Timestamp.fromDate(new Date(bookingData.date)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const docRef = await addDoc(bookingsRef, newBooking)
      set({ 
        bookings: [...bookings, { ...bookingData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as Booking]
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  updateBooking: async (id, updates) => {
    const { bookings } = get()
    const booking = bookings.find(b => b.id === id)
    if (!booking) return
    
    const organizationId = booking.organizationId || ''
    
    try {
      const bookingRef = doc(db, 'organizations', organizationId, 'bookings', id)
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      }
      if (updates.date) {
        updateData.date = Timestamp.fromDate(new Date(updates.date))
      }
      await updateDoc(bookingRef, updateData)
      set({ 
        bookings: bookings.map(b => 
          b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
        )
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  deleteBooking: async (id, organizationId) => {
    const { bookings } = get()
    try {
      const bookingRef = doc(db, 'organizations', organizationId, 'bookings', id)
      await deleteDoc(bookingRef)
      set({ bookings: bookings.filter(b => b.id !== id) })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  getBookingsForDate: (date: Date) => {
    const { bookings } = get()
    const dateStr = date.toDateString()
    return bookings.filter(b => {
      const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
      return bookingDate.toDateString() === dateStr
    })
  },
  
  getBookingsForOperative: (operativeId: string, date: Date) => {
    const { bookings } = get()
    const dateStr = date.toDateString()
    return bookings.filter(b => {
      const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
      return b.operativeId === operativeId && bookingDate.toDateString() === dateStr
    })
  },
  
  checkConflict: (operativeId: string, date: Date, timeSlot: string) => {
    const { bookings } = get()
    const dateStr = date.toDateString()
    return bookings.find(b => {
      const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
      return b.operativeId === operativeId && 
        bookingDate.toDateString() === dateStr &&
        (b.timeSlot === timeSlot || b.timeSlot === 'FULL DAY' || timeSlot === 'FULL DAY')
    }) || null
  },
}))

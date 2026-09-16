'use client'

import { create } from 'zustand'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { startOfDay } from 'date-fns'
import { db } from '@/lib/firebase/config'
import { isOrgCollectionSubscribed, subscribeOrgCollection } from '@/lib/firebase/subscribeOrgCollection'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import {
  logSkippedDocument,
  parseManagerSiteBooking,
  serializeManagerSiteBooking,
} from '@/lib/ios-parity/converters'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'

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
  loadManagerSiteBookings: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  saveManagerSiteBooking: (organizationId: string, booking: SaveManagerSiteBookingInput) => Promise<void>
  deleteManagerSiteBooking: (organizationId: string, bookingId: string) => Promise<void>
}

export const useManagerScheduleStore = create<ManagerScheduleState>((set, get) => ({
  managerSiteBookings: [],
  loading: false,
  error: null,

  loadManagerSiteBookings: async (organizationId: string) => {
    if (!organizationId || !db) return
    const already = isOrgCollectionSubscribed('managerSiteBookings', organizationId)
    if (already || get().managerSiteBookings.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    subscribeOrgCollection(
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
        set({ managerSiteBookings, loading: false })
      },
      (error) => set({ error: error.message, loading: false })
    )
  },

  saveManagerSiteBooking: async (organizationId: string, booking: SaveManagerSiteBookingInput) => {
    const id = newUppercaseUuid()
    const now = new Date()
    const next: ManagerSiteBooking = {
      id,
      userId: booking.userId,
      date: startOfDay(booking.date),
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
    await setDoc(doc(db, 'organizations', organizationId, 'managerSiteBookings', id), payload, { merge: true })
    set({ managerSiteBookings: [...get().managerSiteBookings, next] })
  },

  deleteManagerSiteBooking: async (organizationId: string, bookingId: string) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'managerSiteBookings', bookingId))
    set({
      managerSiteBookings: get().managerSiteBookings.filter((booking) => booking.id !== bookingId),
    })
  },
}))

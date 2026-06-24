'use client'

import { create } from 'zustand'
import { addDoc, collection, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { startOfDay } from 'date-fns'
import { db } from '@/lib/firebase/config'
import { sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
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
  loadManagerSiteBookings: (organizationId: string) => Promise<void>
  saveManagerSiteBooking: (organizationId: string, booking: SaveManagerSiteBookingInput) => Promise<void>
  deleteManagerSiteBooking: (organizationId: string, bookingId: string) => Promise<void>
}

function parseLocationType(value: unknown): ManagerLocationType {
  const raw = String(value || 'project')
  if (
    raw === 'project' ||
    raw === 'small_work' ||
    raw === 'office' ||
    raw === 'working_from_home' ||
    raw === 'site_survey' ||
    raw === 'custom'
  ) {
    return raw
  }
  return 'project'
}

export const useManagerScheduleStore = create<ManagerScheduleState>((set, get) => ({
  managerSiteBookings: [],
  loading: false,
  error: null,

  loadManagerSiteBookings: async (organizationId: string) => {
    set({ loading: true, error: null })
    try {
      const snapshot = await getDocs(
        collection(db, 'organizations', organizationId, 'managerSiteBookings')
      )
      const managerSiteBookings: ManagerSiteBooking[] = []
      for (const entry of snapshot.docs) {
        const data = entry.data()
        const userId = String(data.userId || '')
        const date = data.date?.toDate?.() as Date | undefined
        const timeSlot = String(data.timeSlot || '')
        if (!userId || !date || !timeSlot) continue

        managerSiteBookings.push({
          id: entry.id,
          userId,
          date,
          timeSlot,
          locationType: parseLocationType(data.locationType),
          locationId: typeof data.locationId === 'string' ? data.locationId : undefined,
          customLocationName:
            typeof data.customLocationName === 'string' ? data.customLocationName : undefined,
          workStartTime: typeof data.workStartTime === 'string' ? data.workStartTime : undefined,
          workEndTime: typeof data.workEndTime === 'string' ? data.workEndTime : undefined,
          isBreakRemoved: data.isBreakRemoved === true,
          bookingGroupId: typeof data.bookingGroupId === 'string' ? data.bookingGroupId : undefined,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          organizationId,
        })
      }

      set({ managerSiteBookings, loading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load manager schedule'
      set({ error: message, loading: false })
    }
  },

  saveManagerSiteBooking: async (organizationId: string, booking: SaveManagerSiteBookingInput) => {
    const payload = sanitizeForFirestore({
      userId: booking.userId,
      date: Timestamp.fromDate(startOfDay(booking.date)),
      timeSlot: booking.timeSlot,
      locationType: booking.locationType,
      locationId: booking.locationId ?? null,
      customLocationName: booking.customLocationName ?? null,
      workStartTime: booking.workStartTime ?? null,
      workEndTime: booking.workEndTime ?? null,
      isBreakRemoved: booking.isBreakRemoved === true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    await addDoc(collection(db, 'organizations', organizationId, 'managerSiteBookings'), payload)
    await get().loadManagerSiteBookings(organizationId)
  },

  deleteManagerSiteBooking: async (organizationId: string, bookingId: string) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'managerSiteBookings', bookingId))
    await get().loadManagerSiteBookings(organizationId)
  },
}))

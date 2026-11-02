'use client'

import { useEffect } from 'react'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'

/**
 * A screen showing a day or week before the launch download (an earlier week on My Schedule,
 * a past day on Daily Overview) asks the booking listeners to start from that day.
 * "Show past" lists every earlier booking, so it asks for full history.
 * Canonical `bookingLoadStart` decides whether that moves the start earlier; it never moves later.
 */
export function useBookingHistoryFrom(
  organizationId: string | null | undefined,
  from: Date | null | undefined,
  options?: { fullHistory?: boolean }
): void {
  const fromDayKey = from && !Number.isNaN(from.getTime()) ? dayKey(from) : ''
  const fullHistory = options?.fullHistory === true
  useEffect(() => {
    if (!organizationId || (!fromDayKey && !fullHistory)) return
    const request = fullHistory ? { fullHistory: true } : { fromDayKey }
    void useBookingStore.getState().loadBookings(organizationId, request)
    void useManagerScheduleStore.getState().loadManagerSiteBookings(organizationId, request)
  }, [organizationId, fromDayKey, fullHistory])
}

/**
 * Default required-delivery instant for a material order, and whether a send
 * includes that instant. Quotes never include a day or time — the template
 * asks the wholesaler to confirm availability and time.
 *
 * The default is tomorrow 08:00 in the organisation zone. If the user opens
 * Send on Saturday or Sunday, it is the next Monday 08:00. The materials-list
 * day is not the delivery day.
 */

import {
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  isoWeekdayInZone,
  partsInZone,
} from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { formatClockMinutes } from './engine'

export const DEFAULT_MATERIAL_DELIVERY_HOUR = 8
export const DEFAULT_MATERIAL_DELIVERY_MINUTE = 0
export const DEFAULT_MATERIAL_DELIVERY_CLOCK = '08:00'
export const DEFAULT_MATERIAL_DELIVERY_MINUTES =
  DEFAULT_MATERIAL_DELIVERY_HOUR * 60 + DEFAULT_MATERIAL_DELIVERY_MINUTE

export type MaterialSendKind = 'quote' | 'order'

/** Orders carry a required day and time. Quotes never do. */
export function materialOrderIncludesDeliveryRequired(requestType: string | null | undefined): boolean {
  return String(requestType || '').trim().toLowerCase() === 'order'
}

/**
 * Coverage day for the default required delivery.
 * Saturday → Monday. Sunday → Monday. Any other day → tomorrow.
 */
export function defaultMaterialDeliveryDayKey(referenceIso: string, timeZone?: string | null): string {
  const zone = zoneOrLondon(timeZone)
  const now = new Date(referenceIso)
  if (Number.isNaN(now.getTime())) {
    return dayKeyInZone(new Date(), zone)
  }
  const weekday = isoWeekdayInZone(now, zone)
  const daysAhead = weekday === 6 ? 2 : 1
  return dayKeyInZone(addDaysInZone(now, daysAhead, zone), zone)
}

export function materialDeliveryInstant(
  dayKey: string,
  clockMinutes: number,
  timeZone?: string | null
): Date {
  const zone = zoneOrLondon(timeZone)
  const midnight = dateFromDayKeyInZone(dayKey, zone)
  const clamped = Math.max(0, Math.min(Math.round(clockMinutes), 24 * 60))
  return new Date(midnight.getTime() + clamped * 60_000)
}

export function defaultMaterialDeliveryRequiredAt(referenceIso: string, timeZone?: string | null): Date {
  return materialDeliveryInstant(
    defaultMaterialDeliveryDayKey(referenceIso, timeZone),
    DEFAULT_MATERIAL_DELIVERY_MINUTES,
    timeZone
  )
}

export function clockMinutesFromDeliveryInstant(at: Date, timeZone?: string | null): number {
  const zone = zoneOrLondon(timeZone)
  const parts = partsInZone(at, zone)
  return parts.h * 60 + parts.min
}

export function formatMaterialDeliveryRequired(at: Date, timeZone?: string | null): string {
  const zone = zoneOrLondon(timeZone)
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(at)
  return `${day} at ${formatClockMinutes(clockMinutesFromDeliveryInstant(at, zone))}`
}

/**
 * iOS parity: Core/PayrollRateResolver.swift
 * Explicit history, including £0, wins over live roster rates.
 * PAYE days always return nil amounts while still showing hours in the UI.
 */
import type { Operative, User } from '@/types'
import { employmentTypeOnDay } from '@/lib/ios-parity/employmentType'
import { londonMidnight } from '@/lib/ios-parity/londonTime'
import {
  emptyDayRateHistory,
  mergedDayRateEntries,
  type OperativeDayRateHistoryCollection,
} from '@/lib/timesheets/dayRateHistoryStorage'

export type PayrollRateBasis = 'dayRate' | 'hourly'

export type ResolvedPayrollRate = {
  basis: PayrollRateBasis
  dayRate: number | null
  hourlyRate: number | null
}

export function payrollRateHasValue(resolved: ResolvedPayrollRate): boolean {
  return resolved.basis === 'dayRate' ? resolved.dayRate != null : resolved.hourlyRate != null
}

export function payrollBasis(user?: User | null, operative?: Operative | null): PayrollRateBasis {
  if (user) {
    if (user.dayRate != null) return 'dayRate'
    if (user.hourlyRate != null) return 'hourly'
  }
  if (operative) {
    if (operative.dayRate != null) return 'dayRate'
    if (operative.hourlyRate != null) return 'hourly'
  }
  return 'dayRate'
}

export function payForHours(
  resolved: ResolvedPayrollRate,
  paidHours: number,
  standardDayHours: number,
  otMultiplier = 1
): number {
  if (paidHours <= 0) return 0
  if (resolved.basis === 'hourly') {
    return (resolved.hourlyRate ?? 0) * paidHours * otMultiplier
  }
  return (resolved.dayRate ?? 0) * (paidHours / Math.max(standardDayHours, 0.01)) * otMultiplier
}

export function overtimeDisplayRates(
  resolved: ResolvedPayrollRate,
  otMultiplier: number
): { dayRate: number; hourlyRate: number | null } {
  if (resolved.basis === 'hourly') {
    return { dayRate: 0, hourlyRate: (resolved.hourlyRate ?? 0) * otMultiplier }
  }
  return { dayRate: (resolved.dayRate ?? 0) * otMultiplier, hourlyRate: resolved.hourlyRate }
}

/** Last history entry whose effectiveAt calendar day is on or before `day`. `0` is valid. */
export function rateFromHistory(
  history: OperativeDayRateHistoryCollection,
  userId: string | undefined,
  operativeId: string | undefined,
  day: Date,
  timeZone?: string
): number | null {
  const merged = mergedDayRateEntries(history, userId, operativeId)
  const dayStart = londonMidnight(day, timeZone)
  const match = [...merged].reverse().find((entry) => londonMidnight(entry.effectiveAt, timeZone) <= dayStart)
  return match ? match.dayRate : null
}

export function resolvePayrollRate({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
}): ResolvedPayrollRate {
  const basis = payrollBasis(user, operative)
  const historical = rateFromHistory(history, user?.id, operative?.id, day, timeZone)
  if (historical != null) {
    return basis === 'hourly'
      ? { basis: 'hourly', dayRate: null, hourlyRate: historical }
      : { basis: 'dayRate', dayRate: historical, hourlyRate: null }
  }

  if (basis === 'hourly') {
    if (user?.hourlyRate != null || operative?.hourlyRate != null) {
      return { basis: 'hourly', dayRate: null, hourlyRate: user?.hourlyRate ?? operative?.hourlyRate ?? null }
    }
    const dayRate = user?.dayRate ?? operative?.dayRate
    if (dayRate != null) {
      return { basis: 'hourly', dayRate: null, hourlyRate: dayRate / Math.max(standardDayHours, 0.01) }
    }
    return { basis: 'hourly', dayRate: null, hourlyRate: null }
  }

  if (user?.dayRate != null || operative?.dayRate != null) {
    return { basis: 'dayRate', dayRate: user?.dayRate ?? operative?.dayRate ?? null, hourlyRate: null }
  }
  if (user?.hourlyRate != null || operative?.hourlyRate != null) {
    return { basis: 'hourly', dayRate: null, hourlyRate: user?.hourlyRate ?? operative?.hourlyRate ?? null }
  }
  return { basis: 'dayRate', dayRate: null, hourlyRate: null }
}

/** PAYE days always return zero amounts while still showing hours in the UI. */
export function resolveForTimesheetDay({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
}): ResolvedPayrollRate {
  if (user && employmentTypeOnDay(user, day, timeZone) === 'paye') {
    const basis = payrollBasis(user, operative)
    return { basis, dayRate: null, hourlyRate: null }
  }
  return resolvePayrollRate({ user, operative, day, history, standardDayHours, timeZone })
}

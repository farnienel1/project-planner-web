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
  type OperativeDayRateHistoryEntry,
} from '@/lib/timesheets/dayRateHistoryStorage'
import {
  historyRowBasis,
  payForHours as payForHoursContract,
  readStoredRates,
  resolveHistoryPayRow,
  type PayBasis,
  type StoredPay,
} from '@/lib/timesheets/payBasis'

export type PayrollRateBasis = 'dayRate' | 'hourly'

export type ResolvedPayrollRate = {
  basis: PayrollRateBasis
  dayRate: number | null
  hourlyRate: number | null
}

export function payrollRateHasValue(resolved: ResolvedPayrollRate): boolean {
  return resolved.basis === 'dayRate' ? resolved.dayRate != null : resolved.hourlyRate != null
}

function liveStored(user?: User | null, operative?: Operative | null): StoredPay {
  const fromUser = user ? readStoredRates(user) : null
  if (fromUser && (fromUser.dayRate != null || fromUser.hourlyRate != null)) return fromUser
  const fromOperative = operative ? readStoredRates(operative) : null
  if (fromOperative && (fromOperative.dayRate != null || fromOperative.hourlyRate != null)) return fromOperative
  return { payBasis: null, dayRate: null, hourlyRate: null }
}

export function payrollBasis(user?: User | null, operative?: Operative | null): PayrollRateBasis {
  return liveStored(user, operative).payBasis === 'hourly' ? 'hourly' : 'dayRate'
}

export function payForHours(
  resolved: ResolvedPayrollRate,
  paidHours: number,
  standardDayHours: number,
  otMultiplier = 1
): number {
  return payForHoursContract({
    payBasis: resolved.basis === 'hourly' ? 'hourly' : 'day',
    dayRate: resolved.dayRate,
    hourlyRate: resolved.hourlyRate,
    paidHours,
    standardDayHours,
    otMultiplier,
  })
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

function historyMatch(
  history: OperativeDayRateHistoryCollection,
  userIds: string | string[] | null | undefined,
  operativeIds: string | string[] | null | undefined,
  day: Date,
  timeZone: string | undefined,
  livePayBasis: PayBasis | null
): OperativeDayRateHistoryEntry | null {
  const merged = mergedDayRateEntries(history, userIds, operativeIds)
  return resolveHistoryPayRow(merged, day, livePayBasis, (date) => londonMidnight(date, timeZone))
}

/** Last history amount whose effective calendar day is on or before `day`. `0` is valid. */
export function rateFromHistory(
  history: OperativeDayRateHistoryCollection,
  userId: string | string[] | undefined,
  operativeId: string | string[] | undefined,
  day: Date,
  timeZone?: string,
  livePayBasis?: PayBasis | null
): number | null {
  const row = historyMatch(history, userId, operativeId, day, timeZone, livePayBasis ?? null)
  return row ? row.dayRate : null
}

function resolvedFromStored(stored: StoredPay): ResolvedPayrollRate {
  if (stored.payBasis === 'hourly') {
    return { basis: 'hourly', dayRate: null, hourlyRate: stored.hourlyRate }
  }
  return { basis: 'dayRate', dayRate: stored.dayRate, hourlyRate: null }
}

function resolvedFromHistory(row: OperativeDayRateHistoryEntry): ResolvedPayrollRate {
  if (historyRowBasis(row) === 'hourly') {
    return { basis: 'hourly', dayRate: null, hourlyRate: row.dayRate }
  }
  return { basis: 'dayRate', dayRate: row.dayRate, hourlyRate: null }
}

export function resolvePayrollRate({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
  aliasUserIds = [],
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
  aliasUserIds?: string[]
}): ResolvedPayrollRate {
  void standardDayHours
  const live = liveStored(user, operative)
  const userIds = [user?.id, ...aliasUserIds].filter((id): id is string => Boolean(id))
  const operativeIds = operative?.id ? [operative.id] : []
  const row = historyMatch(history, userIds, operativeIds, day, timeZone, live.payBasis)
  if (row) return resolvedFromHistory(row)
  if (live.payBasis === 'hourly') {
    return { basis: 'hourly', dayRate: null, hourlyRate: live.hourlyRate }
  }
  return resolvedFromStored(live.payBasis ? live : { payBasis: 'day', dayRate: live.dayRate, hourlyRate: null })
}

/** PAYE days always return zero amounts while still showing hours in the UI. */
export function resolveForTimesheetDay({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
  aliasUserIds = [],
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
  aliasUserIds?: string[]
}): ResolvedPayrollRate {
  if (user && employmentTypeOnDay(user, day, timeZone) === 'paye') {
    const basis = payrollBasis(user, operative)
    return { basis, dayRate: null, hourlyRate: null }
  }
  return resolvePayrollRate({ user, operative, day, history, standardDayHours, timeZone, aliasUserIds })
}

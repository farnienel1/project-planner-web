/**
 * iOS parity: Core/PayrollRateResolver.swift
 * Explicit history, including £0, wins over live roster rates.
 * PAYE days always return nil amounts while still showing hours in the UI.
 */
import type { Operative, User } from '@/types'
import { dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { livePayRate, payRateOnDay, type PayRateOnDay } from '@/lib/canonical/payRate'
import {
  emptyDayRateHistory,
  mergedDayRateEntries,
  type OperativeDayRateHistoryCollection,
  type OperativeDayRateHistoryEntry,
} from '@/lib/timesheets/dayRateHistoryStorage'
import {
  payForHours as payForHoursContract,
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
  return livePayRate(user, operative)
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

function rateInput({
  user,
  operative,
  day,
  history,
  timeZone,
  aliasUserIds,
  operativeIds: extraOperativeIds = [],
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history: OperativeDayRateHistoryCollection
  timeZone?: string
  aliasUserIds: string[]
  operativeIds?: string[]
}) {
  const userIds = [user?.id, ...aliasUserIds].filter((id): id is string => Boolean(id))
  const operativeIds = [operative?.id, ...extraOperativeIds].filter((id): id is string => Boolean(id))
  return {
    user: user ?? null,
    operative: operative ?? null,
    // Rulebook 1.10.0 (H4): the whole history; `payRateOnDay` matches every id of the person (`personIdSet`).
    history: [...Object.values(history.byUserId).flat(), ...Object.values(history.byOperativeId).flat()],
    person: user
      ? { id: user.id, email: user.email ?? null, formerUserIds: user.formerUserIds ?? [], sameEmailUserIds: aliasUserIds }
      : null,
    userIds,
    operativeIds,
    dayKey: dayKey(day, timeZone),
    timeZone,
  }
}

function resolvedFromCanonical(rate: PayRateOnDay): ResolvedPayrollRate {
  if (rate.isPaye) return { basis: rate.payBasis === 'hourly' ? 'hourly' : 'dayRate', dayRate: null, hourlyRate: null }
  if (rate.payBasis === 'hourly') return { basis: 'hourly', dayRate: null, hourlyRate: rate.rate }
  return { basis: 'dayRate', dayRate: rate.rate, hourlyRate: null }
}

/** Rate in effect on the day, ignoring PAYE (`payRateOnDay` without the employment rule). */
export function resolvePayrollRate({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
  aliasUserIds = [],
  operativeIds = [],
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
  aliasUserIds?: string[]
  /** 1.36.0 (FU-5): every `operatives` row of the person (`personRateHistoryIds`), beside `operative`. */
  operativeIds?: string[]
}): ResolvedPayrollRate {
  void standardDayHours
  const input = rateInput({ user, operative, day, history, timeZone, aliasUserIds, operativeIds })
  // Rate lookup only: the employment rule is applied by `resolveForTimesheetDay` / the caller.
  const withoutEmployment = input.user
    ? { ...input.user, employmentType: 'self_employed', employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null }
    : null
  return resolvedFromCanonical(payRateOnDay({ ...input, user: withoutEmployment }))
}

/** `payRateOnDay`: PAYE days return no amount while still showing hours in the UI. */
export function resolveForTimesheetDay({
  user,
  operative,
  day,
  history = emptyDayRateHistory(),
  standardDayHours = 8,
  timeZone,
  aliasUserIds = [],
  operativeIds = [],
}: {
  user?: User | null
  operative?: Operative | null
  day: Date
  history?: OperativeDayRateHistoryCollection
  standardDayHours?: number
  timeZone?: string
  aliasUserIds?: string[]
  /** 1.36.0 (FU-5): every `operatives` row of the person (`personRateHistoryIds`), beside `operative`. */
  operativeIds?: string[]
}): ResolvedPayrollRate {
  void standardDayHours
  return resolvedFromCanonical(payRateOnDay(rateInput({ user, operative, day, history, timeZone, aliasUserIds, operativeIds })))
}

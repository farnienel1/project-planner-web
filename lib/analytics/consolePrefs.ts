'use client'

import { create } from 'zustand'
import type { ConsolePeriodId } from '@/lib/analytics/consolePeriod'

const INCLUDE_TEST_KEY = 'pp.ownerConsole.includeTestData'
const PERIOD_KEY = 'pp.ownerConsole.period'
const PERIODS: ConsolePeriodId[] = ['today', 'week', 'month', 'year', 'to_date']

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode: the choice lasts this visit only */
  }
}

type ConsolePrefs = {
  /** Owner console PLAN A8: remembered on this device. */
  includeTestData: boolean
  showFullEmails: boolean
  jumpQuery: string
  /** The one period selector shown on every console page (spec §4). Remembered on this device; This month first. */
  period: ConsolePeriodId
  setIncludeTestData: (value: boolean) => void
  setShowFullEmails: (value: boolean) => void
  setJumpQuery: (value: string) => void
  setPeriod: (value: ConsolePeriodId) => void
}

const storedPeriod = readLocal(PERIOD_KEY) as ConsolePeriodId | null

export const useConsolePrefs = create<ConsolePrefs>((set) => ({
  includeTestData: readLocal(INCLUDE_TEST_KEY) === '1',
  showFullEmails: false,
  jumpQuery: '',
  period: storedPeriod && PERIODS.includes(storedPeriod) ? storedPeriod : 'month',
  setIncludeTestData: (includeTestData) => {
    writeLocal(INCLUDE_TEST_KEY, includeTestData ? '1' : '0')
    set({ includeTestData })
  },
  setShowFullEmails: (showFullEmails) => set({ showFullEmails }),
  setJumpQuery: (jumpQuery) => set({ jumpQuery }),
  setPeriod: (period) => {
    writeLocal(PERIOD_KEY, period)
    set({ period })
  },
}))

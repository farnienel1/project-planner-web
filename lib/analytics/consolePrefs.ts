'use client'

import { create } from 'zustand'

type ConsolePrefs = {
  includeTestData: boolean
  showFullEmails: boolean
  jumpQuery: string
  setIncludeTestData: (value: boolean) => void
  setShowFullEmails: (value: boolean) => void
  setJumpQuery: (value: string) => void
}

export const useConsolePrefs = create<ConsolePrefs>((set) => ({
  includeTestData: false,
  showFullEmails: false,
  jumpQuery: '',
  setIncludeTestData: (includeTestData) => set({ includeTestData }),
  setShowFullEmails: (showFullEmails) => set({ showFullEmails }),
  setJumpQuery: (jumpQuery) => set({ jumpQuery }),
}))

export function isTestRecord(row: { isInternal?: boolean; email?: string; name?: string }): boolean {
  if (row.isInternal) return true
  const blob = `${row.email || ''} ${row.name || ''}`.toLowerCase()
  return /\btest\b|\bstaging\b|@example\.|@test\./.test(blob)
}

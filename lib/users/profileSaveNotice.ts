'use client'

/**
 * A profile save the Edit user screen stopped waiting for (owner bug 17 Nov, `confirmWriteWithin`): the screen returns
 * to the people list as for any save, and the list shows this notice until the server confirms (it then clears) or
 * refuses (it then says so; the live listener already put the stored values back).
 */
import { create } from 'zustand'

export type ProfileSaveNotice = { saveId: number; status: 'pending' | 'refused'; message: string }

type State = {
  notice: ProfileSaveNotice | null
  pending: (saveId: number, name: string) => void
  settled: (saveId: number, outcome: { status: 'saved' } | { status: 'refused'; message: string }, name: string) => void
  dismiss: () => void
}

export function profileSavePendingMessage(name: string): string {
  return `${name}: saved on this device. Waiting for the server to confirm it — keep Project Planner open.`
}

export function profileSaveRefusedMessage(name: string, reason: string): string {
  return `${name}'s changes were not saved: ${reason} Open their profile and try again.`
}

export const useProfileSaveNotice = create<State>((set, get) => ({
  notice: null,
  pending: (saveId, name) => set({ notice: { saveId, status: 'pending', message: profileSavePendingMessage(name) } }),
  settled: (saveId, outcome, name) => {
    if (outcome.status === 'saved') {
      // Only clears its own notice: a newer save's notice stays.
      if (get().notice?.saveId === saveId) set({ notice: null })
      return
    }
    set({ notice: { saveId, status: 'refused', message: profileSaveRefusedMessage(name, outcome.message) } })
  },
  dismiss: () => set({ notice: null }),
}))

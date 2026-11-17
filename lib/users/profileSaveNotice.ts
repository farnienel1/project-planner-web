'use client'

/**
 * A profile save the Edit user screen stopped waiting for (owner bug 17 Nov, `confirmWriteWithin`): the screen returns
 * to the people list as for any save, and the list shows this notice until the server confirms (it then clears),
 * refuses (it then says so; the live listener already put the stored values back) or has still not answered after
 * `WRITE_UNCONFIRMED_AFTER_MS` (it then says the change is not confirmed). A secondary step of the save that fails (the
 * active flag, the job clean-up) is reported here too.
 *
 * Review of #371: the notice belongs to one organisation and one person. It is shown only in that organisation
 * (`profileSaveNoticeFor`) and cleared when another organisation is opened (`keepOnlyOrganization`).
 */
import { create } from 'zustand'

export type ProfileSaveNoticeStatus = 'pending' | 'refused' | 'unconfirmed' | 'failed'

export type ProfileSaveNotice = {
  saveId: number
  organizationId: string
  personId: string
  status: ProfileSaveNoticeStatus
  message: string
}

export type ProfileSaveTarget = { saveId: number; organizationId: string; personId: string; name: string }

type State = {
  notice: ProfileSaveNotice | null
  /** `message` replaces the default "saved on this device" wording (a delete, for example). */
  pending: (target: ProfileSaveTarget, message?: string) => void
  settled: (
    target: ProfileSaveTarget,
    outcome: { status: 'saved' } | { status: 'refused'; message: string } | { status: 'unconfirmed' }
  ) => void
  /** A secondary step of a save failed (the profile itself was saved). */
  failed: (target: ProfileSaveTarget, message: string) => void
  dismiss: () => void
  /** Clears a notice that belongs to another organisation (an organisation switch). */
  keepOnlyOrganization: (organizationId: string | null | undefined) => void
}

export function profileSavePendingMessage(name: string): string {
  return `${name}: saved on this device. Waiting for the server to confirm it — keep Project Planner open.`
}

export function profileSaveRefusedMessage(name: string, reason: string): string {
  return `${name}'s changes were not saved: ${reason} Open their profile and try again.`
}

export function profileSaveUnconfirmedMessage(name: string): string {
  return `${name}: not confirmed. Reload and check this person — your change may not have been saved.`
}

export function profileSaveStepFailedMessage(name: string, step: string, reason: string): string {
  return `${name}'s profile was saved, but ${step} failed: ${reason} Open their profile and check it.`
}

/** The notice to show while `organizationId` is open, or null (never another organisation's). */
export function profileSaveNoticeFor(
  notice: ProfileSaveNotice | null,
  organizationId: string | null | undefined
): ProfileSaveNotice | null {
  if (!notice || !organizationId) return null
  return notice.organizationId === organizationId ? notice : null
}

function noticeOf(target: ProfileSaveTarget, status: ProfileSaveNoticeStatus, message: string): ProfileSaveNotice {
  return { saveId: target.saveId, organizationId: target.organizationId, personId: target.personId, status, message }
}

export const useProfileSaveNotice = create<State>((set, get) => ({
  notice: null,
  pending: (target, message) =>
    set({ notice: noticeOf(target, 'pending', message ?? profileSavePendingMessage(target.name)) }),
  settled: (target, outcome) => {
    const current = get().notice
    const own = current?.saveId === target.saveId
    if (outcome.status === 'saved') {
      // Only clears its own notice: a newer save's notice stays, and so does a failed follow-up step of this save
      // (second review of #371: a step that failed before the last batch was confirmed must not be wiped).
      if (own && current?.status !== 'failed') set({ notice: null })
      return
    }
    if (outcome.status === 'unconfirmed') {
      // Only replaces its own "waiting" notice (a newer save's notice, or a dismissed one, stays as it is).
      if (own && current?.status === 'pending') {
        set({ notice: noticeOf(target, 'unconfirmed', profileSaveUnconfirmedMessage(target.name)) })
      }
      return
    }
    set({ notice: noticeOf(target, 'refused', profileSaveRefusedMessage(target.name, outcome.message)) })
  },
  failed: (target, message) => set({ notice: noticeOf(target, 'failed', message) }),
  dismiss: () => set({ notice: null }),
  keepOnlyOrganization: (organizationId) => {
    const current = get().notice
    if (current && current.organizationId !== organizationId) set({ notice: null })
  },
}))

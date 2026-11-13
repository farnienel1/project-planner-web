/**
 * Rulebook 1.40.0 §4.4 (owner decisions 11 Nov H28–H35): manual annual-leave adjustments — web reads and writes.
 * Every rule is in `@/lib/canonical` (`annualLeaveAdjustments.ts`); this file only turns its fields into Firestore
 * calls. Online only (web has no offline mode). A create, never an update or delete (the security rules allow only a
 * create, by an admin or the person's line manager, never the person).
 */
'use client'

import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot, query, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore'
import {
  ANNUAL_LEAVE_ADJUSTMENTS_COLLECTION,
  annualLeaveAdjustedNoticeText,
  annualLeaveAdjustmentCreateFields,
  parseAnnualLeaveAdjustmentDocument,
  writeMetadataFields,
  type AnnualLeaveAdjustment,
} from '@/lib/canonical'
import { auth, db } from '@/lib/firebase/config'
import { notifyCompanyActivity } from '@/lib/notifications/companyActivity'
import type { User } from '@/types'

/** Live adjustments filed under one person's users id (the only query the rules allow a non-admin). */
export function listenAnnualLeaveAdjustments(
  organizationId: string,
  userId: string,
  onChange: (rows: AnnualLeaveAdjustment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'organizations', organizationId, ANNUAL_LEAVE_ADJUSTMENTS_COLLECTION), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs
          .map((row) => parseAnnualLeaveAdjustmentDocument(row.id, row.data()))
          .filter((row): row is AnnualLeaveAdjustment => row != null)
          .sort((a, b) => (a.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (b.createdAtMs ?? Number.MAX_SAFE_INTEGER))
      ),
    (error) => onError?.(error)
  )
}

/**
 * One person's adjustments, live while the screen is open. Rulebook 1.40.0 (review r306 #9): `loaded` is false until
 * the first answer, and a refused or failed read sets `error` (never an empty list read as "no adjustments"), so a
 * screen shows no balance until the adjustments it includes are known.
 */
export const LEAVE_ADJUSTMENTS_READ_ERROR = 'Could not load the leave adjustments, so the balance is not shown. Try again.'

export function useAnnualLeaveAdjustments(organizationId: string | null | undefined, userId: string | null | undefined): {
  adjustments: AnnualLeaveAdjustment[]
  loaded: boolean
  error: string | null
} {
  const [state, setState] = useState<{ key: string; adjustments: AnnualLeaveAdjustment[]; loaded: boolean; error: string | null }>({
    key: '',
    adjustments: [],
    loaded: false,
    error: null,
  })
  const key = organizationId && userId ? `${organizationId}|${userId}` : ''
  useEffect(() => {
    if (!organizationId || !userId) return undefined
    return listenAnnualLeaveAdjustments(
      organizationId,
      userId,
      (rows) => setState({ key: `${organizationId}|${userId}`, adjustments: rows, loaded: true, error: null }),
      () => setState({ key: `${organizationId}|${userId}`, adjustments: [], loaded: false, error: LEAVE_ADJUSTMENTS_READ_ERROR })
    )
  }, [organizationId, userId])
  return state.key === key
    ? { adjustments: state.adjustments, loaded: state.loaded, error: state.error }
    : { adjustments: [], loaded: false, error: null }
}

/**
 * Adds one adjustment for `subject` in the leave year `yearKey` and tells every admin (`annual_leave_adjusted`).
 * Returns null when the rulebook refuses the input (the screen shows `annualLeaveAdjustmentValidationError` first).
 */
export async function addAnnualLeaveAdjustment(input: {
  organizationId: string
  subject: User
  actor: User
  users: ReadonlyArray<User>
  days: number | string
  reason: string
  yearKey: string
}): Promise<string | null> {
  const actorName = `${input.actor.firstName ?? ''} ${input.actor.surname ?? ''}`.trim() || input.actor.email || ''
  const fields = annualLeaveAdjustmentCreateFields({
    userId: input.subject.id,
    days: input.days,
    reason: input.reason,
    yearKey: input.yearKey,
    createdBy: auth.currentUser?.uid ?? input.actor.id,
    // The screen's current leave year (`annualLeaveBalance.yearKey`) is the only year offered (review r306 #6).
    allowedYearKeys: [input.yearKey],
  })
  if (!fields) return null
  const ref = await addDoc(collection(db, 'organizations', input.organizationId, ANNUAL_LEAVE_ADJUSTMENTS_COLLECTION), {
    ...fields,
    createdAt: serverTimestamp(),
    ...(writeMetadataFields(fields.createdBy, 'web') ?? {}),
    updatedAt: serverTimestamp(),
  })
  const personName = `${input.subject.firstName ?? ''} ${input.subject.surname ?? ''}`.trim() || input.subject.email || ''
  const text = annualLeaveAdjustedNoticeText({ personName, actorName, days: fields.days, reason: fields.reason })
  try {
    await notifyCompanyActivity({
      organizationId: input.organizationId,
      type: 'annual_leave_adjusted',
      title: text.title,
      message: text.message,
      detail: text.detail,
      relatedId: input.subject.id,
      actor: input.actor,
      users: input.users,
    })
  } catch {
    // The adjustment is saved; a notice that fails to write never undoes it.
  }
  return ref.id
}

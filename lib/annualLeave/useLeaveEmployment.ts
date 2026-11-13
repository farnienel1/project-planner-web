'use client'

/**
 * Rulebook 1.40.0 (§4.4, review r306 #2): the employment-type input of a person's leave balance, from the same pay
 * record every other screen uses. While `privatePay` is off for the organisation it is the person's users document as
 * read (nothing else is loaded). While it is on, the person's pay profile (`payProfiles/{id}`, else one of their
 * `formerUserIds`) is read and laid over (`annualLeaveEmploymentInput`), because the employment type is pay data and a
 * stripped users document no longer holds it. A refused read gives `employment: null` (the balance counts the whole
 * year, as before 1.40.0). `ready` is false until the switch and the read have answered: screens show no figure before.
 */
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import {
  PAY_PROFILES_COLLECTION,
  annualLeaveEmploymentInput,
  parsePayProfileDocument,
  type EmploymentTypeUser,
  type PayProfileDocument,
} from '@/lib/canonical'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'

type LeaveEmploymentPerson = {
  id: string
  formerUserIds?: ReadonlyArray<string> | null
  employmentType?: unknown
  employmentTypeTransitionFrom?: unknown
  employmentTypeEffectiveAt?: unknown
}

export type LeaveEmploymentState = { employment: EmploymentTypeUser | null; ready: boolean }

/** Reads one pay profile: `{ read: false }` when the read was refused or failed, `{ read: true, profile }` otherwise. */
async function readPayProfile(
  organizationId: string,
  subjectId: string
): Promise<{ read: boolean; profile: PayProfileDocument | null }> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'organizations', organizationId, PAY_PROFILES_COLLECTION, subjectId))
    return { read: true, profile: snap.exists() ? parsePayProfileDocument(snap.id, snap.data() as Record<string, unknown>) : null }
  } catch {
    return { read: false, profile: null }
  }
}

/** The employment-type fields of `person` from their pay record (see the module comment). */
export async function loadLeaveEmployment(
  organizationId: string | null | undefined,
  person: LeaveEmploymentPerson
): Promise<EmploymentTypeUser | null> {
  const record = person as unknown as Record<string, unknown>
  if (!organizationId) return annualLeaveEmploymentInput({ person: record, privatePay: false, payProfileRead: true })
  await securitySwitchesReady()
  const privatePay = privatePayFor(organizationId)
  if (!privatePay) return annualLeaveEmploymentInput({ person: record, privatePay, payProfileRead: true })
  const ids = [person.id, ...(person.formerUserIds ?? [])].map((id) => String(id || '').trim()).filter(Boolean)
  let readAny = false
  for (const id of ids) {
    const result = await readPayProfile(organizationId, id)
    if (result.read) readAny = true
    if (result.profile) return annualLeaveEmploymentInput({ person: record, payProfile: result.profile, privatePay, payProfileRead: true })
  }
  return annualLeaveEmploymentInput({ person: record, payProfile: null, privatePay, payProfileRead: readAny })
}

export function useLeaveEmployment(
  organizationId: string | null | undefined,
  person: LeaveEmploymentPerson | null | undefined
): LeaveEmploymentState {
  const [state, setState] = useState<LeaveEmploymentState & { key: string }>({ employment: null, ready: false, key: '' })
  const key = person
    ? JSON.stringify([
        organizationId ?? '',
        person.id,
        person.formerUserIds ?? [],
        person.employmentType ?? null,
        person.employmentTypeTransitionFrom ?? null,
        String(person.employmentTypeEffectiveAt ?? ''),
      ])
    : ''
  useEffect(() => {
    if (!person) return
    let cancelled = false
    void loadLeaveEmployment(organizationId, person).then((employment) => {
      if (!cancelled) setState({ employment, ready: true, key })
    })
    return () => {
      cancelled = true
    }
    // `key` covers every field of `person` this reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!person) return { employment: null, ready: false }
  return state.key === key ? { employment: state.employment, ready: state.ready } : { employment: null, ready: false }
}

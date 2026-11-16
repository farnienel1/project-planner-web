/**
 * Pay strip (rulebook §8, 1.26.0–1.27.0): the signed-in person's own record with their pay taken from their pay
 * profile. The session user (`authStore.user`) is parsed from the raw `users/{uid}` document; after the strip that
 * document holds no `employmentType`, `payBasis`, `dayRate`, `hourlyRate` or employment transition, so it reads as
 * self-employed with no rate. Every screen that reads the signed-in person's own employment type or rate (My
 * Timesheets, My Profile, My Overtime, timesheet reminders) reads this record instead.
 *
 * While `privatePay` is off for the organisation the session user is returned unchanged (the same object), exactly as
 * before (1.26.1: a pay profile can be stale then and is never read into what is shown). While it is on, the pay
 * profile of the person's own id, else of one of their `formerUserIds`, is laid over (`overlayPayProfile`, the
 * `payEditorStartingValues` rule) and the pay fields are read back through the rulebook reader (`parseUserDocument`),
 * so a missing `timesheetsEnabled` follows the real employment type (`defaultTimesheetsEnabled`).
 *
 * Pure: the React hook and the reads are in `useOwnPayUser.ts`.
 */
import {
  PAY_PROFILE_FIELDS,
  parseUserDocument,
  payEditorStartingValues,
  type PayProfileDocument,
} from '@/lib/canonical'
import type { User } from '@/types'

/** The user fields the pay profile decides (the pay fields, and `timesheetsEnabled` when it is not stored). */
export const OWN_PAY_USER_FIELDS = [...PAY_PROFILE_FIELDS, 'timesheetsEnabled'] as const

/** `refused`: the rules said no; `failed`: not reached (offline, timed out). */
export type PayProfileReadStatus = 'found' | 'missing' | 'refused' | 'failed'

export type OwnPayRead = { status: PayProfileReadStatus; profile: PayProfileDocument | null }

export type OwnPayStatus = 'loading' | 'ready' | 'failed'

export type OwnPayState = {
  /** The signed-in person, with their pay profile laid over when it was read (else the session user unchanged). */
  user: User | null
  /** `ready` once the switches were read and, while `privatePay` is on, the own pay profile read answered. */
  status: OwnPayStatus
  /** True only when a pay profile was laid over (privatePay on and found). */
  overlaid: boolean
}

/**
 * `user` (a parsed `users/{uid}` document) with the pay its pay profile stores. `rawDocument` is the stored users
 * document the user was parsed from, when known: with it, a `timesheetsEnabled` the document does not store follows
 * the employment type the profile gives. Returns `user` itself while `privatePay` is off or with no profile.
 */
export function userWithPayProfile(
  user: User,
  profile: PayProfileDocument | null | undefined,
  options: { privatePay: boolean; rawDocument?: Record<string, unknown> | null }
): User {
  if (!options.privatePay || !profile) return user
  const raw = options.rawDocument ?? null
  const source = raw ? payEditorStartingValues(raw, profile, { privatePay: true }).record : { ...profile.fields }
  const parsed = parseUserDocument(user.id, source as Record<string, unknown>)
  if (!parsed) return user
  const out = { ...user } as unknown as Record<string, unknown>
  const has = (key: string) => Object.prototype.hasOwnProperty.call(profile.fields, key)
  if (has('payBasis')) out.payBasis = parsed.payBasis ?? undefined
  if (has('dayRate')) out.dayRate = parsed.dayRate ?? undefined
  if (has('hourlyRate')) out.hourlyRate = parsed.hourlyRate ?? undefined
  if (has('employmentType')) out.employmentType = parsed.employmentType
  if (has('employmentTypeTransitionFrom')) out.employmentTypeTransitionFrom = parsed.employmentTypeTransitionFrom ?? undefined
  if (has('employmentTypeEffectiveAt')) {
    out.employmentTypeEffectiveAt =
      parsed.employmentTypeEffectiveAtMs != null ? new Date(parsed.employmentTypeEffectiveAtMs) : undefined
  }
  if (raw && parsed.timesheetsEnabledStored == null) out.timesheetsEnabled = parsed.timesheetsEnabled
  return out as unknown as User
}

/** The state a screen reads for the signed-in person (see `OwnPayState`). */
export function ownPayState(input: {
  user: User | null
  rawDocument: Record<string, unknown> | null
  switchesLoaded: boolean
  /** Re-review #342 item 4: the switches were not read in time — `failed` (Retry), never decided as "off". */
  switchesFailed?: boolean
  privatePay: boolean
  /** The own pay-profile read for this person and organisation, or null while it has not answered. */
  read: OwnPayRead | null
}): OwnPayState {
  const { user } = input
  if (!user) return { user: null, status: 'loading', overlaid: false }
  if (!input.switchesLoaded) return { user, status: input.switchesFailed ? 'failed' : 'loading', overlaid: false }
  if (!input.privatePay) return { user, status: 'ready', overlaid: false }
  if (!input.read) return { user, status: 'loading', overlaid: false }
  // Never decide from the stripped users document: a read that did not answer is `failed`.
  if (input.read.status === 'failed' || input.read.status === 'refused') return { user, status: 'failed', overlaid: false }
  if (input.read.status === 'missing' || !input.read.profile) return { user, status: 'ready', overlaid: false }
  return {
    user: userWithPayProfile(user, input.read.profile, { privatePay: true, rawDocument: input.rawDocument }),
    status: 'ready',
    overlaid: true,
  }
}

/**
 * Reads the person's own pay profile: their own id first, else each `formerUserIds` entry in order. The own id is
 * always readable by the person (rulebook §16), so its refusal is `refused`; a former invite id may be refused by the
 * rules (no users document of that id), which then counts as missing. A read not reached is `failed`.
 */
export async function readOwnPayProfile(
  organizationId: string,
  person: { id: string; formerUserIds?: ReadonlyArray<string> | null },
  read: (organizationId: string, subjectId: string) => Promise<OwnPayRead>
): Promise<OwnPayRead> {
  let failed = false
  let ownIdRead = true
  for (const id of [person.id, ...(person.formerUserIds ?? [])]) {
    if (!id) continue
    const result = await read(organizationId, id)
    if (result.status === 'found' && result.profile) return result
    if (ownIdRead && result.status === 'refused') return { status: 'refused', profile: null }
    if (result.status === 'failed') failed = true
    ownIdRead = false
  }
  return failed ? { status: 'failed', profile: null } : { status: 'missing', profile: null }
}

/**
 * The read a screen uses after a new own-pay read: a read not reached (offline, `failed`) keeps the last read that
 * answered for the same person and organisation, if any. A refusal never does (the right to it may have gone).
 */
export function ownPayReadAfter(lastGood: OwnPayRead | null, next: OwnPayRead): OwnPayRead {
  if (next.status === 'failed' && lastGood && (lastGood.status === 'found' || lastGood.status === 'missing')) return lastGood
  return next
}

/**
 * `row` (the person's roster row, or the session user) with the pay of `own` (the `OwnPayState` user). `row` itself
 * unless `own` was overlaid from a pay profile, so nothing changes while `privatePay` is off.
 */
export function withOwnPay(row: User, own: OwnPayState): User {
  if (!own.overlaid || !own.user || own.user.id !== row.id) return row
  const out = { ...row } as unknown as Record<string, unknown>
  const source = own.user as unknown as Record<string, unknown>
  for (const key of OWN_PAY_USER_FIELDS) out[key] = source[key]
  return out as unknown as User
}

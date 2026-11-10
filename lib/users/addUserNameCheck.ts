/**
 * Add User's last step before saving (rulebook 1.36.0 §11, owner decision 10 Nov): the duplicate-name check, and on the
 * Ghost account path the ghost's own refusal first (`ghostCreateError`, rulebook 1.34.0). This file only orders the
 * rulebook calls for `components/users/AddUserScreen.tsx`; every answer comes from `@/lib/canonical`.
 */
import {
  ghostCreateError,
  usersWithSameName,
  type GhostDraft,
  type SameNamePerson,
  type SameNameRosterRow,
} from '@/lib/canonical'

export type AddUserNameCheck =
  | { kind: 'refuse'; message: string }
  | { kind: 'warn'; matches: SameNamePerson[] }
  | { kind: 'save' }

export function addUserNameCheck(input: {
  firstName: string
  surname: string
  /** Every users document of the organisation the screen holds. */
  roster: ReadonlyArray<SameNameRosterRow>
  claimedEmails: readonly string[] | null | undefined
  /** True after the person pressed Add anyway for this submit. */
  nameConfirmed: boolean
  /** The ghost draft and the line-manager roster when the Ghost account toggle is on; omitted for an invite. */
  ghost?: { draft: GhostDraft; lineManagerRoster: ReadonlyArray<unknown> } | null
}): AddUserNameCheck {
  if (input.ghost) {
    const refusal = ghostCreateError(input.ghost.draft, { roster: input.ghost.lineManagerRoster as never })
    if (refusal) return { kind: 'refuse', message: refusal }
  }
  if (input.nameConfirmed) return { kind: 'save' }
  const matches = usersWithSameName(input.roster, { firstName: input.firstName, lastName: input.surname }, {
    claimedEmails: input.claimedEmails ?? null,
  })
  return matches.length > 0 ? { kind: 'warn', matches } : { kind: 'save' }
}

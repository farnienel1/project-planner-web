/**
 * Annual leave → Team (rulebook 1.40.0 §9, owner decisions 11 Nov, F18–F23).
 *
 * Who a viewer's Team list holds, and whether the Team tab shows. Both apps call these and only draw the result:
 * before 1.40.0 each app had its own list builder (web `buildAnnualLeavePeople`, iOS `AnnualLeavePersonBuilder`), and
 * both hid everyone who books their own leave, listed deleted people, and iOS listed everyone for every manager.
 *
 * - Admins and the Super Admin outside operative mode: every current person, self-bookers included, never the viewer
 *   (their own leave is on My leave).
 * - Anyone else: only the people they line-manage (`lineManagerIds` over the roster, matched under every id the viewer
 *   goes by, `personIdSet`). An operative-level person is never a line manager (1.31.0), so an operative's list is
 *   empty.
 * - Deleted (`isAnonymisedDeletedProfile`), inactive and pending invites never; a catalogue `operatives` row with no
 *   account (`catalogueOperative`) is current while it is active (admins only: it has no line manager).
 * - The Team tab shows for admins and for anyone whose list is not empty. The Operatives toggle plays no part.
 */

import { personDedupeKey } from './ghostOperatives'
import { lineManagerIds, type LeaveRequester } from './leaveRequests'
import { idKey, idText, personIdSet, type PersonRosterRow } from './personIds'
import type { StaffAccountRole } from './staffAccess'
import { isAnonymisedDeletedProfile, rosterSegment, type RosterSegmentProfile } from './userRosterSegment'

export type AnnualLeaveTeamViewer = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  role?: StaffAccountRole | null
}

/** A users document, or a catalogue `operatives` row with no account (`catalogueOperative: true`). */
export type AnnualLeaveTeamCandidate = RosterSegmentProfile &
  LeaveRequester & {
    id: string
    catalogueOperative?: boolean | null
  }

export type AnnualLeaveTeamInput<T extends AnnualLeaveTeamCandidate> = {
  viewer: AnnualLeaveTeamViewer | null | undefined
  /** The candidates, users documents first (so a users row wins the fold over a catalogue row on the same email). */
  people: ReadonlyArray<T> | null | undefined
  /** The organisation roster (`users` rows with their resolved role), as `lineManagerIds` reads it. */
  roster: ReadonlyArray<PersonRosterRow> | null | undefined
}

function viewerIsAdmin(viewer: AnnualLeaveTeamViewer | null | undefined): boolean {
  const role = viewer?.role
  return Boolean(role) && role!.isOperativeMode !== true && (role!.isAdmin === true || role!.isSuperAdmin === true)
}

/**
 * A person the Team list may show: not an anonymised deleted profile, and Active (`rosterSegment`) — never a pending
 * invite or an inactive person. A catalogue row with no account is current while it is active.
 */
export function annualLeaveTeamPersonIsCurrent(person: AnnualLeaveTeamCandidate | null | undefined): boolean {
  if (!person || !idText(person.id)) return false
  if (isAnonymisedDeletedProfile(person)) return false
  if (person.catalogueOperative === true) return person.isActive !== false
  return rosterSegment(person) === 'active'
}

/** The people on this viewer's Annual leave → Team list, in input order, one row per person (`personDedupeKey`). */
export function annualLeaveTeamPeople<T extends AnnualLeaveTeamCandidate>(input: AnnualLeaveTeamInput<T>): T[] {
  const viewer = input.viewer
  if (!viewer || !idText(viewer.id)) return []
  const roster = (input.roster || []).filter((row) => row && idText(row.id))
  const viewerIds = new Set(personIdSet(viewer, roster).map(idKey))
  const viewerEmail = idKey(viewer.email)
  const admin = viewerIsAdmin(viewer)
  const seen = new Set<string>()
  const out: T[] = []
  for (const person of input.people || []) {
    if (!annualLeaveTeamPersonIsCurrent(person)) continue
    const key = personDedupeKey(person)
    if (!key || seen.has(key)) continue
    // The viewer's own leave is on My leave, never on their Team list.
    const isViewer =
      viewerIds.has(idKey(person.id)) ||
      (viewerEmail !== '' && idKey(person.email) === viewerEmail) ||
      personIdSet(person, roster).some((id) => viewerIds.has(idKey(id)))
    if (isViewer) continue
    if (!admin) {
      if (person.catalogueOperative === true) continue
      const managers = lineManagerIds(person, roster)
      if (!managers.some((id) => viewerIds.has(idKey(id)))) continue
    }
    seen.add(key)
    out.push(person)
  }
  return out
}

/**
 * Whether Annual leave shows the Team tab: admins and the Super Admin outside operative mode always; anyone else when
 * they line-manage at least one current person (`annualLeaveTeamPeople` is not empty).
 */
export function annualLeaveTeamTabVisible<T extends AnnualLeaveTeamCandidate>(input: AnnualLeaveTeamInput<T>): boolean {
  if (!input.viewer || !idText(input.viewer.id)) return false
  if (viewerIsAdmin(input.viewer)) return true
  return annualLeaveTeamPeople(input).length > 0
}

/** The Team tab's empty-state text (1.40.0: self-bookers are listed now, so the old "people who book their own leave are not listed here" was wrong). */
export const ANNUAL_LEAVE_TEAM_EMPTY_ADMIN = 'Nobody else is in the company yet. People you add appear here once they have signed in.'
export const ANNUAL_LEAVE_TEAM_EMPTY_MANAGER = 'Nobody reports to you yet. People you line-manage appear here.'

/** The empty-state line for this viewer. */
export function annualLeaveTeamEmptyMessage(viewer: AnnualLeaveTeamViewer | null | undefined): string {
  return viewerIsAdmin(viewer) ? ANNUAL_LEAVE_TEAM_EMPTY_ADMIN : ANNUAL_LEAVE_TEAM_EMPTY_MANAGER
}

import { clashResolutionKey, normalizeDocumentId } from '@/lib/canonical'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { MissedMaterialOrderWarning } from '@/lib/warnings/materialOrderWarnings'
import type { UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import type { LeaveCoverageWarning } from '@/lib/warnings/leaveCoverageWarnings'
import type { UnverifiedOperativeWarning } from '@/lib/warnings/generateOrgWarnings'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import { analyse, displayTitle, formatDuration, FULL_DAY_WINDOW, type ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { formatClockMinutes } from '@/lib/canonical'

/**
 * Owner request 17 Nov: Dismiss on every web warning iOS can dismiss, with the iOS confirmation sheet
 * (`WarningDismissConfirmationSheet`, `WarningsDetailView.swift`). A dismissal writes
 * `warningResolutions/{key}` status `dismissed` for each key (`warningDismissDocument` → `warningResolutionWriteFields`),
 * the keys iOS writes (`WarningsService.dismissWarning(warning)` → `warning.resolutionKey`, the rulebook row's id), then
 * tells the admins `warning_removed` (`companyActivityRecipients`) with the iOS text (`notifyWarningRemoved`).
 */

/** The iOS sheet's wording, word for word. */
export const WARNING_DISMISS_COPY = {
  title: 'Dismiss this warning?',
  body: 'Are you sure you would like to dismiss this warning? Any warnings that are dismissed will not reappear again.',
  notice:
    'All admins will get a notification with who dismissed it and what was dismissed. It also appears in the notification centre on Home.',
  confirm: 'Dismiss permanently',
  confirming: 'Dismissing…',
  cancel: 'Keep warning',
  button: 'Dismiss',
  failed: 'Could not dismiss this warning. Try again.',
} as const

/** iOS `notifyWarningRemoved` type labels. */
export type WarningDismissKind =
  | 'operativeClash'
  | 'managerClash'
  | 'unbooked'
  | 'leave'
  | 'materials'
  | 'unverified'

export const WARNING_DISMISS_TYPE_LABELS: Record<WarningDismissKind, string> = {
  operativeClash: 'Operative booking clash',
  managerClash: 'Manager booking clash',
  unbooked: 'Unbooked labour',
  leave: 'Annual leave',
  materials: 'Materials cut-off',
  unverified: 'Operative not verified',
}

export type WarningDismissRequest = {
  kind: WarningDismissKind
  /** `warningResolutions` keys to write, each once (case-insensitive), stored case kept. Never empty. */
  keys: string[]
  /** Heading of the summary box (iOS `warning.title`). */
  title: string
  /** Summary box text and the notice's detail (iOS `removalNotificationDetail`). */
  detail: string
}

/** Each key once, ignoring case (`normalizeDocumentId`); blanks dropped; first spelling kept. */
export function uniqueResolutionKeys(keys: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of keys) {
    const key = String(raw ?? '').trim()
    if (!key) continue
    const norm = normalizeDocumentId(key)
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(key)
  }
  return out
}

/** "Tue 17 Nov 2026" in the organisation zone (iOS `.weekday(.abbreviated).day().month(.abbreviated).year()`). */
export function warningDismissDateText(date: Date | null | undefined, timeZone: string): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace(',', '')
}

function clashPlaces(entries: ReadonlyArray<ClashTimelineEntry>): string {
  return entries
    .map((entry) =>
      entry.jobNumber ? (entry.siteName ? `${entry.jobNumber} (${entry.siteName})` : entry.jobNumber) : displayTitle(entry)
    )
    .join(' · ')
}

function overlapSummary(entries: ReadonlyArray<ClashTimelineEntry>): string {
  return `${formatDuration(analyse([...entries], FULL_DAY_WINDOW).minutes)} overlap`
}

/**
 * Operative clash: the iOS key (`group.resolutionKey`) and, for a cluster of three or more, every overlapping pair's
 * `clashResolutionKey` — the keys the approval writes — because `isClashGroupApproved` hides a cluster only once every
 * pair is resolved. For two bookings both lists are the same one key.
 */
export function operativeClashDismissRequest(
  warning: Pick<OperativeBookingClashWarning, 'resolutionKey' | 'pairs' | 'operativeName' | 'date' | 'entries'>,
  timeZone: string
): WarningDismissRequest {
  const title = 'Operative booking clash'
  return {
    kind: 'operativeClash',
    keys: uniqueResolutionKeys([
      warning.resolutionKey,
      ...(warning.pairs || []).map((pair) => clashResolutionKey({ bookingAId: pair.bookingAId, bookingBId: pair.bookingBId })),
    ]),
    title,
    detail: `${warning.operativeName} on ${warningDismissDateText(warning.date, timeZone)}: ${title}. ${clashPlaces(
      warning.entries
    )}. ${overlapSummary(warning.entries)}.`,
  }
}

/** Manager / admin clash: `managerClashGroups` key (`mgr-clash-{user}-{day}-{i}`), the one iOS writes. */
export function managerClashDismissRequest(
  warning: Pick<ManagerBookingClashWarning, 'resolutionKey' | 'personName' | 'date' | 'entries'>,
  timeZone: string
): WarningDismissRequest {
  const title = 'Manager booking clash'
  return {
    kind: 'managerClash',
    keys: uniqueResolutionKeys([warning.resolutionKey]),
    title,
    detail: `${warning.personName} on ${warningDismissDateText(warning.date, timeZone)}: ${title}. ${clashPlaces(
      warning.entries
    )}. ${overlapSummary(warning.entries)}.`,
  }
}

/** Unbooked labour day card: every person's `unbookedLabourRows` id on that day (iOS `warningsToDismiss`). */
export function unbookedDayDismissRequest(
  date: Date,
  people: ReadonlyArray<Pick<UnbookedLabourWarning, 'id' | 'operativeName'>>,
  timeZone: string
): WarningDismissRequest {
  const title = 'Unbooked labour'
  const names = people.map((person) => person.operativeName).filter(Boolean).join(', ')
  const count = people.length
  return {
    kind: 'unbooked',
    keys: uniqueResolutionKeys(people.map((person) => person.id)),
    title,
    detail: `${title} on ${warningDismissDateText(date, timeZone)}: ${names}. ${count} ${
      count === 1 ? 'person is' : 'people are'
    } not booked.`,
  }
}

/** Annual leave (half day not covered, or a booking during leave): the `leaveCoverageRows` id. */
export function leaveDismissRequest(
  warning: Pick<LeaveCoverageWarning, 'id' | 'title' | 'personName' | 'date' | 'message' | 'missing' | 'missingHours'>,
  timeZone: string
): WarningDismissRequest {
  const dateText = warningDismissDateText(warning.date, timeZone)
  const gap = (warning.missing || [])
    .map((range) => `${formatClockMinutes(range.start)}–${formatClockMinutes(range.end)}`)
    .join(', ')
  return {
    kind: 'leave',
    keys: uniqueResolutionKeys([warning.id]),
    title: warning.title,
    detail: gap
      ? `${warning.personName} on ${dateText}: ${warning.title}. Missing ${gap} (${formatWarningHours(
          warning.missingHours
        )}h). ${warning.message}`
      : `${warning.personName} on ${dateText}: ${warning.title}. ${warning.message}`,
  }
}

/** Materials cut-off: `materialCutOffWarningRows` id (`materials-{job}-{day}`). */
export function materialsDismissRequest(
  warning: Pick<MissedMaterialOrderWarning, 'id' | 'title' | 'projectLabel' | 'message'>
): WarningDismissRequest {
  return {
    kind: 'materials',
    keys: uniqueResolutionKeys([warning.id]),
    title: warning.title,
    detail: `${warning.title}: ${warning.projectLabel}. ${warning.message}`,
  }
}

/** Unverified account: `unverifiedOperativeRows` id. */
export function unverifiedDismissRequest(
  warning: Pick<UnverifiedOperativeWarning, 'id' | 'message'>
): WarningDismissRequest {
  const title = 'Unverified operative'
  return {
    kind: 'unverified',
    keys: uniqueResolutionKeys([warning.id]),
    title,
    detail: `${title}. ${warning.message}`,
  }
}

/** The admins' inbox row (iOS `notifyWarningRemoved`): same title and message on both apps. */
export function warningRemovedNotice(input: {
  actorName: string
  request: Pick<WarningDismissRequest, 'kind' | 'detail'>
}): { title: string; message: string } {
  const name = input.actorName.trim() || 'Someone'
  const label = WARNING_DISMISS_TYPE_LABELS[input.request.kind].toLowerCase()
  return {
    title: `Warning dismissed by ${name}`,
    message: `${name} dismissed a ${label} warning. Dismissed warnings do not reappear.\n\n${input.request.detail}`,
  }
}

/**
 * The sheet's confirm, in order: write every key (one batch), then — only when the write succeeded — tell the admins.
 * A refused or failed write returns its message and notifies nobody, so the card stays and the sheet shows the error.
 * A failed notice never undoes a saved dismissal.
 */
export async function runWarningDismiss(input: {
  request: Pick<WarningDismissRequest, 'keys'>
  write: (keys: string[]) => Promise<unknown>
  notify: () => Promise<unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const keys = uniqueResolutionKeys(input.request.keys)
  if (keys.length === 0) return { ok: false, error: WARNING_DISMISS_COPY.failed }
  try {
    await input.write(keys)
  } catch (caught) {
    return { ok: false, error: caught instanceof Error && caught.message ? caught.message : WARNING_DISMISS_COPY.failed }
  }
  try {
    await input.notify()
  } catch {
    // The dismissal is saved; a failed notice never undoes it.
  }
  return { ok: true }
}

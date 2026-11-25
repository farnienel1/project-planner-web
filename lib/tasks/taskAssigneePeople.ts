import type { Manager, Operative } from '@/types'
import { dedupeOperativesByEmail } from '@/lib/operatives/operativeRosterUtils'
import { isCurrentLabourNamedPerson } from '@/lib/staff/userRosterUtils'
import { bookingPersonIdHint } from '@/lib/canonical/unresolvedBookingPeople'
import { TASK_REMOVED_USER_LABEL, taskAssigneeDisplay } from '@/lib/canonical/taskRules'
// Rulebook 1.59.0 §21: who each task assignee row is (`taskPersonIndex`, one key per person across every record) is
// the rulebook's, shared with iOS; this file only builds the web picker rows from it.
import {
  isTaskPersonSelected,
  taskPersonIndex,
  toggleTaskPerson,
  type TaskPersonIndex,
  type TaskPersonKind,
  type TaskPersonRosterRow,
} from '@/lib/canonical/taskPeople'

export { isTaskPersonSelected, taskPersonIndex, toggleTaskPerson }
export type { TaskPersonIndex, TaskPersonKind, TaskPersonRosterRow }

function emailKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function idKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

/**
 * One row per person in the new-task people picker. A person with several catalogue rows (a converted ghost's old
 * row, a duplicate row, a row linked to an account, a `managers` row and an `operatives` row) is listed once; in the
 * combined picker their `managers` row is the one shown. Ghost operatives are not offered for a new assignment (they
 * have no login and cannot tick a task's items, rulebook §11 J2); an existing assignment still shows (`taskPickerExtras`).
 * `operatives` rows without an email are left out, as before.
 */
export function peopleForTaskPicker(
  managers: Manager[],
  operatives: Operative[],
  route: 'managers' | 'operatives' | 'combined',
  roster: ReadonlyArray<TaskPersonRosterRow> = [],
  index: TaskPersonIndex = taskPersonIndex({ managers, operatives, roster })
): { managers: Manager[]; operatives: Operative[] } {
  const managerKeys = new Set<string>()
  const uniqueManagers: Manager[] = []
  for (const row of managers) {
    if (!isCurrentLabourNamedPerson(row)) continue
    const key = index.keyOf('manager', row.id)
    if (managerKeys.has(key)) continue
    managerKeys.add(key)
    uniqueManagers.push(row)
  }
  const operativeKeys = new Set<string>()
  const uniqueOperatives: Operative[] = []
  for (const row of dedupeOperativesByEmail(operatives)) {
    if (!isCurrentLabourNamedPerson(row)) continue
    const key = index.keyOf('operative', row.id)
    if (index.isGhost(key) || operativeKeys.has(key)) continue
    operativeKeys.add(key)
    uniqueOperatives.push(row)
  }
  if (route === 'managers') return { managers: uniqueManagers, operatives: [] }
  if (route === 'operatives') return { managers: [], operatives: uniqueOperatives }
  return {
    managers: uniqueManagers,
    operatives: uniqueOperatives.filter((row) => !managerKeys.has(index.keyOf('operative', row.id))),
  }
}

export type TaskPickerExtra = { kind: TaskPersonKind; id: string; label: string }

/**
 * Guardrail 3: ids already assigned to the task whose person no picker row shows (an inactive or old row, a ghost, a
 * row since deleted). They are listed in the picker as ticked rows so they stay visible and can be removed. One
 * entry per person.
 */
export function taskPickerExtras(input: {
  index: TaskPersonIndex
  shown: ReadonlyArray<{ kind: TaskPersonKind; id: string }>
  selectedManagers: ReadonlySet<string>
  selectedOperatives: ReadonlySet<string>
  allManagers: ReadonlyArray<Manager>
  allOperatives: ReadonlyArray<Operative>
}): TaskPickerExtra[] {
  const { index } = input
  const shownKeys = new Set(input.shown.map((row) => index.keyOf(row.kind, row.id)))
  const seen = new Set<string>()
  const extras: TaskPickerExtra[] = []
  const add = (kind: TaskPersonKind, id: string) => {
    const key = index.keyOf(kind, id)
    if (shownKeys.has(key) || seen.has(key)) return
    seen.add(key)
    const rows: ReadonlyArray<Manager | Operative> = kind === 'manager' ? input.allManagers : input.allOperatives
    const row = rows.find((entry) => idKey(entry.id) === idKey(id))
    const name = row ? `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email : ''
    extras.push({ kind, id, label: name || `Unknown person · ${bookingPersonIdHint(id)}` })
  }
  for (const id of input.selectedManagers) add('manager', id)
  for (const id of input.selectedOperatives) add('operative', id)
  return extras
}

/**
 * One option per person for a task filter list (every row kept, inactive and ghost people included: they may have
 * tasks). The person's active row with an email is preferred as the option shown.
 */
export function foldTaskFilterPeople<T extends { id: string; email?: string; isActive?: boolean }>(
  rows: ReadonlyArray<T>,
  kind: TaskPersonKind,
  index: TaskPersonIndex
): T[] {
  const score = (row: T) => (row.isActive !== false ? 2 : 0) + (emailKey(row.email) ? 1 : 0)
  const byKey = new Map<string, T>()
  const order: string[] = []
  for (const row of rows) {
    const key = index.keyOf(kind, row.id)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, row)
      order.push(key)
    } else if (score(row) > score(existing)) {
      byKey.set(key, row)
    }
  }
  return order.map((key) => byKey.get(key) as T)
}

/**
 * The names of a task's assignees (with the kind of row that named them), one per person (two stored ids of one person
 * show one name), managers first. Ids match their row without case. 1.89.0 bug B11: an id whose row is gone, or an
 * anonymised deleted profile, is listed as "Removed user" (`taskAssigneeDisplay`, `removed: true`) so a manager can
 * reassign the task — before, it was left out (or read "Deleted user") with no way forward. One "Removed user" entry per
 * missing id.
 */
export function taskAssigneeNames(
  ids: { managerIds: ReadonlyArray<string>; operativeIds: ReadonlyArray<string> },
  people: {
    managers: ReadonlyArray<Manager>
    operatives: ReadonlyArray<Operative>
    index: TaskPersonIndex
    /** Review of #452: false while the rosters are still loading — nobody is shown (never a false "Removed user"). */
    loaded?: boolean
    /**
     * Rulebook 1.91.0 §34 (`taskAssigneeCandidates().goneIds`, lower case): rows whose person no longer exists (a
     * `managers` row left behind by a delete, an anonymised row). They read "Removed user", so the task can be reassigned.
     */
    goneIds?: ReadonlySet<string>
  }
): Array<{ kind: TaskPersonKind; name: string; removed: boolean; id: string }> {
  if (people.loaded === false) return []
  const seen = new Set<string>()
  const names: Array<{ kind: TaskPersonKind; name: string; removed: boolean; id: string }> = []
  const add = (kind: TaskPersonKind, id: string) => {
    const rows: ReadonlyArray<Manager | Operative> = kind === 'manager' ? people.managers : people.operatives
    const row = rows.find((entry) => idKey(entry.id) === idKey(id))
    const key = row ? people.index.keyOf(kind, row.id) : `missing:${kind}:${idKey(id)}`
    if (!idKey(id) || seen.has(key)) return
    seen.add(key)
    const gone = Boolean(row && people.goneIds?.has(idKey(row.id)))
    const display = gone ? { name: TASK_REMOVED_USER_LABEL, removed: true } : taskAssigneeDisplay(row ?? null)
    names.push({ kind, name: display.name, removed: display.removed, id })
  }
  for (const id of ids.managerIds) add('manager', id)
  for (const id of ids.operativeIds) add('operative', id)
  return names
}

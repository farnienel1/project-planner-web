import type { Manager, Operative } from '@/types'
import { dedupeOperativesByEmail } from '@/lib/operatives/operativeRosterUtils'
import { isCurrentLabourNamedPerson } from '@/lib/staff/userRosterUtils'
import { personIdSet, type PersonRosterRow } from '@/lib/canonical/personIds'
import { isGhostUser } from '@/lib/canonical/userRosterSegment'
import { bookingPersonIdHint } from '@/lib/canonical/unresolvedBookingPeople'

function emailKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function idKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function idText(value: string | null | undefined): string {
  return (value || '').trim()
}

export type TaskPersonKind = 'manager' | 'operative'

/** A `users` document as the task pickers read it: the fields `personIdSet` folds on, plus the ghost flag. */
export type TaskPersonRosterRow = PersonRosterRow & { ghost?: unknown }

type CatalogueRow = { id: string; email?: string | null; linkedUserId?: string | null }

/**
 * Who each task assignee row is (owner decision 17 Nov: a person with more than one record appears once in the task
 * pickers). Tasks store `operatives` and `managers` catalogue row ids (`assignedOperativeIds`, `assignedManagerIds`);
 * one person can have several of them — a converted ghost's old `operatives` row (its id is the ghost's users id,
 * rulebook §11), duplicate rows linked to it, a row linked to an account (`linkedUserId` / `userId` / `uid`), and a
 * `managers` row on their email. Each row is folded with the rulebook's `personIdSet` over every users document of
 * the organisation (own id, `formerUserIds`, `sameEmailUserIds`, same email), with a stored account link counted as
 * one of the row's ids — the identity link `notificationRecipientAccountId` already reads. Display only: nothing
 * stored changes, and tasks keep storing the catalogue row id they were given.
 */
export type TaskPersonIndex = {
  /**
   * One key per person, the same for every record of them: the smallest `account:<id>` of the person's users
   * documents, else the smallest `email:<email>`, else the smallest `id:<id>`. Ids without case.
   */
  keyOf(kind: TaskPersonKind, id: string): string
  /** True when every users document of the person is a ghost operative (no login). */
  isGhost(key: string): boolean
}

export function taskPersonIndex(input: {
  managers: ReadonlyArray<CatalogueRow>
  operatives: ReadonlyArray<CatalogueRow>
  roster?: ReadonlyArray<TaskPersonRosterRow> | null
}): TaskPersonIndex {
  const roster = (input.roster || []).filter((row) => row && idText(row.id))
  const rosterById = new Map(roster.map((row) => [idKey(row.id), row]))
  const managersById = new Map(input.managers.map((row) => [idKey(row.id), row]))
  const operativesById = new Map(input.operatives.map((row) => [idKey(row.id), row]))

  // The whole closure first (review of #364): every record of one person — users documents (folded with the
  // rulebook's `personIdSet` over the whole roster), their emails, `operatives` / `managers` rows on those emails or
  // ids and the accounts those rows link to — is one group, so every record gets the same key.
  const parent = new Map<string, string>()
  const find = (node: string): string => {
    let root = node
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string
    if (!parent.has(root)) parent.set(root, root)
    let cur = node
    while (cur !== root) {
      const next = parent.get(cur) as string
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  const idNode = (id: string | null | undefined) => (idKey(id) ? `id:${idKey(id)}` : '')
  const emailNode = (email: string | null | undefined) => (emailKey(email) ? `email:${emailKey(email)}` : '')
  const join = (nodes: string[]) => {
    const present = nodes.filter(Boolean)
    for (let i = 1; i < present.length; i += 1) union(present[0], present[i])
  }
  for (const row of roster) {
    join([idNode(row.id), emailNode(row.email), ...personIdSet(row, roster).map(idNode)])
  }
  for (const row of [...input.managers, ...input.operatives]) {
    if (!row || !idText(row.id)) continue
    join([idNode(row.id), emailNode(row.email), idNode(row.linkedUserId)])
  }

  // One deterministic key per group: the smallest account id, else the smallest email, else the smallest id.
  type Group = { accounts: string[]; emails: string[]; ids: string[] }
  const groups = new Map<string, Group>()
  for (const node of [...parent.keys()]) {
    const root = find(node)
    const group = groups.get(root) || { accounts: [], emails: [], ids: [] }
    groups.set(root, group)
    if (node.startsWith('email:')) group.emails.push(node.slice(6))
    else {
      const id = node.slice(3)
      group.ids.push(id)
      if (rosterById.has(id)) group.accounts.push(id)
    }
  }
  const keyByRoot = new Map<string, string>()
  const ghostKeys = new Set<string>()
  for (const [root, group] of groups) {
    const smallest = (values: string[]) => [...values].sort()[0]
    const key = group.accounts.length
      ? `account:${smallest(group.accounts)}`
      : group.emails.length
        ? `email:${smallest(group.emails)}`
        : `id:${smallest(group.ids)}`
    keyByRoot.set(root, key)
    // A ghost only when every account of the person is a ghost (a ghost's old record beside a live login is not).
    if (group.accounts.length && group.accounts.every((id) => isGhostUser(rosterById.get(id)))) ghostKeys.add(key)
  }

  const keyOf = (kind: TaskPersonKind, id: string): string => {
    const row = (kind === 'manager' ? managersById : operativesById).get(idKey(id))
    const node = idNode(row ? row.id : id)
    if (!node) return 'id:'
    if (!parent.has(node)) return `id:${idKey(id)}`
    return keyByRoot.get(find(node)) as string
  }

  return { keyOf, isGhost: (key) => ghostKeys.has(key) }
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

/** Whether the person shown by a picker row is assigned: any of their catalogue row ids (either kind) is selected. */
export function isTaskPersonSelected(
  index: TaskPersonIndex,
  kind: TaskPersonKind,
  id: string,
  selectedManagers: ReadonlySet<string>,
  selectedOperatives: ReadonlySet<string>
): boolean {
  const key = index.keyOf(kind, id)
  for (const selected of selectedManagers) if (index.keyOf('manager', selected) === key) return true
  for (const selected of selectedOperatives) if (index.keyOf('operative', selected) === key) return true
  return false
}

/**
 * Tick or untick the person a picker row shows. Unticking removes every id of that person from both sets (so an old
 * row id stored on the task is removed with them); ticking adds the row's own id. Ids already stored on the task are
 * never rewritten when the person stays ticked.
 */
export function toggleTaskPerson(
  index: TaskPersonIndex,
  kind: TaskPersonKind,
  id: string,
  selectedManagers: ReadonlySet<string>,
  selectedOperatives: ReadonlySet<string>
): { managers: Set<string>; operatives: Set<string> } {
  const managers = new Set(selectedManagers)
  const operatives = new Set(selectedOperatives)
  if (isTaskPersonSelected(index, kind, id, selectedManagers, selectedOperatives)) {
    const key = index.keyOf(kind, id)
    for (const selected of selectedManagers) if (index.keyOf('manager', selected) === key) managers.delete(selected)
    for (const selected of selectedOperatives) if (index.keyOf('operative', selected) === key) operatives.delete(selected)
  } else if (kind === 'manager') {
    managers.add(id)
  } else {
    operatives.add(id)
  }
  return { managers, operatives }
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
 * The names of a task's assignees (with the kind of row that named them), one per person (two stored ids of one person show one name), managers first.
 * Ids match their row without case. An id whose row is gone is left out, as before.
 */
export function taskAssigneeNames(
  ids: { managerIds: ReadonlyArray<string>; operativeIds: ReadonlyArray<string> },
  people: { managers: ReadonlyArray<Manager>; operatives: ReadonlyArray<Operative>; index: TaskPersonIndex }
): Array<{ kind: TaskPersonKind; name: string }> {
  const seen = new Set<string>()
  const names: Array<{ kind: TaskPersonKind; name: string }> = []
  const add = (kind: TaskPersonKind, id: string) => {
    const rows: ReadonlyArray<Manager | Operative> = kind === 'manager' ? people.managers : people.operatives
    const row = rows.find((entry) => idKey(entry.id) === idKey(id))
    if (!row) return
    const key = people.index.keyOf(kind, row.id)
    if (seen.has(key)) return
    seen.add(key)
    names.push({ kind, name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email })
  }
  for (const id of ids.managerIds) add('manager', id)
  for (const id of ids.operativeIds) add('operative', id)
  return names
}

/** Active catalogue rows for a new assignment. Historic task rows keep the stored name. */
export function activePeopleForAssignment<T extends { email?: string; firstName?: string; lastName?: string; name?: string; isActive?: boolean }>(
  rows: readonly T[]
): T[] {
  return rows.filter((row) => row.isActive !== false && isCurrentLabourNamedPerson(row))
}


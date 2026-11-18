/**
 * Rulebook 1.59.0 §21 (owner decision 17 Nov: a person with more than one record appears once in the task pickers;
 * moved here from web `lib/tasks/taskAssigneePeople.ts` so iOS calls the same rule).
 *
 * Tasks store `operatives` and `managers` catalogue row ids (`assignedOperativeIds`, `assignedManagerIds`); one person
 * can have several of them — a converted ghost's old `operatives` row (its id is the ghost's users id, §11), duplicate
 * rows linked to it, a row linked to an account (`linkedUserId` / `userId` / `uid`), and a `managers` row on their
 * email. Every record of one person — users documents (folded with `personIdSet` over the whole roster), their emails,
 * `operatives` / `managers` rows on those emails or ids and the accounts those rows link to — is one group (the whole
 * closure first), so every record gets the same key. Display only: nothing stored changes, and tasks keep storing the
 * catalogue row id they were given.
 */

import { personIdSet, type PersonRosterRow } from './personIds'
import { isGhostUser } from './userRosterSegment'

export type TaskPersonKind = 'manager' | 'operative'

/** A `users` document as the task pickers read it: the fields `personIdSet` folds on, plus the ghost flag. */
export type TaskPersonRosterRow = PersonRosterRow & { ghost?: unknown }

export type TaskPersonCatalogueRow = {
  id: string
  email?: string | null
  linkedUserId?: string | null
  userId?: string | null
  uid?: string | null
}

export type TaskPersonKeys = {
  /**
   * Lower-case id → the person's key, for every id the inputs name: catalogue row ids (either kind), users ids, the
   * ids `personIdSet` folds in and the accounts rows link to. An id not listed is its own person, `id:<id>`.
   */
  keys: Record<string, string>
  /** The keys whose every users document is a ghost operative (no login). */
  ghostKeys: string[]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function key(value: unknown): string {
  return text(value).toLowerCase()
}

/**
 * One key per person, the same for every record of them: the smallest `account:<id>` of the person's users
 * documents, else the smallest `email:<email>`, else the smallest `id:<id>`. Ids and emails without case. A person
 * is a ghost only when every account of theirs is a ghost (a ghost's old record beside a live login is not). Plain
 * data, so iOS reads it through `CanonicalBusinessEngine`; `taskPersonIndex` wraps it for lookups.
 */
export function taskPersonKeys(input: {
  managers: ReadonlyArray<TaskPersonCatalogueRow>
  operatives: ReadonlyArray<TaskPersonCatalogueRow>
  roster?: ReadonlyArray<TaskPersonRosterRow> | null
}): TaskPersonKeys {
  const roster = (input?.roster || []).filter((row) => row && text(row.id))
  const rosterById = new Map(roster.map((row) => [key(row.id), row]))
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
  const idNode = (id: unknown) => (key(id) ? `id:${key(id)}` : '')
  const emailNode = (email: unknown) => (key(email) ? `email:${key(email)}` : '')
  const join = (nodes: string[]) => {
    const present = nodes.filter(Boolean)
    for (const node of present) find(node)
    for (let i = 1; i < present.length; i += 1) union(present[0], present[i])
  }
  for (const row of roster) join([idNode(row.id), emailNode(row.email), ...personIdSet(row, roster).map(idNode)])
  const managers = (input?.managers || []).filter((row) => row && text(row.id))
  const operatives = (input?.operatives || []).filter((row) => row && text(row.id))
  for (const row of [...managers, ...operatives]) {
    join([idNode(row.id), emailNode(row.email), idNode(row.linkedUserId), idNode(row.userId), idNode(row.uid)])
  }

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
  const ghostKeys: string[] = []
  for (const [root, group] of groups) {
    const smallest = (values: string[]) => [...values].sort()[0]
    const personKey = group.accounts.length
      ? `account:${smallest(group.accounts)}`
      : group.emails.length
        ? `email:${smallest(group.emails)}`
        : `id:${smallest(group.ids)}`
    keyByRoot.set(root, personKey)
    if (group.accounts.length && group.accounts.every((id) => isGhostUser(rosterById.get(id)))) ghostKeys.push(personKey)
  }
  const keys: Record<string, string> = {}
  for (const node of [...parent.keys()]) if (node.startsWith('id:')) keys[node.slice(3)] = keyByRoot.get(find(node)) as string
  return { keys, ghostKeys: [...new Set(ghostKeys)].sort() }
}

export type TaskPersonIndex = {
  /** The person's key for an id (a row id of that kind, or any id the inputs name); an unknown id is `id:<id>`. */
  keyOf(kind: TaskPersonKind, id: string): string
  /** True when every users document of the person is a ghost operative (no login). */
  isGhost(key: string): boolean
}

/** `taskPersonKeys` as lookups (the kind does not change the key: one person, one key across both kinds). */
export function taskPersonIndex(input: {
  managers: ReadonlyArray<TaskPersonCatalogueRow>
  operatives: ReadonlyArray<TaskPersonCatalogueRow>
  roster?: ReadonlyArray<TaskPersonRosterRow> | null
}): TaskPersonIndex {
  const { keys, ghostKeys } = taskPersonKeys(input)
  const ghosts = new Set(ghostKeys)
  return {
    keyOf(_kind, id) {
      const k = key(id)
      return k ? keys[k] || `id:${k}` : 'id:'
    },
    isGhost: (personKey) => ghosts.has(personKey),
  }
}

/** Whether the person shown by a picker row is assigned: any of their catalogue row ids (either kind) is selected. */
export function isTaskPersonSelected(
  index: TaskPersonIndex,
  kind: TaskPersonKind,
  id: string,
  selectedManagers: Iterable<string>,
  selectedOperatives: Iterable<string>
): boolean {
  const personKey = index.keyOf(kind, id)
  for (const selected of selectedManagers) if (index.keyOf('manager', selected) === personKey) return true
  for (const selected of selectedOperatives) if (index.keyOf('operative', selected) === personKey) return true
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
  selectedManagers: Iterable<string>,
  selectedOperatives: Iterable<string>
): { managers: Set<string>; operatives: Set<string> } {
  const managers = new Set(selectedManagers)
  const operatives = new Set(selectedOperatives)
  if (isTaskPersonSelected(index, kind, id, managers, operatives)) {
    const personKey = index.keyOf(kind, id)
    for (const selected of [...managers]) if (index.keyOf('manager', selected) === personKey) managers.delete(selected)
    for (const selected of [...operatives]) if (index.keyOf('operative', selected) === personKey) operatives.delete(selected)
  } else if (kind === 'manager') {
    managers.add(id)
  } else {
    operatives.add(id)
  }
  return { managers, operatives }
}

import { idsMatch } from '@/lib/subcontractors/bookingPeople'
import { isPlaceholderManager } from '@/lib/staff/managerRosterUtils'
import { isPendingPerson } from '@/lib/staff/pendingPeople'

/**
 * Who can be chosen as a project or small-works manager.
 *
 * iOS `ProjectManagerPickerSupport.availableManagers` offers active catalogue
 * managers, plus active admins who have finished signup. A catalogue row whose
 * `isActive` flag was never written still decodes as active, so the web also
 * requires the linked user to be an active, accepted manager or admin in this
 * organisation. Inactive, deactivated, pending, operative-only, and other-org
 * accounts are not managers.
 *
 * iOS stores `managerIds` as `Manager.stableId(forFirestoreDocumentId:)`.
 * That equals the document id when the id is a UUID, and a hash when the
 * document id is a user id. Both spellings have to resolve to the same person.
 */

export type ProjectManagerRosterRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isActive?: boolean
  organizationId?: string | null
}

export type ProjectManagerAccount = {
  id: string
  firstName?: string | null
  surname?: string | null
  email?: string | null
  isActive?: boolean
  passwordSet?: boolean
  status?: string | null
  organizationId?: string | null
  isSuperAdmin?: boolean
  role?: string | null
  permissions?: {
    manager?: boolean
    adminAccess?: boolean
    operativeMode?: boolean
  } | null
}

export type ProjectManagerChoice = {
  id: string
  label: string
  email: string
  userId?: string
}

const MASK64 = (1n << 64n) - 1n
const FNV_OFFSET = 14695981039346656037n
const FNV_PRIME = 1099511628211n

function clean(value: string | null | undefined): string {
  return String(value || '').trim()
}

export function normalizeManagerEmail(email: string | null | undefined): string {
  return clean(email).toLowerCase()
}

function bareId(id: string): string {
  return id.toLowerCase().startsWith('user:') ? id.slice('user:'.length) : id
}

export function managerIdsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = clean(left)
  const b = clean(right)
  if (!a || !b) return false
  return idsMatch(a, b) || idsMatch(bareId(a), bareId(b))
}

/** iOS `Manager.stableId(forFirestoreDocumentId:)`. */
export function stableManagerDocumentId(documentId: string): string {
  const trimmed = clean(documentId)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  let h1 = FNV_OFFSET
  let h2 = FNV_PRIME
  for (const byte of new TextEncoder().encode(trimmed)) {
    h1 = (h1 ^ BigInt(byte)) & MASK64
    h1 = (h1 * FNV_PRIME) & MASK64
    h2 = (h2 ^ BigInt(byte)) & MASK64
    h2 = (h2 * FNV_OFFSET) & MASK64
  }
  const bytes = new Array<number>(16).fill(0)
  for (let index = 0; index < 8; index += 1) {
    bytes[index] = Number((h1 >> BigInt(8 * index)) & 255n)
    bytes[index + 8] = Number((h2 >> BigInt(8 * index)) & 255n)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
}

export function choiceIdForRoster(documentId: string): string {
  const stable = stableManagerDocumentId(documentId)
  return managerIdsMatch(stable, documentId) ? documentId : stable
}

function rosterName(row: ProjectManagerRosterRow): string {
  return `${clean(row.firstName)} ${clean(row.lastName)}`.trim() || clean(row.email)
}

function accountName(row: ProjectManagerAccount): string {
  return `${clean(row.firstName)} ${clean(row.surname)}`.trim() || clean(row.email)
}

function isManagerOrAdmin(user: ProjectManagerAccount): boolean {
  return Boolean(
    user.isSuperAdmin ||
      user.permissions?.adminAccess ||
      user.role === 'admin' ||
      user.permissions?.manager ||
      user.role === 'manager'
  )
}

function sameOrganisation(user: ProjectManagerAccount, organizationId?: string): boolean {
  if (!organizationId || !clean(user.organizationId)) return true
  return user.organizationId === organizationId
}

/** Active accepted manager or admin in this organisation. Operative mode is not a manager. */
export function isEligibleProjectManagerAccount(user: ProjectManagerAccount, organizationId?: string): boolean {
  if (!sameOrganisation(user, organizationId)) return false
  if (user.isActive === false) return false
  if (isPendingPerson(user)) return false
  if (user.permissions?.operativeMode) return false
  if (user.permissions || user.role || user.isSuperAdmin) return isManagerOrAdmin(user)
  return true
}

function accountIneligible(user: ProjectManagerAccount, organizationId?: string): boolean {
  if (!sameOrganisation(user, organizationId)) return true
  if (user.isActive === false) return true
  if (isPendingPerson(user)) return true
  if (user.permissions?.operativeMode) return true
  if (user.permissions || user.role || user.isSuperAdmin) return !isManagerOrAdmin(user)
  return false
}

function rosterMatches(row: ProjectManagerRosterRow, storedId: string): boolean {
  return managerIdsMatch(row.id, storedId) || managerIdsMatch(stableManagerDocumentId(row.id), storedId)
}

function findRoster(managers: readonly ProjectManagerRosterRow[], storedId: string): ProjectManagerRosterRow | undefined {
  return managers.find((row) => rosterMatches(row, storedId))
}

function findAccount(users: readonly ProjectManagerAccount[], storedId: string): ProjectManagerAccount | undefined {
  return users.find((user) => managerIdsMatch(user.id, storedId))
}

function accountsForEmail(users: readonly ProjectManagerAccount[], email: string): ProjectManagerAccount[] {
  if (!email) return []
  return users.filter((user) => normalizeManagerEmail(user.email) === email)
}

function preferredAccount(users: ProjectManagerAccount[], organizationId?: string): ProjectManagerAccount | undefined {
  const inOrg = users.filter((user) => sameOrganisation(user, organizationId))
  const pool = inOrg.length > 0 ? inOrg : users
  return [...pool].sort((a, b) => {
    const score = (user: ProjectManagerAccount) =>
      (user.isActive === false ? 0 : 4) + (isPendingPerson(user) ? 0 : 2) + (isManagerOrAdmin(user) ? 1 : 0)
    return score(b) - score(a)
  })[0]
}

function linkedAccount(
  row: ProjectManagerRosterRow | undefined,
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): ProjectManagerAccount | undefined {
  if (!row) return undefined
  const email = normalizeManagerEmail(row.email)
  return preferredAccount(accountsForEmail(users, email), organizationId)
}

export type ClassifiedManager =
  | { kind: 'unknown' }
  | { kind: 'ineligible'; name: string }
  | { kind: 'eligible'; name: string; choiceId: string }

export function classifyStoredManager(
  storedId: string,
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): ClassifiedManager {
  const id = clean(storedId)
  if (!id) return { kind: 'unknown' }
  const roster = findRoster(managers, id)
  const account = findAccount(users, id) || linkedAccount(roster, users, organizationId)
  if (!roster && !account) return { kind: 'unknown' }

  if (account && accountIneligible(account, organizationId)) {
    return { kind: 'ineligible', name: roster ? rosterName(roster) : accountName(account) }
  }
  if (!account && roster && roster.isActive === false) {
    return { kind: 'ineligible', name: rosterName(roster) }
  }
  if (roster && isPlaceholderManager({
    firstName: clean(roster.firstName),
    lastName: clean(roster.lastName),
    email: clean(roster.email),
  })) {
    return { kind: 'ineligible', name: rosterName(roster) }
  }
  if (organizationId && roster?.organizationId && roster.organizationId !== organizationId && !account) {
    return { kind: 'ineligible', name: rosterName(roster) }
  }

  const name = roster && rosterName(roster) ? rosterName(roster) : account ? accountName(account) : ''
  const choiceId = roster ? choiceIdForRoster(roster.id) : `user:${account?.id || bareId(id)}`
  return { kind: 'eligible', name, choiceId }
}

function catalogueEligible(
  row: ProjectManagerRosterRow,
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): boolean {
  if (row.isActive === false) return false
  if (!clean(row.email)) return false
  if (organizationId && row.organizationId && row.organizationId !== organizationId) return false
  if (isPlaceholderManager({
    firstName: clean(row.firstName),
    lastName: clean(row.lastName),
    email: clean(row.email),
  })) {
    return false
  }
  const linked = accountsForEmail(users, normalizeManagerEmail(row.email))
  if (linked.length === 0) return true
  const inOrg = linked.filter((user) => sameOrganisation(user, organizationId))
  if (inOrg.length === 0) return false
  const account = preferredAccount(inOrg, organizationId)
  return Boolean(account && isEligibleProjectManagerAccount(account, organizationId))
}

/** Options for the project and small-works manager picker. */
export function projectManagerChoices(
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): ProjectManagerChoice[] {
  const options: ProjectManagerChoice[] = []
  const seenEmails = new Set<string>()

  for (const manager of managers) {
    if (!catalogueEligible(manager, users, organizationId)) continue
    const email = normalizeManagerEmail(manager.email)
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    options.push({
      id: choiceIdForRoster(manager.id),
      label: rosterName(manager),
      email: clean(manager.email),
    })
  }

  for (const user of users) {
    if (!isEligibleProjectManagerAccount(user, organizationId)) continue
    const email = normalizeManagerEmail(user.email)
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    options.push({
      id: `user:${user.id}`,
      label: accountName(user),
      email: clean(user.email),
      userId: user.id,
    })
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export function assignableProjectManagers<T extends ProjectManagerRosterRow>(
  managers: readonly T[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): T[] {
  return managers.filter((manager) => catalogueEligible(manager, users, organizationId))
}

function storedManagerIds(project: {
  managerId?: string | null
  managerIds?: readonly string[] | null
}): string[] {
  const ids: string[] = []
  for (const id of project.managerIds || []) {
    const value = clean(id)
    if (value && !ids.some((existing) => managerIdsMatch(existing, value))) ids.push(value)
  }
  const primary = clean(project.managerId)
  if (primary && !ids.some((existing) => managerIdsMatch(existing, primary))) ids.unshift(primary)
  return ids
}

/**
 * Ids to keep on the edit form.
 * Ineligible people (such as a deactivated account still on the catalogue) are removed.
 * An id that does not match anyone loaded yet is kept, so a save cannot drop a real assignment.
 */
export function projectManagerSelectionIds(
  project: { managerId?: string | null; managerIds?: readonly string[] | null },
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): string[] {
  const choices = projectManagerChoices(managers, users, organizationId)
  const selected: string[] = []
  for (const id of storedManagerIds(project)) {
    const classified = classifyStoredManager(id, managers, users, organizationId)
    if (classified.kind === 'ineligible') continue
    if (classified.kind === 'unknown') {
      if (!selected.some((existing) => managerIdsMatch(existing, id))) selected.push(id)
      continue
    }
    const choice = choices.find(
      (option) => managerIdsMatch(option.id, classified.choiceId) || managerIdsMatch(option.id, id)
    )
    const next = choice?.id || classified.choiceId
    if (!selected.some((existing) => managerIdsMatch(existing, next))) selected.push(next)
  }
  return selected
}

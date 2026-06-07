import type { Operative, User } from '@/types'

export interface AnnualLeavePerson {
  id: string
  displayName: string
  subtitle: string
  tradeLabel: string
  firstNameSort: string
  surnameSort: string
  userId?: string
  operativeId?: string
}

export type AnnualLeavePersonSort = 'firstName' | 'surname' | 'trade'

function displayNameForUser(user: User): string {
  const name = `${user.firstName} ${user.surname}`.trim()
  return name || user.email
}

function operativeTradeLabel(op: Operative): string {
  const data = op as Operative & { tradeTypeCustom?: string; tradeTypePreset?: string }
  const custom = data.tradeTypeCustom?.trim() ?? ''
  if (custom) return custom
  const preset = data.tradeTypePreset?.trim() ?? ''
  return preset || 'General'
}

function userTradeLabel(user: User, operative?: Operative): string {
  if (operative) return operativeTradeLabel(operative)
  if (user.permissions.manager) return 'Management'
  const custom = user.tradeTypeCustom?.trim() ?? ''
  if (custom) return custom
  const preset = user.tradeTypePreset?.trim() ?? ''
  return preset || 'General'
}

function nameParts(display: string, operative?: Operative): { first: string; last: string } {
  if (operative?.firstName) {
    return { first: operative.firstName, last: operative.lastName }
  }
  const parts = display.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return { first: parts[0], last: parts[parts.length - 1] }
  }
  return { first: display, last: display }
}

export function buildAnnualLeavePeople(users: User[], operatives: Operative[]): AnnualLeavePerson[] {
  const rows: AnnualLeavePerson[] = []
  const seenEmails = new Set<string>()

  const operativesByEmail = new Map<string, Operative>()
  for (const op of operatives) {
    operativesByEmail.set(op.email.toLowerCase(), op)
  }

  for (const user of users) {
    if (!user.isActive) continue
    if (user.permissions.annualLeaveSelfBook) continue
    const email = user.email.toLowerCase()
    if (seenEmails.has(email)) continue
    seenEmails.add(email)

    const linkedOp = operativesByEmail.get(email)
    const trade = userTradeLabel(user, linkedOp)
    const display = displayNameForUser(user)
    const { first, last } = nameParts(display, linkedOp)

    let roleHint = 'Team member'
    if (user.permissions.operativeMode || user.role === 'operative') roleHint = 'Operative'
    else if (user.permissions.adminAccess || user.role === 'admin') roleHint = 'Admin'
    else if (user.permissions.manager) roleHint = 'Manager'

    rows.push({
      id: `user-${user.id}`,
      displayName: display,
      subtitle: `${roleHint} · ${user.email}`,
      tradeLabel: trade,
      firstNameSort: first,
      surnameSort: last,
      userId: user.id,
      operativeId: linkedOp?.id,
    })
  }

  for (const op of operatives) {
    if (!op.isActive) continue
    const email = op.email.toLowerCase()
    const linkedUser = users.find((u) => u.email.toLowerCase() === email)
    if (linkedUser?.permissions.annualLeaveSelfBook) continue
    if (seenEmails.has(email)) continue
    seenEmails.add(email)

    const display = `${op.firstName} ${op.lastName}`.trim() || op.email
    rows.push({
      id: `op-${op.id}`,
      displayName: display,
      subtitle: `Operative · ${op.email}`,
      tradeLabel: operativeTradeLabel(op),
      firstNameSort: op.firstName,
      surnameSort: op.lastName,
      userId: undefined,
      operativeId: op.id,
    })
  }

  return rows
}

export function sortAnnualLeavePeople(
  people: AnnualLeavePerson[],
  sortMode: AnnualLeavePersonSort
): AnnualLeavePerson[] {
  const rows = [...people]
  switch (sortMode) {
    case 'firstName':
      rows.sort((a, b) => a.firstNameSort.localeCompare(b.firstNameSort, undefined, { sensitivity: 'base' }))
      break
    case 'surname':
      rows.sort((a, b) => a.surnameSort.localeCompare(b.surnameSort, undefined, { sensitivity: 'base' }))
      break
    case 'trade':
      rows.sort((a, b) => {
        const tradeCmp = a.tradeLabel.localeCompare(b.tradeLabel, undefined, { sensitivity: 'base' })
        if (tradeCmp !== 0) return tradeCmp
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      })
      break
  }
  return rows
}

export function bookingMatchesPerson(
  booking: { userId?: string; operativeId?: string },
  person: AnnualLeavePerson
): boolean {
  if (person.userId && booking.userId === person.userId) return true
  if (person.operativeId && booking.operativeId === person.operativeId) return true
  return false
}

export function resolvePersonName(
  booking: { userId?: string; operativeId?: string },
  users: User[],
  operatives: Operative[]
): string {
  if (booking.userId) {
    const user = users.find((u) => u.id === booking.userId)
    if (user) return displayNameForUser(user)
  }
  if (booking.operativeId) {
    const op = operatives.find((o) => o.id === booking.operativeId)
    if (op) return `${op.firstName} ${op.lastName}`.trim() || op.email
  }
  return 'Unknown'
}

import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import { isPendingPerson } from '@/lib/staff/pendingPeople'
import type { User } from '@/types'

export function userDisplayName(user: Pick<User, 'firstName' | 'surname' | 'email'>): string {
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email
}

export function userTradeLabel(user: Pick<User, 'tradeTypePreset' | 'tradeTypeCustom'>): string {
  const trade = displayTradeType(user.tradeTypePreset, user.tradeTypeCustom)
  return trade === '—' ? 'General' : trade
}

export function isHsRecipient(user: User): boolean {
  if (!user.isActive || isPendingPerson(user)) return false
  return Boolean(
    user.permissions.operativeMode ||
      user.permissions.operatives ||
      user.permissions.manager ||
      user.role === 'operative' ||
      user.role === 'manager'
  )
}

export type HsRecipientGroup = { trade: string; users: User[] }

export function filterHsRecipients(users: User[], search: string, trade: string): User[] {
  const q = search.trim().toLowerCase()
  const tradeFilter = trade.trim()
  return users.filter((user) => {
    if (tradeFilter && tradeFilter !== 'All' && userTradeLabel(user) !== tradeFilter) return false
    if (!q) return true
    return (
      userDisplayName(user).toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      userTradeLabel(user).toLowerCase().includes(q)
    )
  })
}

export function groupRecipientsByTrade(users: User[]): HsRecipientGroup[] {
  const map = new Map<string, User[]>()
  for (const user of users) {
    const trade = userTradeLabel(user)
    const list = map.get(trade) || []
    list.push(user)
    map.set(trade, list)
  }
  return Array.from(map.entries())
    .map(([trade, grouped]) => ({
      trade,
      users: [...grouped].sort((a, b) => userDisplayName(a).localeCompare(userDisplayName(b))),
    }))
    .sort((a, b) => {
      if (a.trade === 'General' && b.trade !== 'General') return 1
      if (b.trade === 'General' && a.trade !== 'General') return -1
      return a.trade.localeCompare(b.trade)
    })
}

/** iOS HSIssueTalkSheet talk filters: All, General when present, then the other trades A–Z. */
export function recipientTradeFilters(users: User[]): string[] {
  const labels = new Set(users.map((user) => userTradeLabel(user)).filter(Boolean))
  const hasGeneral = labels.has('General')
  const rest = Array.from(labels)
    .filter((label) => label !== 'General')
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return ['All', ...(hasGeneral ? ['General'] : []), ...rest]
}

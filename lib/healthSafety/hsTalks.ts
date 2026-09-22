import type { HSToolboxTalk } from '@/types'

/** iOS master-library trade order. General is a real category, not an empty-trades leftover. */
export const TALK_CATEGORY_ORDER = [
  'General',
  'Electrical',
  'Mechanical',
  'Plumbing & Gas',
  'Groundworks',
  'Scaffolding',
  'Brick & Block',
  'Joinery',
  'Drylining',
  'Painting',
  'Roofing',
  'Demolition',
  'Steel Fixing',
  'Plant',
] as const

function talkKey(talk: Pick<HSToolboxTalk, 'id' | 'referenceCode'>): string {
  return (talk.referenceCode || talk.id).trim().toUpperCase()
}

function isGeneralTalk(talk: Pick<HSToolboxTalk, 'isGeneral' | 'category' | 'trades'>): boolean {
  return talk.isGeneral || talk.trades.length === 0 || talk.category.trim().toLowerCase() === 'general'
}

function categoryRank(category: string): number {
  const index = TALK_CATEGORY_ORDER.findIndex((item) => item.toLowerCase() === category.trim().toLowerCase())
  return index === -1 ? TALK_CATEGORY_ORDER.length + 1 : index
}

export function overlayToolboxLibraries(base: HSToolboxTalk[], extra: HSToolboxTalk[]): HSToolboxTalk[] {
  const merged = new Map<string, HSToolboxTalk>()
  for (const talk of base) merged.set(talkKey(talk), talk)
  for (const talk of extra) {
    const key = talkKey(talk)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, talk)
      continue
    }
    if (!existing.fileURL && talk.fileURL) merged.set(key, { ...existing, fileURL: talk.fileURL })
  }
  return Array.from(merged.values())
}

export function filterToolboxTalks(talks: HSToolboxTalk[], search: string, trade: string): HSToolboxTalk[] {
  const q = search.trim().toLowerCase()
  const tradeFilter = trade.trim()
  return talks.filter((talk) => {
    if (tradeFilter && tradeFilter !== 'All') {
      if (tradeFilter === 'General') {
        if (!isGeneralTalk(talk)) return false
      } else if (!(talk.isGeneral || talk.trades.includes(tradeFilter))) {
        return false
      }
    }
    if (!q) return true
    return (
      talk.title.toLowerCase().includes(q) ||
      talk.purpose.toLowerCase().includes(q) ||
      talk.category.toLowerCase().includes(q) ||
      (talk.referenceCode || '').toLowerCase().includes(q) ||
      talk.trades.some((item) => item.toLowerCase().includes(q))
    )
  })
}

export function talkTradeFilters(talks: HSToolboxTalk[]): string[] {
  const trades = new Set<string>()
  let hasGeneral = false
  for (const talk of talks) {
    if (isGeneralTalk(talk)) hasGeneral = true
    for (const trade of talk.trades) {
      if (trade.trim()) trades.add(trade.trim())
    }
  }
  const ordered = TALK_CATEGORY_ORDER.filter((item) => item !== 'General' && trades.has(item))
  const extras = Array.from(trades)
    .filter((item) => !TALK_CATEGORY_ORDER.includes(item as (typeof TALK_CATEGORY_ORDER)[number]))
    .sort((a, b) => a.localeCompare(b))
  return ['All', ...(hasGeneral ? ['General'] : []), ...ordered, ...extras]
}

export function groupTalksByCategory(talks: HSToolboxTalk[]): { category: string; talks: HSToolboxTalk[] }[] {
  const map = new Map<string, HSToolboxTalk[]>()
  for (const talk of talks) {
    const category = (talk.category || 'General').trim() || 'General'
    const list = map.get(category) || []
    list.push(talk)
    map.set(category, list)
  }
  return Array.from(map.entries())
    .map(([category, grouped]) => ({
      category,
      talks: [...grouped].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category))
}

/** Issuers are managers, so they are not in the operative picker. Always add them when they want to sign. */
export function recipientsWithIssuer(
  recipientUserIds: string[],
  issuerUserId: string,
  includeIssuer: boolean
): string[] {
  const ids = new Set(recipientUserIds.filter(Boolean))
  if (includeIssuer && issuerUserId) ids.add(issuerUserId)
  return Array.from(ids)
}

/** Local date `yyyy-MM-dd` + time `HH:mm` → publishAt. Null when either part is missing. */
export function combineLocalDateAndTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time.trim())
  if (!dateMatch || !timeMatch) return null
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  const value = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (Number.isNaN(value.getTime())) return null
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null
  return value
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function defaultScheduleDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(8, 0, 0, 0)
  return toDateInputValue(date)
}

export function defaultScheduleTime(): string {
  return '08:00'
}

export function nextRamsVersion(existing: { title: string; version: number }[], title: string): number {
  const key = title.trim().toLowerCase()
  const same = existing.filter((doc) => doc.title.trim().toLowerCase() === key)
  if (same.length === 0) return 1
  return Math.max(...same.map((doc) => doc.version)) + 1
}

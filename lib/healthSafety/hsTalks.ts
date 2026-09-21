import type { HSToolboxTalk } from '@/types'

export function filterToolboxTalks(talks: HSToolboxTalk[], search: string, trade: string): HSToolboxTalk[] {
  const q = search.trim().toLowerCase()
  const tradeFilter = trade.trim()
  return talks.filter((talk) => {
    if (tradeFilter && tradeFilter !== 'All') {
      const matchesTrade = talk.isGeneral || talk.trades.includes(tradeFilter)
      if (!matchesTrade) return false
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
  const set = new Set<string>(['All'])
  for (const talk of talks) {
    for (const trade of talk.trades) {
      if (trade.trim()) set.add(trade)
    }
  }
  return Array.from(set)
}

export function groupTalksByCategory(talks: HSToolboxTalk[]): { category: string; talks: HSToolboxTalk[] }[] {
  const map = new Map<string, HSToolboxTalk[]>()
  for (const talk of talks) {
    const category = (talk.category || 'general').trim() || 'general'
    const list = map.get(category) || []
    list.push(talk)
    map.set(category, list)
  }
  return Array.from(map.entries())
    .map(([category, grouped]) => ({
      category,
      talks: [...grouped].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
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

import type { Skill } from '@/types'
import { STAFF_TRADE_PRESETS } from '@/lib/staff/staffTradeTypes'

export function normalizedSkillPair(name: string, trade: string): [string, string] {
  const n = name.trim().toLowerCase()
  const t = trade.trim().toLowerCase()
  return [n, t]
}

export function isDuplicateSkill(
  skills: Skill[],
  name: string,
  trade: string,
  excludeId?: string
): boolean {
  const [nk, tk] = normalizedSkillPair(name, trade)
  return skills.some((skill) => {
    if (excludeId && skill.id === excludeId) return false
    const [sk, st] = normalizedSkillPair(skill.name, skill.trade || '')
    return sk === nk && st === tk
  })
}

export function distinctSkillTrades(skills: Skill[]): string[] {
  const seen = new Set<string>()
  const trades: string[] = []
  for (const skill of skills) {
    const trade = skill.trade?.trim()
    if (!trade) continue
    const key = trade.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    trades.push(trade)
  }
  return trades.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Staff preset trades (user setup) + org skill trades + any extra values. */
export function buildSkillTradeSuggestions(skills: Skill[], extraTrades: string[] = []): string[] {
  const seen = new Set<string>()
  const merged: string[] = []

  const add = (trade: string) => {
    const trimmed = trade.trim()
    if (!trimmed || trimmed.toLowerCase() === 'other') return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    merged.push(trimmed)
  }

  for (const trade of STAFF_TRADE_PRESETS) add(trade)
  for (const trade of extraTrades) add(trade)
  for (const trade of distinctSkillTrades(skills)) add(trade)

  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function searchSkillTrades(query: string, trades: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return trades.slice(0, limit)
  return trades
    .filter((trade) => trade.toLowerCase().includes(q) && trade.toLowerCase() !== q)
    .slice(0, limit)
}

export function displaySkillTrade(trade?: string): string {
  const trimmed = trade?.trim()
  return trimmed || '—'
}

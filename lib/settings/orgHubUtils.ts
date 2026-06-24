import type { User } from '@/types'
import { bankHolidayRegionLabel } from '@/lib/settings/bankHolidayRegions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function orgInitials(name: string, maxLen = 2): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return 'OR'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, maxLen).toUpperCase()
}

export function personDisplayName(user: Pick<User, 'firstName' | 'surname' | 'email'>): string {
  const joined = [user.firstName, user.surname].map((s) => s.trim()).filter(Boolean).join(' ')
  if (joined) return joined
  return user.email || '—'
}

export function orgCountryLabel(code?: string): string {
  if (!code) return 'United Kingdom'
  return bankHolidayRegionLabel(code)
}

export function orgCreatedLabel(createdAt: unknown): string {
  const date = toDate(createdAt)
  return `Since ${MONTHS[date.getMonth()]} '${String(date.getFullYear() % 100).padStart(2, '0')}`
}

function toDate(value: unknown): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }
  return new Date()
}

/** 12-hour label for material cut-off picker (30-minute steps). */
export function materialCutoffTimeLabel(totalMinutes: number): string {
  const hours24 = Math.max(0, Math.min(23, Math.floor(totalMinutes / 60)))
  const minutes = Math.max(0, Math.min(59, totalMinutes % 60))
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export const MATERIAL_CUTOFF_TIME_OPTIONS: number[] = Array.from({ length: 48 }, (_, index) => index * 30)

export { MONTHS as ORG_HUB_MONTHS }

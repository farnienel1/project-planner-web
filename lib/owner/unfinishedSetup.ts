import { maskEmail } from '@/lib/auth/maskEmail'

export const UNFINISHED_SETUP_PREFIX = 'Unfinished setup'
export const ABANDONED_SIGNUP_MONTHS = 12

export function unfinishedSetupLabel(email?: string | null, reveal = false): string {
  const value = (email || '').trim()
  if (!value) return UNFINISHED_SETUP_PREFIX
  return `${UNFINISHED_SETUP_PREFIX} · ${reveal ? value : maskEmail(value)}`
}

export function isUnfinishedSetupName(name?: string | null): boolean {
  const value = (name || '').trim()
  return !value || value === 'Unknown organisation' || value === 'Unnamed organisation' || value.startsWith(UNFINISHED_SETUP_PREFIX)
}

export function isAbandonedUnfinishedSignup(createdAt?: Date | null, now = new Date()): boolean {
  if (!createdAt || createdAt.getTime() === 0) return false
  const cutoff = new Date(now.getTime())
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  return createdAt.getTime() <= cutoff.getTime()
}

export function abandonedSignupCutoff(now = new Date()): Date {
  const cutoff = new Date(now.getTime())
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ABANDONED_SIGNUP_MONTHS)
  return cutoff
}

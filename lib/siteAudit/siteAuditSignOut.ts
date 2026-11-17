'use client'

/**
 * A sign-out the person chooses (review of #389, as the iPhone since 14 Nov): when they have site audits not sent
 * yet, the confirm says so and, if they go ahead, those audits are removed from this browser. A forced sign-out
 * (idle, deactivated, a refused session) never comes here: the audits stay, shown only to that person.
 */
import { removeUnsentSiteAuditsFor, unsentSiteAuditCount } from '@/lib/siteAudit/siteAuditSender'

export function unsentAuditsSignOutMessage(count: number): string {
  return count === 1
    ? 'You have 1 site audit that has not been sent. Signing out removes it from this browser. Sign out anyway?'
    : `You have ${count} site audits that have not been sent. Signing out removes them from this browser. Sign out anyway?`
}

/** True when the person confirmed signing out (their unsent audits, if any, are then removed). */
export async function confirmChosenSignOut(userId: string | null | undefined, confirm: (message: string) => boolean = (m) => window.confirm(m)): Promise<boolean> {
  const count = await unsentSiteAuditCount(userId).catch(() => 0)
  if (count === 0) return confirm('Are you sure you want to sign out?')
  if (!confirm(unsentAuditsSignOutMessage(count))) return false
  if (userId) await removeUnsentSiteAuditsFor(userId).catch(() => undefined)
  return true
}

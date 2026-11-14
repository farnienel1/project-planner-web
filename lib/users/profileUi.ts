/**
 * Display helpers for the User profile and Edit user pages (UI pack, docs/design/user-profile-ui/). Display only:
 * no rule, no read, no write. Moved out of the components so they can be tested.
 */
import { formatMoney } from '@/lib/canonical'
import type { User } from '@/types'
import type { ProfileIconName } from '@/components/users/profile-ui/icons'

/**
 * The rate line the profile shows (Details and the band): hourly when the stored basis is hourly with a rate, day when
 * it is day with a rate, else none — the same test the page made before the restyle.
 */
export function profileRateRow(
  pay: { payBasis?: string; dayRate?: number | null; hourlyRate?: number | null } | null | undefined,
  currencyCode: string
): { label: string; value: string } | null {
  if (pay?.payBasis === 'hourly' && pay.hourlyRate != null) {
    return { label: 'Hourly rate', value: `${formatMoney(Number(pay.hourlyRate), currencyCode)}/hr` }
  }
  if (pay?.payBasis === 'day' && pay.dayRate != null) {
    return { label: 'Day rate', value: `${formatMoney(Number(pay.dayRate), currencyCode)}/day` }
  }
  return null
}

/** Icon of the "[Role] setup" section, in the same order as `setupSectionTitle`. */
export function setupSectionIcon(user: Pick<User, 'isSuperAdmin' | 'role' | 'permissions'>): ProfileIconName {
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return 'shield'
  if (user.permissions.operativeMode) return 'hat'
  if (user.permissions.manager) return 'brief'
  return 'user'
}

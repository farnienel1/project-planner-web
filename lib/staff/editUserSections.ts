import type { User } from '@/types'
import { canViewPersonPay } from '@/lib/canonical/payProfile'
import { isGhostUser } from '@/lib/canonical/userRosterSegment'
import { canEditTargetUser, canUseAdminAccountTools } from '@/lib/staff/userEditPermissions'

/**
 * Which Edit user sections show, and whether they can be changed (17 Nov, owner bug: the Super Admin could never be
 * set to PAYE because this page hid Employment type and the annual leave allowance for every Super Admin).
 *
 * The rulebook never hides a person's employment type or leave allowance because of their level (§4.4, §8): the
 * Super Admin is an admin whose employment type decides their timesheets and pay and whose PAYE allowance counts. So
 * no section here looks at `isSuperAdmin`:
 *   - shown: the employment type to anyone who may edit the person (`canEditTargetUser`) or see their pay
 *     (`canViewPersonPay`), never a ghost (always self-employed, §11); the leave allowance to anyone who may edit the
 *     person, or any admin (admins see everyone's leave), for every level.
 *   - editable: only where this page lets the viewer change the person at all (`canEditTargetUser`). What the save
 *     may change stays with the rulebook (`canChangePersonPay`, `applyEmploymentTypeChange`, `payRateRequiredError`,
 *     `lineManagerRequiredError`) and the security rules.
 * A section shown but locked carries the reason (`note`). `scripts/check-second-calculators.mjs` refuses a screen that
 * hides pay, employment type or leave fields with `isSuperAdmin` again.
 *
 * Known duplication (review of #385, nit): this is a screen decision, so it is not in the rulebook, and iOS makes the
 * same one in Swift (`EditUserView.shouldShowAnnualLeaveAccessToggle` / `shouldShowAnnualLeaveEntitlementSection`, the
 * Employment type row's `canViewPay` / `canChangePay`, and `UserStore.mayChangeEmploymentAndLeaveFields`). Change both
 * together; if they ever need to agree exactly, move the decision into lib/canonical.
 */
export type EditUserSection = { shown: boolean; editable: boolean; note: string | null }

/** Shown when another admin opens the Super Admin's profile: this page lets only the Super Admin change it. */
export const SUPER_ADMIN_PROFILE_READ_ONLY_NOTE =
  "Only the Super Admin can change the Super Admin's profile. Shown here so you can check it."

const HIDDEN: EditUserSection = { shown: false, editable: false, note: null }

function lockedNote(current: User | null, target: User): string | null {
  return target.isSuperAdmin && !current?.isSuperAdmin ? SUPER_ADMIN_PROFILE_READ_ONLY_NOTE : null
}

function hasStaffLevel(target: User): boolean {
  const permissions = target.permissions ?? ({} as User['permissions'])
  return Boolean(
    permissions.operativeMode || permissions.manager || permissions.adminAccess || target.isSuperAdmin || target.role === 'admin'
  )
}

export function editUserEmploymentTypeSection(
  current: User | null,
  target: User | null,
  roster: ReadonlyArray<User> | null | undefined
): EditUserSection {
  if (!current || !target || isGhostUser(target)) return HIDDEN
  const editable = canEditTargetUser(current, target)
  const shown = editable || canViewPersonPay(current as never, target as never, (roster ?? []) as never)
  if (!shown) return HIDDEN
  return { shown, editable, note: editable ? null : lockedNote(current, target) }
}

export function editUserAnnualLeaveSection(current: User | null, target: User | null): EditUserSection {
  if (!current || !target || !hasStaffLevel(target)) return HIDDEN
  const editable = canEditTargetUser(current, target)
  const shown = editable || canUseAdminAccountTools(current)
  if (!shown) return HIDDEN
  return { shown, editable, note: editable ? null : lockedNote(current, target) }
}

/**
 * Review of #385: whether Edit user shows the VAT / UTR fields. The rulebook decides who sees them
 * (`canViewSensitiveProfile`, §12: the person themself and admins), for every level — so the Super Admin and admins
 * now get them on Edit user (they sat inside the operative / manager-only "Timesheets enabled" block). A viewer who
 * saw the "Held by admin" placeholder before (`shownBefore`) still does. Never a ghost (no tax ids, §11).
 */
export function editUserTaxIdsSectionShown(input: {
  target: User | null
  viewerMaySee: boolean
  shownBefore: boolean
}): boolean {
  if (!input.target || isGhostUser(input.target)) return false
  return input.viewerMaySee || input.shownBefore
}

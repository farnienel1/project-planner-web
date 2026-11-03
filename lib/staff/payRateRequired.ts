/**
 * Rulebook 1.14.0 §8, §11: a self-employed person must have a pay rate. The rule is the canonical
 * `payRateRequiredError` / `usersMissingPayRate`; this file only maps web `User` rows onto its inputs and resolves
 * who may set pay (`canChangePersonPay`) from the signed-in user.
 */
import { canChangePersonPay, payRateRequiredError, usersMissingPayRate } from '@/lib/canonical'
import type { User } from '@/types'

/** Whether `saver` may set the pay of the subject (`canChangePersonPay`). A new person (Add User) has no id yet. */
export function maySetPayOf(
  saver: User | null | undefined,
  subject: { id?: string | null; isOperative: boolean }
): boolean {
  if (!saver?.id) return false
  const operativeMode = Boolean(saver.permissions?.operativeMode)
  return canChangePersonPay(
    {
      userId: saver.id,
      isAdmin: Boolean(saver.isSuperAdmin || saver.permissions?.adminAccess || (saver.role === 'admin' && !operativeMode)),
      isManager: Boolean(saver.permissions?.manager || saver.role === 'manager'),
      hasOperativesAccess: Boolean(saver.permissions?.operatives),
      isOperativeMode: operativeMode,
    },
    { userId: subject.id ?? '', isOperative: subject.isOperative }
  )
}

/** `payRateRequiredError` on a web profile as it will be saved. */
export function userPayRateRequiredError(
  user: Pick<User, 'employmentType' | 'payBasis' | 'dayRate' | 'hourlyRate'>
): string | null {
  return payRateRequiredError({
    employmentType: user.employmentType,
    payBasis: user.payBasis,
    dayRate: user.dayRate,
    hourlyRate: user.hourlyRate,
  })
}

/** `usersMissingPayRate` over the web roster: the admins' amber clean-up list on Manage Users. */
export function usersWithoutPayRate(users: ReadonlyArray<User>): User[] {
  const rows = users.filter((user) => user && user.id)
  const ids = new Set(
    usersMissingPayRate(
      rows.map((user) => ({
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        formerUserIds: user.formerUserIds ?? [],
        employmentType: user.employmentType,
        payBasis: user.payBasis,
        dayRate: user.dayRate,
        hourlyRate: user.hourlyRate,
        firstName: user.firstName,
        surname: user.surname,
      }))
    )
  )
  return rows.filter((user) => ids.has(user.id))
}

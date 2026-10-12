/**
 * Display order for already-computed warning rows.
 *
 * Both apps call this instead of comparing warning dates in a screen.
 * It does not decide which warnings exist, which window they sit in, or
 * who can see them. Detection stays in warningRows / leaveCoverage /
 * warningDetection.
 *
 * Sort key is the row's calendar/coverage day (`dayKey`, YYYY-MM-DD) —
 * the date the warning is about. Not created-at, dismissed-at, or first-seen.
 * Default is oldest first. A blank or invalid dayKey sorts last either way
 * so undated rows (unverified operatives) do not jump to the top.
 */

export const WARNINGS_SORT_DIRECTIONS = ['oldest', 'newest'] as const
export type WarningsSortDirection = (typeof WARNINGS_SORT_DIRECTIONS)[number]
export const DEFAULT_WARNINGS_SORT_DIRECTION: WarningsSortDirection = 'oldest'

const DATED_DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseWarningsSortDirection(value: unknown): WarningsSortDirection {
  return value === 'newest' ? 'newest' : DEFAULT_WARNINGS_SORT_DIRECTION
}

export function warningDayKeyIsDated(dayKey: unknown): boolean {
  return DATED_DAY_KEY.test(String(dayKey ?? '').trim())
}

export function compareWarningDayKeys(
  a: string,
  b: string,
  direction: WarningsSortDirection = DEFAULT_WARNINGS_SORT_DIRECTION
): number {
  const left = String(a ?? '').trim()
  const right = String(b ?? '').trim()
  const leftDated = warningDayKeyIsDated(left)
  const rightDated = warningDayKeyIsDated(right)
  if (leftDated !== rightDated) return leftDated ? -1 : 1
  if (!leftDated || left === right) return 0
  const ascending = left < right ? -1 : 1
  return parseWarningsSortDirection(direction) === 'newest' ? -ascending : ascending
}

export function sortWarningsByDate<T extends { dayKey?: string | null }>(
  rows: readonly T[],
  direction: WarningsSortDirection | unknown = DEFAULT_WARNINGS_SORT_DIRECTION
): T[] {
  const dir = parseWarningsSortDirection(direction)
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const byDate = compareWarningDayKeys(left.row.dayKey ?? '', right.row.dayKey ?? '', dir)
      return byDate !== 0 ? byDate : left.index - right.index
    })
    .map((entry) => entry.row)
}

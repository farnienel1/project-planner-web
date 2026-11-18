/** Client-side reading of the owner activity counts (`/api/owner/activity`). Display only. */
export type ActivityMetricKey = 'bookings' | 'projects' | 'smallWorks' | 'tasksCompleted'

export type ActivityCountsView = {
  period?: string
  values: Partial<Record<ActivityMetricKey, Record<string, number | null>>>
  failedOrganisations: string[]
} | null

/** One figure for one period column: a number, or null when it is not counted yet or could not be counted (never 0). */
export function activityCell(activity: ActivityCountsView, metric: ActivityMetricKey, rangeId: string): number | null {
  const value = activity?.values?.[metric]?.[rangeId]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

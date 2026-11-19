/**
 * Presentational mapping for the Projects & Small works workspace band (look only,
 * docs/design/projects-overview-ui/). No business rule: the status itself is still
 * `deriveWorkStatus` / `workStatusLabel` in lib/projects/workStatus.ts; this only picks a colour
 * tone from the label that is already shown.
 */

export type ProjectStatusTone = 'active' | 'neutral'
export type ProjectJobKind = 'proj' | 'sw'

/** Green tint for the Active label, neutral for every other label (Upcoming, Completed, Inactive). */
export function projectStatusTone(statusLabel: string): ProjectStatusTone {
  return statusLabel === 'Active' ? 'active' : 'neutral'
}

/** The colour of the job-kind marker and progress bar: projects green, small works amber. */
export function projectJobKind(isSmallWork: boolean): ProjectJobKind {
  return isSmallWork ? 'sw' : 'proj'
}

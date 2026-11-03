/**
 * The three sources that decide which warnings are no longer open: accepted clashes, dismissed warnings and
 * `warningResolutions` (`isWarningActive` / `resolvedWarningKeys`). When any of them failed to load, the Warnings
 * page never lists the rows they would hide as open — it says the approvals could not be loaded, with Retry.
 */
export type WarningDecisionFailures = { accepted: boolean; dismissed: boolean; resolved: boolean }

export const NO_WARNING_DECISION_FAILURES: WarningDecisionFailures = { accepted: false, dismissed: false, resolved: false }

export const WARNING_DECISIONS_FAILED_MESSAGE =
  'Could not load warning approvals and dismissals, so the warning list is not shown (approved or dismissed warnings would appear open).'

export function warningDecisionsFailed(failures: WarningDecisionFailures): boolean {
  return failures.accepted || failures.dismissed || failures.resolved
}

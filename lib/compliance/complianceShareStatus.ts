/**
 * Share links list (rulebook 1.83.0 §31, display only): an active link whose creator is no longer an active admin of
 * the organisation is refused by the share page (`orgComplianceShareCreatorActive`, worked out by the server list
 * route as `creatorStopped`). The list says so instead of showing it as working.
 */

/** Shown on an active link whose creator is no longer an active admin of the organisation. */
export const COMPLIANCE_SHARE_CREATOR_STOPPED_TEXT = 'Stopped — creator is no longer an admin'

/** Why a listed link no longer works, or null when it works. */
export function complianceShareLinkStatusText(link: { state?: string; creatorStopped?: boolean }): string | null {
  return link.state === 'active' && link.creatorStopped ? COMPLIANCE_SHARE_CREATOR_STOPPED_TEXT : null
}

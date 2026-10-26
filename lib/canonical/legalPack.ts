/**
 * Whether a signed-in person must accept the customer legal pack before using
 * the app. Each app passes its own current pack version; both stores the
 * accepted one on users/{uid}.legalPackVersion. A new version asks everyone
 * again, so a change to the terms is always seen.
 */

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function legalPackNeedsAcceptance(input: {
  policyAccepted?: boolean | null
  acceptedVersion?: string | null
  currentVersion: string
}): boolean {
  if (input.policyAccepted !== true) return true
  const current = text(input.currentVersion)
  if (!current) return false
  return text(input.acceptedVersion) !== current
}

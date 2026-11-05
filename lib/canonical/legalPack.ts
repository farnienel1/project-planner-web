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

/**
 * 1.32.0: the one write that records the person accepting the legal pack on `users/{uid}` — `policyAccepted`,
 * `policyAcceptedAt`, `legalPackVersion`, `legalPackAcceptedAt` — plus write metadata (`updatedBy`, `updatedFrom`;
 * the app adds its server `updatedAt`). `acceptedAt` is the app's timestamp value (both "at" fields get it). Null when
 * the version or user id is blank.
 */
export function legalPackAcceptanceWriteFields(input: {
  userId: string
  version: string
  acceptedAt: unknown
  platform: 'web' | 'ios' | 'android'
}): Record<string, unknown> | null {
  const uid = text(input.userId)
  const version = text(input.version)
  if (!uid || !version) return null
  return {
    policyAccepted: true,
    policyAcceptedAt: input.acceptedAt,
    legalPackVersion: version,
    legalPackAcceptedAt: input.acceptedAt,
    updatedBy: uid,
    updatedFrom: input.platform,
  }
}

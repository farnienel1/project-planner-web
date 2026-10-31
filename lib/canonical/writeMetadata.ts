/**
 * Who and where stamp on shared writes.
 *
 * Every write to a shared document (organisation settings, users, bookings, leave, timesheets,
 * warning decisions) carries `updatedBy` (signed-in uid) and `updatedFrom` (platform), and each app
 * adds `updatedAt` as the SDK server timestamp (web `serverTimestamp()`, iOS `FieldValue.serverTimestamp()`).
 * The rulebook only builds the two plain fields; the server timestamp is SDK-specific.
 */

export const WRITE_PLATFORMS = ['web', 'ios', 'android'] as const
export type WritePlatform = (typeof WRITE_PLATFORMS)[number]

export type WriteMetadataFields = {
  updatedBy: string
  updatedFrom: WritePlatform
}

export function writeMetadataFields(userId: unknown, platform: unknown): WriteMetadataFields | null {
  const uid = typeof userId === 'string' ? userId.trim() : ''
  const from = typeof platform === 'string' ? platform.trim().toLowerCase() : ''
  if (!uid) return null
  if (!(WRITE_PLATFORMS as readonly string[]).includes(from)) return null
  return { updatedBy: uid, updatedFrom: from as WritePlatform }
}

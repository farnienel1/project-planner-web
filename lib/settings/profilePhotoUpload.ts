/**
 * Settings profile photo pick/upload. Must match storage.rules
 * .../userProfiles/{userId}/profile.jpg: sized(2 * 1024 * 1024) && image/*.
 */

import { PROFILE_PHOTO_MAX_BYTES, uploadLimitError } from '@/lib/security/uploadLimits'

export { PROFILE_PHOTO_MAX_BYTES }

export const PROFILE_PHOTO_ACCEPT = 'image/*'

export const PROFILE_PHOTO_HINT = 'Image only · max 2MB'

type NamedFile = { name: string; type?: string; size: number }

export function validateProfilePhotoFile(file: NamedFile): string | null {
  return uploadLimitError(file, 'profile')
}

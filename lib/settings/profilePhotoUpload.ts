/**
 * Settings profile photo pick/upload. Must match storage.rules
 * .../userProfiles/{userId}/profile.jpg: sized(2 * 1024 * 1024) && image/*.
 */

import { PROFILE_PHOTO_MAX_BYTES, uploadPickError } from '@/lib/security/uploadLimits'
import { uploadAcceptAttribute, uploadAllowedHint } from '@/lib/canonical/uploadPolicy'

export { PROFILE_PHOTO_MAX_BYTES }

/** Rulebook 1.50.0 §24: a photo (JPEG, PNG, HEIC or WebP), 2 MB after the crop. */
export const PROFILE_PHOTO_ACCEPT = uploadAcceptAttribute('profile_photo')

export const PROFILE_PHOTO_HINT = uploadAllowedHint('profile_photo')

type NamedFile = { name: string; type?: string; size: number }

export function validateProfilePhotoFile(file: NamedFile): string | null {
  // The crop redraws the photo smaller, so only the type is judged here; the cropped file is checked on upload.
  return uploadPickError(file, 'profile')
}

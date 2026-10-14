/**
 * Settings profile photo pick/upload. Must match storage.rules
 * .../userProfiles/{userId}/profile.jpg: sized(2 * 1024 * 1024) && image/*.
 */

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024

export const PROFILE_PHOTO_ACCEPT = 'image/*'

export const PROFILE_PHOTO_HINT = 'Image only · max 2MB'

type NamedFile = { name: string; type?: string; size: number }

export function validateProfilePhotoFile(file: NamedFile): string | null {
  const type = (file.type || '').toLowerCase()
  if (!type.startsWith('image/')) return PROFILE_PHOTO_HINT
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return PROFILE_PHOTO_HINT
  return null
}

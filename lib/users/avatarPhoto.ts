/**
 * Display and caching for the profile photo avatar (RULEBOOK §12). Display only: which URL a
 * person's photo is stored under is read by `parseUserDocument` (`profilePhotoURL`,
 * `profilePhotoUpdatedAtMs`); nothing here writes or clears it.
 *
 * - An attempt belongs to one URL, one `profilePhotoUpdatedAt` and one retry round. A change in
 *   any of them starts a fresh attempt, so a failed load is never remembered for a new photo.
 * - A failed load is retried: first by asking Storage for the current download URL of the same
 *   path (a re-upload to the fixed path issues a new token, so an older URL answers 403), then
 *   again after a delay, when the browser comes back online, or when the tab is shown again.
 */

/** Waits before the automatic retries after a failed load. After the last one, only online / tab shown / a new photo retry. */
export const AVATAR_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const

export function storagePathFromPhotoUrl(url: string): string | null {
  if (url.startsWith('gs://')) return url.replace(/^gs:\/\/[^/]+\//, '')
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return null
  }
  return url.replace(/^\/+/, '')
}

/**
 * The object path inside a Firebase Storage download URL
 * (`https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded path}?alt=media&token=…`).
 */
export function storagePathFromDownloadUrl(url: string): string | null {
  const match = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?#]+)/.exec(url)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

/** The Storage path to ask for a current download URL, from the URL that failed or the stored value. */
export function avatarRefreshPath(failedSrc: string | null | undefined, stored: string | null | undefined): string | null {
  const src = failedSrc?.trim() || ''
  const value = stored?.trim() || ''
  return (src && storagePathFromDownloadUrl(src)) || (value && (storagePathFromDownloadUrl(value) ?? storagePathFromPhotoUrl(value))) || null
}

function stampMs(updatedAt: Date | number | null | undefined): number | null {
  if (updatedAt == null) return null
  const ms = typeof updatedAt === 'number' ? updatedAt : updatedAt.getTime()
  return Number.isFinite(ms) ? Math.round(ms) : null
}

/**
 * One load attempt: the stored URL, `profilePhotoUpdatedAt` and the retry round. A failure is
 * recorded against this key only, so a new URL, a new upload time or a retry round loads again.
 */
export function avatarAttemptKey(
  url: string | null | undefined,
  updatedAt: Date | number | null | undefined,
  retryRound = 0
): string {
  const value = url?.trim() || ''
  if (!value) return ''
  return `${value}#${stampMs(updatedAt) ?? 'none'}#${retryRound}`
}

/** The wait before the next automatic retry after `failedRounds` failed rounds, or null when none is left. */
export function avatarRetryDelayMs(failedRounds: number): number | null {
  if (!Number.isFinite(failedRounds) || failedRounds < 1) return null
  return AVATAR_RETRY_DELAYS_MS[failedRounds - 1] ?? null
}

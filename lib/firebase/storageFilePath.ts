/**
 * Which Storage object a stored download URL names, and whether a path may be read through `/api/storage/file`.
 * Pure (no Firebase import) so the browser fetch and the server route share one test.
 *
 * Why (owner report 26 Nov: every photo in a web site audit PDF was blank): the browser reads a photo's bytes with
 * `fetch(downloadURL)`. Firebase Storage answers a media download with an `Access-Control-Allow-Origin` header only
 * when the bucket has a CORS configuration; without one every fetch fails and every photo keeps its empty box. The
 * route reads the same object on the server, as the signed-in caller (their ID token), so the Storage rules still decide.
 */

export const STORAGE_FILE_PATH_MAX_LENGTH = 1024

/** The object path of a Firebase Storage download URL of `bucket`, or null for anything else. */
export function storageObjectPathFromDownloadUrl(url: string | null | undefined, bucket: string | null | undefined): string | null {
  const wanted = (bucket || '').trim()
  if (!url || !wanted) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'firebasestorage.googleapis.com') return null
  const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(parsed.pathname)
  if (!match) return null
  let urlBucket: string
  let path: string
  try {
    urlBucket = decodeURIComponent(match[1])
    path = decodeURIComponent(match[2])
  } catch {
    return null
  }
  if (urlBucket !== wanted) return null
  return storageFilePathAllowed(path) ? path : null
}

/** A path under `organizations/`, with no `..` segment, no control characters, at most 1024 characters. */
export function storageFilePathAllowed(path: string | null | undefined): path is string {
  if (typeof path !== 'string' || !path || path.length > STORAGE_FILE_PATH_MAX_LENGTH) return false
  if (!path.startsWith('organizations/')) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  return !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
}

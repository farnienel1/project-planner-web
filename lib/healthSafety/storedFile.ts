import { fileReportStoragePath } from '@/lib/canonical'

/**
 * How to open a stored file reference (health & safety documents, uploaded toolbox talks, deadline attachments).
 *
 * - `url`: a Firebase download URL that already carries its access token (or any other http(s) URL): open it as is.
 * - `storage`: a Storage object path — from a `gs://` URL (what iOS stores when `downloadURL()` fails after the
 *   upload), a bare `organizations/...` path, or a Firebase download URL without a token. The app asks Storage for
 *   a fresh download URL (`getDownloadURL`, the signed-in member's read rule) before opening it.
 * - null: nothing that can be opened from the web (blank, `file://` path from a device, or an unknown scheme).
 */
export type StoredFileTarget = { kind: 'url'; url: string } | { kind: 'storage'; path: string }

export function storedFileTarget(fileRef: string | null | undefined): StoredFileTarget | null {
  const raw = typeof fileRef === 'string' ? fileRef.trim() : ''
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    const firebaseObject = /\/v0\/b\/[^/]+\/o\/[^?#]+/.test(raw)
    if (firebaseObject && !/[?&]token=/.test(raw)) {
      const path = fileReportStoragePath(raw)
      if (path) return { kind: 'storage', path }
    }
    return { kind: 'url', url: raw }
  }
  const path = fileReportStoragePath(raw)
  return path ? { kind: 'storage', path } : null
}

/** True when `storedFileTarget` can open the reference. */
export function hasOpenableStoredFile(fileRef: string | null | undefined): boolean {
  return storedFileTarget(fileRef) !== null
}

/** The href to put on a link before anything is resolved: the URL itself, or null when Storage must be asked first. */
export function storedFileDirectHref(fileRef: string | null | undefined): string | null {
  const target = storedFileTarget(fileRef)
  return target?.kind === 'url' ? target.url : null
}

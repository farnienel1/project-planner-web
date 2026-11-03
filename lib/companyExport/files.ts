/**
 * Company data export (launch checklist 2.1): uploaded files listed in files.csv.
 *
 * The binaries are not downloaded. Every exported document is scanned for values that point at Cloud Storage — a
 * Firebase download URL (`firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>`), a `storage.googleapis.com`
 * URL, a `gs://` address, or a field whose name ends in "path" holding an `organizations/…` storage path — and each
 * is one row: where it was found, the storage path and the URL.
 */
import type { ExportValue } from './values'

export type FileReference = {
  collectionPath: string
  documentId: string
  field: string
  storagePath: string
  url: string
}

/** The storage object path for a stored value, or null when it is not a Cloud Storage reference. */
export function storagePathFromValue(value: string, fieldName = ''): { storagePath: string; url: string } | null {
  const text = value.trim()
  if (!text) return null
  const firebase = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?#]+)/i.exec(text)
  if (firebase) return { storagePath: safeDecode(firebase[1]), url: text }
  const gcs = /^https:\/\/storage\.googleapis\.com\/[^/]+\/([^?#]+)/i.exec(text)
  if (gcs) return { storagePath: safeDecode(gcs[1]), url: text }
  const gs = /^gs:\/\/[^/]+\/(.+)$/i.exec(text)
  if (gs) return { storagePath: gs[1], url: '' }
  if (/path$/i.test(fieldName) && /^organizations\/[^/]+\/.+/.test(text) && !/\s/.test(text)) {
    return { storagePath: text, url: '' }
  }
  return null
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Every file reference in one exported document (dotted field paths; array positions as `[i]`). */
export function fileReferencesInDocument(
  collectionPath: string,
  documentId: string,
  data: Record<string, ExportValue>
): FileReference[] {
  const found: FileReference[] = []
  const walk = (value: ExportValue, field: string, name: string) => {
    if (typeof value === 'string') {
      const ref = storagePathFromValue(value, name)
      if (ref) found.push({ collectionPath, documentId, field, ...ref })
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${field}[${index}]`, name))
      return
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) walk(inner, field ? `${field}.${key}` : key, key)
    }
  }
  walk(data, '', '')
  return found
}

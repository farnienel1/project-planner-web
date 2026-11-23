/**
 * Company data export (launch checklist 2.1): uploaded files listed in files.csv.
 *
 * The binaries are not downloaded. Every exported document is scanned for values that point at Cloud Storage — a
 * Firebase download URL (`firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>`), a `storage.googleapis.com`
 * URL, a `gs://` address, or a field whose name ends in "path" holding an `organizations/…` storage path — and each
 * is one row: where it was found, the file's name, its kind and its storage path.
 *
 * Rulebook 1.72.0 (owner decision 23 Nov, C): the export never carries a download URL — a Firebase download URL opens
 * the file without signing in. files.csv lists name, kind and storage path only, and every download URL in the records
 * (CSV and export.json) is replaced by its storage path (`withoutDownloadUrls`).
 */
import { storedFileKind } from '../canonical/storedFiles'
import type { ExportValue } from './values'

export type FileReference = {
  collectionPath: string
  documentId: string
  field: string
  /** The object's file name (the last part of the storage path). */
  name: string
  /** The rulebook's file family (`storedFileKind`, §24), or '' for a path outside them. */
  kind: string
  storagePath: string
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
      if (ref) {
        const name = ref.storagePath.split('/').filter(Boolean).pop() ?? ''
        found.push({ collectionPath, documentId, field, name, kind: storedFileKind(ref.storagePath)?.kind ?? '', storagePath: ref.storagePath })
      }
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

/**
 * 1.72.0 (owner decision 23 Nov, C): the document with every Cloud Storage download URL (`firebasestorage…` /
 * `storage.googleapis.com`) replaced by its storage path — a whole value or a link inside any text — so nothing in the
 * export opens a file without signing in. Other text is kept as it is.
 */
// Every Cloud Storage download URL inside a string, wherever it appears (review of #416: a note or description that
// quotes a link must not keep its token). Group 1 is the encoded object path.
const DOWNLOAD_URL_IN_TEXT =
  /https?:\/\/(?:firebasestorage\.googleapis\.com\/v0\/b\/[^/\s"'<>]+\/o\/|storage\.(?:googleapis|cloud\.google)\.com\/[^/\s"'<>]+\/)([^?#\s"'<>]+)(?:\?[^#\s"'<>]*)?(?:#[^\s"'<>]*)?/gi

/** A string with every Cloud Storage download URL in it replaced by the object's storage path. */
export function withoutDownloadUrlsInText(value: string): string {
  return value.replace(DOWNLOAD_URL_IN_TEXT, (_match, path: string) => safeDecode(path))
}

export function withoutDownloadUrls(data: Record<string, ExportValue>): Record<string, ExportValue> {
  const strip = (value: ExportValue): ExportValue => {
    if (typeof value === 'string') return withoutDownloadUrlsInText(value)
    if (Array.isArray(value)) return value.map((entry) => strip(entry))
    if (value !== null && typeof value === 'object') {
      const out: { [key: string]: ExportValue } = {}
      for (const [key, inner] of Object.entries(value)) out[key] = strip(inner)
      return out
    }
    return value
  }
  return strip(data) as Record<string, ExportValue>
}

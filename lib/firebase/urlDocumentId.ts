/**
 * A Firestore document id taken from a URL (a notification link, a Payrun Snapshot link). Trimmed; refused (null) when
 * empty, containing "/" (it would name another path), or longer than `URL_DOCUMENT_ID_MAX_LENGTH`.
 */
export const URL_DOCUMENT_ID_MAX_LENGTH = 200

export function urlDocumentId(raw: unknown): string | null {
  const id = typeof raw === 'string' ? raw.trim() : ''
  if (!id || id.includes('/') || id.length > URL_DOCUMENT_ID_MAX_LENGTH) return null
  return id
}

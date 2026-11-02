/**
 * Deterministic ids for rows stored without one (rulebook §1 "Document readers"). A reader that meets an array row
 * with no `id` derives one from where the row sits and what it holds, so every platform and every read gives the
 * same id and a decision or edit keyed by it keeps matching. Never random. The next save writes the derived id onto
 * the row.
 */

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * A UUID-shaped, upper-case id derived from `source` (FNV-1a over four seeds): the same on every platform and every
 * read. `timesheetEntryId` (1.7.0) and the 1.8.0 line, item and contact ids use it.
 */
export function derivedDocumentId(source: string): string {
  const input = typeof source === 'string' ? source : String(source ?? '')
  const hex = [0x811c9dc5, 0x01234567, 0x89abcdef, 0x5bd1e995]
    .map((seed) => fnv1a(input, seed).toString(16).padStart(8, '0'))
    .join('')
  const version = `8${hex.slice(13, 16)}`
  const variant = `${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}-${variant}-${hex.slice(20, 32)}`.toUpperCase()
}

/** `derivedDocumentId` of the parent id, the array name, the position and the row's content fields, joined by `|`. */
export function derivedRowId(parentId: unknown, arrayName: string, index: number, content: ReadonlyArray<unknown>): string {
  const parent = typeof parentId === 'string' ? parentId.trim() : ''
  const position = String(Math.max(0, Math.floor(Number(index) || 0)))
  const parts = (content || []).map((value) => (value == null ? '' : typeof value === 'string' ? value : String(value)))
  return derivedDocumentId([parent, arrayName, position, ...parts].join('|'))
}

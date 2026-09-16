/**
 * iOS parity source: Foundation UUID.uuidString (uppercase hex)
 * Spec: docs/ios-parity/01-data-model.md §3, IOS_PARITY_REBUILD.md §5
 */

/** New document IDs must match Swift `UUID().uuidString` (uppercase). */
export function newUppercaseUuid(): string {
  return crypto.randomUUID().toUpperCase()
}

export function asUppercaseUuid(value: string): string {
  return value.trim().toUpperCase()
}

export function isUuidString(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value.trim()
  )
}

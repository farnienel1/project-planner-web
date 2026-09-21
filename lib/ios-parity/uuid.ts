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

function uuidFromSixteenBytes(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes)
  copy[6] = (copy[6] & 0x0f) | 0x40
  copy[8] = (copy[8] & 0x3f) | 0x80
  const hex = [...copy].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
}

/**
 * iOS NotificationService.syntheticNotificationId — SHA-256 of the key, first 16 bytes,
 * RFC 4122 version 4 / variant bits set.
 */
export async function syntheticUuidFromKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key)
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    return uuidFromSixteenBytes(new Uint8Array(digest).slice(0, 16))
  }
  const { createHash } = await import('node:crypto')
  return uuidFromSixteenBytes(new Uint8Array(createHash('sha256').update(key).digest().subarray(0, 16)))
}

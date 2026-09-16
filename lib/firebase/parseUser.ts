import type { User } from '@/types'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'

export function parseOrgUser(docId: string, data: Record<string, unknown>): User | null {
  const parsed = parseAppUserDocument(docId, data)
  return parsed.ok ? parsed.value : null
}

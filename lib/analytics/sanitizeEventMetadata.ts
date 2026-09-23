const BLOCKED_KEY = /^(email|e-?mail|name|firstName|surname|lastName|fullName|displayName|note|notes|comment|message|body|text|title|phone|telephone|address|freeText|description)$/i
const EMAIL_IN_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

const ALLOWED_KEY = /^(id|uid|userId|organizationId|orgId|projectId|taskId|idea|path|category|source|status|count|step|feature|reason|role|kind|type|code)$/i

export function sanitizeEventMetadata(
  metadata?: Record<string, string | number | boolean> | null
): Record<string, string | number | boolean> {
  if (!metadata) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [rawKey, value] of Object.entries(metadata)) {
    const key = rawKey.trim()
    if (!key || BLOCKED_KEY.test(key)) continue
    if (typeof value === 'string') {
      if (EMAIL_IN_VALUE.test(value)) continue
      if (value.length > 200) continue
      if (!ALLOWED_KEY.test(key) && /[\s]/.test(value) && value.length > 40) continue
    }
    out[key] = value
  }
  return out
}

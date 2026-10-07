const PUBLIC_AUTH_KEYS = new Set(['ok', 'error', 'code', 'retryAfterSec'])

/** Responses must not carry ID tokens, refresh tokens, or passwords to the browser. */
export function toPublicAuthBody(body: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (PUBLIC_AUTH_KEYS.has(key)) next[key] = value
  }
  return next
}

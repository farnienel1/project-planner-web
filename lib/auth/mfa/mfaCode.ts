/** Pull a 6-digit email/SMS code out of pasted text that may include spaces or extra copy. */
export function extractMfaCode(raw: string): string {
  const text = String(raw || '')
  const consecutive = text.match(/\d{6}/)
  if (consecutive) return consecutive[0]
  return text.replace(/\D/g, '').slice(0, 6)
}

export function isCompleteMfaCode(raw: string): boolean {
  return extractMfaCode(raw).length === 6
}

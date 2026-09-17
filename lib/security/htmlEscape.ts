/** Escape text for insertion into HTML (emails, map popups). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip CR/LF so values cannot inject extra email headers. */
export function sanitizeEmailHeader(value: string, maxLength = 200): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength)
}

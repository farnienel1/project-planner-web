'use strict'

/** Escape text for insertion into HTML. Same characters as web `lib/security/htmlEscape.ts`. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip CR/LF (and other control characters) so a value cannot add an email header. */
function sanitizeHeader(value, maxLength = 200) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/** A display name for `From:`: header-safe and without the characters that change address parsing. */
function sanitizeDisplayName(value, maxLength = 80) {
  return sanitizeHeader(value, 200)
    .replace(/["<>\\,;:@]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/** Trimmed text, cut to `max` characters; '' for anything that is not a string or number. */
function clamp(value, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).trim().slice(0, max)
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

function isValidEmail(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 3 && text.length <= 254 && EMAIL_PATTERN.test(text)
}

/** Trimmed, lower case. Emails are compared this way everywhere. */
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

module.exports = { escapeHtml, sanitizeHeader, sanitizeDisplayName, clamp, isValidEmail, normalizeEmail }

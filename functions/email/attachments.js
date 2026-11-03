'use strict'

/**
 * Attachment checks for `sendEmail`: PDF, XLSX and CSV only, at most MAX_ATTACHMENTS files and MAX_TOTAL_BYTES
 * decoded in total. The content type is decided here from the file extension; whatever type the caller sent is
 * ignored.
 */

const MAX_ATTACHMENTS = 80
const MAX_TOTAL_BYTES = 10 * 1024 * 1024

const CONTENT_TYPES = Object.freeze({
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
})

class AttachmentError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'AttachmentError'
    this.status = status
  }
}

function extensionOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  return match ? match[1].toLowerCase() : ''
}

/** Decoded size of strict base64 (no whitespace), or -1 when it is not base64. */
function base64DecodedBytes(content) {
  if (!content || content.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(content)) return -1
  if (/=[^=]/.test(content) || /={3,}$/.test(content)) return -1
  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0
  return (content.length / 4) * 3 - padding
}

/**
 * @param {unknown} raw the request's `attachments`
 * @param {string[]} allowedKinds the template's allowed extensions ([] = none allowed)
 * @returns {{ filename: string, content: string, contentType: string, bytes: number }[]}
 */
function parseAttachments(raw, allowedKinds) {
  if (raw == null) return []
  if (!Array.isArray(raw)) throw new AttachmentError('attachments must be a list')
  if (raw.length === 0) return []
  if (!allowedKinds || allowedKinds.length === 0) throw new AttachmentError('This template does not take attachments')
  if (raw.length > MAX_ATTACHMENTS) throw new AttachmentError(`At most ${MAX_ATTACHMENTS} attachments`, 413)
  const parsed = []
  let total = 0
  for (const row of raw) {
    const filename = typeof row?.filename === 'string' ? row.filename.trim() : typeof row?.fileName === 'string' ? row.fileName.trim() : ''
    // eslint-disable-next-line no-control-regex
    if (!filename || filename.length > 200 || /[\\/\u0000-\u001f\u007f"]/.test(filename)) {
      throw new AttachmentError('Each attachment needs a plain file name')
    }
    const kind = extensionOf(filename)
    if (!allowedKinds.includes(kind) || !CONTENT_TYPES[kind]) {
      throw new AttachmentError(`Only ${allowedKinds.map((k) => k.toUpperCase()).join(', ')} attachments are allowed`)
    }
    const content = typeof row.content === 'string' ? row.content.replace(/\s+/g, '') : ''
    const bytes = base64DecodedBytes(content)
    if (bytes <= 0) throw new AttachmentError(`Attachment ${filename} is not base64`)
    total += bytes
    if (total > MAX_TOTAL_BYTES) throw new AttachmentError('Attachments are larger than 10 MB in total', 413)
    parsed.push({ filename, content, contentType: CONTENT_TYPES[kind], bytes })
  }
  return parsed
}

module.exports = { AttachmentError, CONTENT_TYPES, MAX_ATTACHMENTS, MAX_TOTAL_BYTES, base64DecodedBytes, parseAttachments }

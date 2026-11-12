/**
 * The toolbox talk helpers that do not draw a PDF: names, the custom-upload test and the download triggers.
 * Split out of `toolboxTalkPdf.ts` so screens that only need these do not load the PDF library (pdf-lib) up front;
 * `toolboxTalkPdf.ts` re-exports them unchanged.
 */
import type { HSToolboxTalk } from '@/types'

/** WinAnsi-safe text for the standard PDF fonts. */
export function pdfText(value: string): string {
  return value
    .replace(/\u2018|\u2019|\u2032/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014|\u2012/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}

/** iOS HSToolboxTalk.isCustomUpload — an uploaded file is the talk, including a site audit PDF issued as one. */
export function isCustomUploadedTalk(talk: Pick<HSToolboxTalk, 'source' | 'fileURL'>): boolean {
  return talk.source === 'uploaded' && (talk.fileURL || '').trim().length > 0
}

export function toolboxTalkPdfFilename(talk: Pick<HSToolboxTalk, 'title' | 'id'>, now = Date.now()): string {
  const safe = pdfText(talk.title).replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]+/g, '') || talk.id
  return `ToolboxTalk-${safe}-${Math.floor(now / 1000)}.pdf`
}

export function customTalkDownloadName(fileURL: string, talk: Pick<HSToolboxTalk, 'title' | 'id'>): string {
  let path = fileURL.split('?')[0].split('#')[0]
  try {
    path = new URL(fileURL).pathname
  } catch {
    // Keep the raw path when the stored value is not an absolute URL.
  }
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  const last = decoded.split('/').filter(Boolean).pop() || ''
  if (last.includes('.')) return last
  return toolboxTalkPdfFilename(talk)
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadPdfFile(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  triggerDownload(url, name)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function downloadRemoteFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not fetch the file')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

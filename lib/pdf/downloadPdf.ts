/**
 * Saving and sharing a PDF in the browser (display only, guardrail 7: never changes what was generated).
 * No PDF library here, so screens can import it without loading pdf-lib.
 *
 * - `downloadPdf` saves the file straight to the computer (an `<a download>` on an object URL, released afterwards).
 * - `canSharePdf` is whether this browser can share a PDF file (`navigator.share` + `navigator.canShare({ files })`),
 *   so a screen hides its Share button where it would do nothing.
 * - `sharePdf` opens the system share sheet; where it cannot, or the browser refuses, it downloads instead.
 *
 * Every function takes an optional `env` so tests can pass a fake navigator / document / URL.
 */

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

export interface PdfFileEnv {
  navigator?: ShareNavigator
  document?: Pick<Document, 'createElement' | 'body'>
  URL?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>
  setTimeout?: (fn: () => void, ms: number) => unknown
}

/** How long an object URL is kept after the download starts (some browsers read it after `click()` returns). */
export const PDF_OBJECT_URL_RELEASE_MS = 5_000

function browserEnv(env?: PdfFileEnv): Required<PdfFileEnv> | null {
  const doc = env?.document ?? (typeof document !== 'undefined' ? document : undefined)
  const url = env?.URL ?? (typeof URL !== 'undefined' ? URL : undefined)
  if (!doc || !url) return null
  return {
    navigator: env?.navigator ?? (typeof navigator !== 'undefined' ? (navigator as ShareNavigator) : {}),
    document: doc,
    URL: url,
    setTimeout: env?.setTimeout ?? ((fn, ms) => setTimeout(fn, ms)),
  }
}

/** The PDF bytes as a Blob (a copy, so a shared or detached buffer never reaches the Blob). */
export function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

/** The PDF as a File, the shape `navigator.share` takes. */
export function pdfFile(bytes: Uint8Array, fileName: string): File {
  return new File([pdfBlob(bytes)], fileName, { type: 'application/pdf' })
}

/** Saves PDF bytes as a download (no share sheet). The object URL is released afterwards. */
export function downloadPdf(bytes: Uint8Array, fileName: string, env?: PdfFileEnv): void {
  const e = browserEnv(env)
  if (!e) return
  const url = e.URL.createObjectURL(pdfBlob(bytes))
  const link = e.document.createElement('a')
  link.href = url
  link.download = fileName
  e.document.body.appendChild(link)
  link.click()
  link.remove()
  e.setTimeout(() => e.URL.revokeObjectURL(url), PDF_OBJECT_URL_RELEASE_MS)
}

function shareData(bytes: Uint8Array, fileName: string): ShareData {
  return { files: [pdfFile(bytes, fileName)], title: fileName }
}

/**
 * Whether this browser can share a PDF file. False without `navigator.canShare` (browsers that only share links),
 * so a Share button is never shown where it would do nothing.
 */
export function canSharePdf(fileName = 'file.pdf', env?: PdfFileEnv): boolean {
  const nav = env?.navigator ?? (typeof navigator !== 'undefined' ? (navigator as ShareNavigator) : undefined)
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare(shareData(new Uint8Array(0), fileName)) === true
  } catch {
    return false
  }
}

export type SharePdfOutcome = 'shared' | 'cancelled' | 'downloaded'

/**
 * Opens the system share sheet for the PDF (`navigator.share` is called before any await, inside the click).
 * The person closing the sheet is `cancelled`; a browser that cannot share, or refuses, downloads it instead.
 */
export async function sharePdf(bytes: Uint8Array, fileName: string, env?: PdfFileEnv): Promise<SharePdfOutcome> {
  const nav = env?.navigator ?? (typeof navigator !== 'undefined' ? (navigator as ShareNavigator) : undefined)
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    const data = shareData(bytes, fileName)
    let allowed = false
    try {
      allowed = nav.canShare(data) === true
    } catch {
      allowed = false
    }
    if (allowed) {
      try {
        await nav.share(data)
        return 'shared'
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      }
    }
  }
  downloadPdf(bytes, fileName, env)
  return 'downloaded'
}

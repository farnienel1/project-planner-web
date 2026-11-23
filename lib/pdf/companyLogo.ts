/**
 * The company logo for a PDF (`organizations/{orgId}.companyLogoURL`, rulebook §4.1 / §24 `branding/company_logo`).
 * One loader for the site audit report and the invoice-family reports (`familyLogo`). It never blocks or fails a PDF:
 * every problem gives null and the report shows its fallback (the site audit initials badge).
 *
 * - Only a URL `safeExternalUrl` accepts (an https Storage download URL; localhost for the emulator) is fetched.
 * - The fetch is aborted after `COMPANY_LOGO_TIMEOUT_MS`.
 * - The type is read from the file's first bytes (`detectUploadContentType`), never the URL or the header.
 * - PNG and JPEG are used as they are, with their pixel size read from the header (`imageDimensionsFromHeader`).
 * - WebP and HEIC are redrawn as PNG (transparency kept) when the browser can decode them, else null.
 * - A PDF logo (§24 allows one) cannot be drawn as a picture: null (fallback).
 */
import { detectUploadContentType, imageDimensionsFromHeader, safeExternalUrl } from '@/lib/canonical'

export const COMPANY_LOGO_TIMEOUT_MS = 10_000

export type CompanyLogo = { bytes: Uint8Array; format: 'png' | 'jpg'; width: number; height: number }

export type CompanyLogoDeps = {
  fetch?: typeof fetch
  timeoutMs?: number
  /** Redraws a WebP / HEIC logo as PNG bytes with its size; null when the browser cannot decode it. */
  redraw?: (bytes: Uint8Array, contentType: string) => Promise<CompanyLogo | null>
}

async function redrawInBrowser(bytes: Uint8Array, contentType: string): Promise<CompanyLogo | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: contentType }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) return null
    return { bytes: new Uint8Array(await png.arrayBuffer()), format: 'png', width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

export async function loadCompanyLogo(url: string | null | undefined, deps: CompanyLogoDeps = {}): Promise<CompanyLogo | null> {
  const safe = safeExternalUrl(url)
  if (!safe) return null
  const doFetch = deps.fetch ?? (typeof fetch === 'function' ? fetch : null)
  if (!doFetch) return null
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), deps.timeoutMs ?? COMPANY_LOGO_TIMEOUT_MS)
  try {
    const response = await doFetch(safe, controller ? { signal: controller.signal } : undefined)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const type = detectUploadContentType(bytes.subarray(0, 1024))
    if (type === 'image/png' || type === 'image/jpeg') {
      const size = imageDimensionsFromHeader(bytes)
      if (!size) return null
      return { bytes, format: type === 'image/png' ? 'png' : 'jpg', ...size }
    }
    if (type === 'image/webp' || type === 'image/heic' || type === 'image/heif') {
      return await (deps.redraw ?? redrawInBrowser)(bytes, type)
    }
    // A PDF logo, or anything else: no picture, the report shows its fallback.
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

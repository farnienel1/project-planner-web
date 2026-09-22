/** Stored signatures are raw PNG base64 (iOS `signatureImageBase64`). */

export function stripPngDataUrl(value: string): string {
  return value.replace(/^data:image\/png;base64,/i, '')
}

export function signaturePngSrc(base64: string | null | undefined): string | null {
  const raw = (base64 || '').trim()
  if (!raw) return null
  if (/^data:image\//i.test(raw)) return raw
  return `data:image/png;base64,${raw}`
}

export function hasSignatureInk(base64: string | null | undefined): boolean {
  return Boolean((base64 || '').trim())
}

const EXPORT_WIDTH = 520
const EXPORT_HEIGHT = 130

/** Shrink a canvas signature so H&S docs stay under Firestore’s 1MB limit (iOS still stores PNG base64). */
export function compactCanvasPng(source: HTMLCanvasElement): string {
  const tmp = document.createElement('canvas')
  tmp.width = EXPORT_WIDTH
  tmp.height = EXPORT_HEIGHT
  const ctx = tmp.getContext('2d')
  if (!ctx) return stripPngDataUrl(source.toDataURL('image/png'))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
  ctx.drawImage(source, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
  return stripPngDataUrl(tmp.toDataURL('image/png'))
}

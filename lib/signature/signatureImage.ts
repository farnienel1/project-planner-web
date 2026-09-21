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

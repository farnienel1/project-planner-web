/**
 * Downscale large photos so new-task save does not hang on Storage. Always redraws first so GPS is dropped;
 * `stripPhotoLocation` refuses a photo over 40 MB or 50 megapixels before it is decoded (UploadRefusedError).
 */

import { stripPhotoLocation } from '@/lib/security/stripPhotoLocation'

const MAX_EDGE = 1600
const MAX_BYTES = 900_000

export async function compressTaskAttachment(file: File): Promise<Blob> {
  const stripped = await stripPhotoLocation(file)
  if (!stripped.type.startsWith('image/') || stripped.size <= MAX_BYTES) return stripped
  if (typeof createImageBitmap !== 'function') return stripped

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(stripped)
  } catch {
    // A photo this browser cannot decode (HEIC in Chrome) goes up as it is; the upload check still applies.
    return stripped
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return stripped
  }
  // JPEG has no transparency: fill white first (1.50.0 review L5).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.82)
  })
  return blob && blob.size < stripped.size ? blob : stripped
}

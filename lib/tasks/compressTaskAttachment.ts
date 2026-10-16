/** Downscale large photos so new-task save does not hang on Storage. Always redraws first so GPS is dropped. */

import { stripPhotoLocation } from '@/lib/security/stripPhotoLocation'

const MAX_EDGE = 1600
const MAX_BYTES = 900_000

export async function compressTaskAttachment(file: File): Promise<Blob> {
  const stripped = await stripPhotoLocation(file)
  if (!stripped.type.startsWith('image/') || stripped.size <= MAX_BYTES) return stripped
  if (typeof createImageBitmap !== 'function') return stripped

  const bitmap = await createImageBitmap(stripped)
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
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), 'image/jpeg', 0.82)
  })
  return blob && blob.size < stripped.size ? blob : stripped
}

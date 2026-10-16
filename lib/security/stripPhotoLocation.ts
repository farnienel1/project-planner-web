import { shouldStripPhotoLocation, uploadLimitError, type UploadFamily } from '@/lib/security/uploadLimits'

/** Redraw an image so EXIF/GPS is not uploaded. SVG and GIF are left as-is. */
export async function stripPhotoLocation(file: File): Promise<File> {
  if (!shouldStripPhotoLocation(file)) return file
  if (typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, bitmap.width)
    canvas.height = Math.max(1, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const type = (file.type || '').toLowerCase()
    const outType = type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === 'image/jpeg' ? 0.88 : undefined)
    )
    if (!blob) return file
    const ext = outType === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `photo.${ext}`, { type: outType, lastModified: file.lastModified })
  } catch {
    return file
  }
}

export async function prepareClientUpload(
  file: File,
  family: UploadFamily
): Promise<{ file: File; error: string | null }> {
  const before = uploadLimitError(file, family)
  if (before) return { file, error: before }
  const next = await stripPhotoLocation(file)
  return { file: next, error: uploadLimitError(next, family) }
}

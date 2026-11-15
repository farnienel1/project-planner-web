import { shouldStripPhotoLocation, uploadLimitError, uploadPickError, type UploadFamily } from '@/lib/security/uploadLimits'
import { uploadFileExtension } from '@/lib/canonical/uploadPolicy'
import { UploadRefusedError, assertBitmapPreparable, assertPhotoPreparable } from '@/lib/security/uploadGuard'

/**
 * Rulebook 1.50.0 §24: photos are redrawn before upload, which drops EXIF / GPS, and scaled down so a photo is at
 * most `PHOTO_MAX_EDGE` pixels on its long edge and, where the browser can encode it, at most about
 * `PHOTO_TARGET_BYTES`. A PNG stays a PNG (logos keep their transparency) unless it is still larger than the
 * target, when it becomes a JPEG. A photo the browser cannot decode (HEIC in Chrome) is uploaded as it is — HEIC is
 * an allowed type and the Storage cap still applies.
 */
export const PHOTO_MAX_EDGE = 2560
export const PHOTO_TARGET_BYTES = 2.5 * 1024 * 1024

/** The scale for a photo: 1 when it already fits `maxEdge`. */
export function photoScale(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): number {
  const longest = Math.max(1, width, height)
  return Math.min(1, maxEdge / longest)
}

/** The name to file an uploaded photo under: the redrawn file's own name, else the picked name with the redrawn type's extension. */
export function uploadedPhotoName(picked: File, uploaded: Blob): string {
  if (typeof (uploaded as File).name === 'string' && (uploaded as File).name) return (uploaded as File).name
  const type = (uploaded.type || '').toLowerCase()
  const base = picked.name.replace(/\.[^.]+$/, '') || 'photo'
  if (type === 'image/jpeg') return `${base}.jpg`
  if (type === 'image/png') return `${base}.png`
  const ext = uploadFileExtension(picked.name)
  return ext ? `${base}.${ext}` : base
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Draw a bitmap at a scale. With `opaque` (anything that will be encoded as JPEG) the canvas is filled white first,
 * so transparent parts of a PNG or WebP turn white, not black (1.50.0 review L5).
 */
export function drawPhoto(bitmap: ImageBitmap, scale: number, opaque: boolean): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return null
  if (opaque) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * How a redrawn photo is encoded.
 * - `auto`: a PNG stays a PNG unless it is still over the target, then JPEG; everything else JPEG.
 * - `jpeg`: always JPEG; a photo the browser cannot redraw is refused unless it already is a JPEG (certificates while
 *   the pre-1.50.0 Storage rules, which take PDF and JPEG only, are live — review M1).
 * - `logo`: never turned into a JPEG — a JPEG stays a JPEG, anything else becomes a PNG (transparency kept, L5).
 */
export type PhotoOutput = 'auto' | 'jpeg' | 'logo'

export const PHOTO_NOT_CONVERTIBLE_MESSAGE =
  'This photo could not be converted to a JPEG in this browser. Save it as a JPEG or PDF and try again.'

function isJpeg(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  return type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg' || ['jpg', 'jpeg', 'jpe', 'jfif'].includes(uploadFileExtension(file.name))
}

/**
 * Redraw an image so EXIF/GPS is not uploaded, scaled down when large. Throws `UploadRefusedError` for a photo over
 * 40 MB or 50 megapixels (checked before it is decoded), and in `jpeg` mode for a photo that cannot be converted.
 */
export async function stripPhotoLocation(file: File, output: PhotoOutput = 'auto'): Promise<File> {
  if (!shouldStripPhotoLocation(file)) return file
  await assertPhotoPreparable(file)
  const cannotRedraw = (): File => {
    if (output === 'jpeg' && !isJpeg(file)) throw new UploadRefusedError(PHOTO_NOT_CONVERTIBLE_MESSAGE, 'content_unknown')
    return file
  }
  if (typeof createImageBitmap !== 'function') return cannotRedraw()
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return cannotRedraw()
  }
  try {
    assertBitmapPreparable(bitmap.width, bitmap.height)
    const inputType = (file.type || '').toLowerCase()
    const inputPng = inputType === 'image/png'
    let outType: 'image/png' | 'image/jpeg' =
      output === 'jpeg' ? 'image/jpeg' : output === 'logo' ? (isJpeg(file) ? 'image/jpeg' : 'image/png') : inputPng ? 'image/png' : 'image/jpeg'
    let blob: Blob | null = null
    if (outType === 'image/png') {
      const canvas = drawPhoto(bitmap, photoScale(bitmap.width, bitmap.height), false)
      blob = canvas ? await canvasBlob(canvas, 'image/png') : null
      if (output === 'auto' && blob && blob.size > PHOTO_TARGET_BYTES) {
        outType = 'image/jpeg'
        blob = null
      }
    }
    if (outType === 'image/jpeg') {
      const canvas = drawPhoto(bitmap, photoScale(bitmap.width, bitmap.height), true)
      blob = canvas ? await canvasBlob(canvas, 'image/jpeg', 0.85) : null
      // Still above the target: one smaller, lighter pass.
      if (blob && blob.size > PHOTO_TARGET_BYTES) {
        const smaller = drawPhoto(bitmap, photoScale(bitmap.width, bitmap.height, 2048), true)
        const second = smaller ? await canvasBlob(smaller, 'image/jpeg', 0.75) : null
        if (second && second.size < blob.size) blob = second
      }
    }
    if (!blob) return cannotRedraw()
    const ext = outType === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `photo.${ext}`, { type: outType, lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}

const FAMILY_OUTPUT: Partial<Record<UploadFamily, PhotoOutput>> = { certificate: 'jpeg', logo: 'logo' }

export async function prepareClientUpload(
  file: File,
  family: UploadFamily
): Promise<{ file: File; error: string | null }> {
  const before = uploadPickError(file, family)
  if (before) return { file, error: before }
  try {
    const next = await stripPhotoLocation(file, FAMILY_OUTPUT[family] ?? 'auto')
    return { file: next, error: uploadLimitError(next, family) }
  } catch (error) {
    if (error instanceof UploadRefusedError) return { file, error: error.message }
    throw error
  }
}

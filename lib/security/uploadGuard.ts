/**
 * The one check every web upload passes (rulebook 1.50.0 §24): `uploadAllowed` for the Storage path's kind, with the
 * file's first bytes, before anything is sent. Returns the content type to write (the type read from the bytes),
 * never `application/octet-stream`. Called by `uploadFile` and `uploadVariationEvidenceFile`.
 */
import {
  UPLOAD_DIMENSION_HEAD_BYTES,
  UPLOAD_HEAD_BYTES,
  imageDimensionsFromHeader,
  photoPrepareRefusal,
  uploadAllowed,
  uploadKindForStoragePath,
} from '@/lib/canonical/uploadPolicy'

export class UploadRefusedError extends Error {
  readonly reason: string
  constructor(message: string, reason: string) {
    super(message)
    this.name = 'UploadRefusedError'
    this.reason = reason
  }
}

async function headBytes(file: Blob): Promise<Uint8Array> {
  const slice = file.slice(0, UPLOAD_HEAD_BYTES)
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer())
  return new Uint8Array(await new Response(slice).arrayBuffer())
}

function lastSegment(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
}

/**
 * Throws `UploadRefusedError` (the rulebook's message) when the file may not go to this path; otherwise the content
 * type to upload with. The file's own name is checked when it has one (a `File`), else the object name.
 */
export async function assertUploadAllowed(storagePath: string, file: Blob, claimedContentType?: string | null): Promise<string> {
  const kind = uploadKindForStoragePath(storagePath)
  if (!kind) throw new UploadRefusedError('This file cannot be uploaded here.', 'unknown_kind')
  const ownName = typeof (file as File).name === 'string' ? (file as File).name : ''
  const decision = uploadAllowed({
    kind,
    fileName: ownName || lastSegment(storagePath),
    contentType: file.type || claimedContentType || '',
    sizeBytes: file.size,
    headBytes: await headBytes(file),
  })
  if (!decision.allowed) throw new UploadRefusedError(decision.message, decision.reason)
  if (!decision.contentType) throw new UploadRefusedError('This file could not be recognised.', 'content_unknown')
  return decision.contentType
}

/**
 * Rulebook 1.50.0 (review L4): refuse a photo before it is decoded when it is over 40 MB or its header says it is
 * over 50 megapixels (`photoPrepareRefusal`, `imageDimensionsFromHeader`). Throws `UploadRefusedError`.
 */
export async function assertPhotoPreparable(file: Blob): Promise<void> {
  const early = photoPrepareRefusal({ sizeBytes: file.size })
  if (early) throw new UploadRefusedError(early.message, early.reason)
  const head = file.slice(0, UPLOAD_DIMENSION_HEAD_BYTES)
  const bytes =
    typeof head.arrayBuffer === 'function' ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array(await new Response(head).arrayBuffer())
  const size = imageDimensionsFromHeader(bytes)
  const refusal = photoPrepareRefusal({ sizeBytes: file.size, width: size?.width, height: size?.height })
  if (refusal) throw new UploadRefusedError(refusal.message, refusal.reason)
}

/** The same check on a decoded bitmap, for a format whose header did not say its size; call before drawing it. */
export function assertBitmapPreparable(width: number, height: number): void {
  const refusal = photoPrepareRefusal({ sizeBytes: 0, width, height })
  if (refusal) throw new UploadRefusedError(refusal.message, refusal.reason)
}

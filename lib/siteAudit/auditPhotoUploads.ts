/**
 * Site audit photo uploads (owner bug 17 Nov: "Uploading photo 1 of 6" forever, then the audit was gone).
 *
 * A pure runner with an injected `upload`, so it is tested without Firebase:
 * - a few photos at a time (`concurrency`), each retried with a back-off when it stalls or the connection drops;
 *   after a stall the rest go one at a time, so a slow connection is not shared three ways (review of #389);
 * - a refusal (rules, file type, signed out) is final at once and shows its real reason, never a fake stall;
 * - offline: the photo fails at once with "No connection" instead of waiting;
 * - a photo already uploaded (`done`, with its URL) is never sent again, so Retry only sends what failed.
 * Nothing here is a business rule; the audit is still written with the rulebook's `siteAuditWriteFields`.
 */

export type PhotoUploadStatus = 'pending' | 'uploading' | 'done' | 'failed'

export type PhotoUpload = {
  itemId: string
  status: PhotoUploadStatus
  /** 0–1 while uploading. */
  progress: number
  attempts: number
  imageURL?: string
  storagePath?: string
  error?: string
  /** True when retrying cannot help (a refusal); Retry still tries again in case the cause was fixed. */
  final?: boolean
}

export const SITE_AUDIT_UPLOAD_CONCURRENCY = 3
export const SITE_AUDIT_UPLOAD_MAX_ATTEMPTS = 3
export const SITE_AUDIT_NO_CONNECTION_MESSAGE = 'No connection. The photo will upload when you retry online.'

const FINAL_CODES = new Set([
  'storage/unauthorized',
  'storage/unauthenticated',
  'storage/quota-exceeded',
  'storage/invalid-argument',
  'storage/invalid-checksum',
  'storage/canceled',
  'permission-denied',
  'unauthenticated',
])

/** Whether retrying the same upload can help, and the message to show (the real reason). */
export function classifyUploadError(error: unknown): { final: boolean; message: string } {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  const name = error instanceof Error ? error.name : ''
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (name === 'UploadRefusedError') return { final: true, message: raw || 'This photo cannot be uploaded.' }
  if (code === 'storage/unauthorized' || code === 'permission-denied' || /does not have permission/i.test(raw)) {
    return { final: true, message: 'The upload was refused (no permission to add photos to this audit). Ask an admin to check your access.' }
  }
  if (code === 'storage/unauthenticated' || code === 'unauthenticated') {
    return { final: true, message: 'You are signed out. Sign in again, then retry.' }
  }
  if (code === 'storage/quota-exceeded') return { final: true, message: 'File storage is full. Ask an admin.' }
  if (FINAL_CODES.has(code)) return { final: true, message: raw || 'The upload was refused.' }
  return { final: false, message: raw || 'The photo did not upload. Check the connection and retry.' }
}

export type UploadSummary = { total: number; done: number; failed: number; uploading: number; pending: number; label: string }

export function uploadSummary(photos: ReadonlyArray<PhotoUpload>): UploadSummary {
  const count = (status: PhotoUploadStatus) => photos.filter((photo) => photo.status === status).length
  const total = photos.length
  const done = count('done')
  const failed = count('failed')
  const uploading = count('uploading')
  const pending = count('pending')
  let label: string
  if (total === 0) label = 'No photos'
  else if (done === total) label = 'All photos uploaded'
  else if (uploading + pending > 0) label = `Uploading photos · ${done} of ${total} done`
  else label = `${failed} ${failed === 1 ? 'photo' : 'photos'} failed — Retry`
  return { total, done, failed, uploading, pending, label }
}

export type RunPhotoUploadsOptions = {
  photos: ReadonlyArray<PhotoUpload>
  upload: (itemId: string, context: { attempt: number; onProgress: (fraction: number) => void }) => Promise<{ imageURL: string; storagePath: string }>
  onChange?: (photos: PhotoUpload[]) => void
  concurrency?: number
  maxAttempts?: number
  backoffMs?: (attempt: number) => number
  sleep?: (ms: number) => Promise<void>
  online?: () => boolean
}

/**
 * Uploads every photo not yet `done`. Resolves (never rejects) with the final states; the caller saves the audit only
 * when every photo is `done`.
 */
export async function runPhotoUploads(options: RunPhotoUploadsOptions): Promise<PhotoUpload[]> {
  const concurrency = Math.max(1, options.concurrency ?? SITE_AUDIT_UPLOAD_CONCURRENCY)
  const maxAttempts = Math.max(1, options.maxAttempts ?? SITE_AUDIT_UPLOAD_MAX_ATTEMPTS)
  const backoff = options.backoffMs ?? ((attempt: number) => (attempt <= 1 ? 2_000 : 6_000))
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const online = options.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const photos: PhotoUpload[] = options.photos.map((photo) =>
    photo.status === 'done' && photo.imageURL ? { ...photo } : { ...photo, status: 'pending', progress: 0, error: undefined, final: undefined, attempts: 0 }
  )
  const emit = () => options.onChange?.(photos.map((photo) => ({ ...photo })))
  let stalled = false
  const queue = photos.map((_, index) => index).filter((index) => photos[index].status !== 'done')
  emit()

  const work = async (index: number) => {
    const set = (partial: Partial<PhotoUpload>) => {
      photos[index] = { ...photos[index], ...partial }
      emit()
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!online()) {
        set({ status: 'failed', error: SITE_AUDIT_NO_CONNECTION_MESSAGE, final: false, attempts: attempt, progress: 0 })
        return
      }
      set({ status: 'uploading', progress: 0, attempts: attempt, error: undefined })
      try {
        const result = await options.upload(photos[index].itemId, {
          attempt,
          onProgress: (fraction) => set({ progress: Math.max(0, Math.min(1, fraction)) }),
        })
        set({ status: 'done', progress: 1, imageURL: result.imageURL, storagePath: result.storagePath, error: undefined, final: undefined })
        return
      } catch (error) {
        if (typeof error === 'object' && error && (error as { code?: unknown }).code === 'upload/stalled') stalled = true
        const { final, message } = classifyUploadError(error)
        if (final || attempt === maxAttempts) {
          set({ status: 'failed', error: message, final, progress: 0 })
          return
        }
        set({ status: 'uploading', progress: 0, error: message })
        await sleep(backoff(attempt))
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async (_, worker) => {
    for (;;) {
      // After a stall only the first worker takes new photos: one at a time on a slow connection.
      if (stalled && worker > 0) return
      const next = queue.shift()
      if (next === undefined) return
      await work(next)
    }
  })
  await Promise.all(workers)
  return photos.map((photo) => ({ ...photo }))
}

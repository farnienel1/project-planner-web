import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '@/lib/firebase/config'
import { withTimeout } from '@/lib/client/withTimeout'
import { assertUploadAllowed } from '@/lib/security/uploadGuard'

/**
 * A resumable upload that never hangs silently (owner bug 17 Nov: site audit stuck on "Uploading photo 1 of 6").
 * The Firebase Storage SDK retries a dropped connection or a 5xx for up to 10 minutes without reporting anything;
 * this cancels the task after `stallMs` without progress and rejects with a `stalled` error, so the caller can retry
 * or show the photo as failed. There is no total time limit by default (review of #389: a slow but moving upload is
 * never cut off); `maxMs` sets one only when a caller asks for it. A refusal (rules, signed out) rejects at once with its Storage code.
 * Rulebook 1.50.0 §24: every upload is checked first (`assertUploadAllowed`) and written with the detected type.
 */
export type WatchedUploadResult = { storagePath: string; downloadURL: string; contentType: string; sizeBytes: number }

export class UploadStalledError extends Error {
  readonly code = 'upload/stalled'
  constructor(message: string) {
    super(message)
    this.name = 'UploadStalledError'
  }
}

export const WATCHED_UPLOAD_STALL_MS = 45_000

export async function watchedUpload(
  storagePath: string,
  file: Blob,
  claimedContentType: string | null | undefined,
  options: { onProgress?: (fraction: number) => void; stallMs?: number; maxMs?: number; signal?: AbortSignal } = {}
): Promise<WatchedUploadResult> {
  if (!storage) throw new Error('File storage is not configured.')
  const contentType = await assertUploadAllowed(storagePath, file, claimedContentType)
  const user = auth?.currentUser
  if (!user) throw Object.assign(new Error('You must be signed in to upload photos.'), { code: 'storage/unauthenticated' })
  await withTimeout(user.getIdToken(), 15_000, 'Sign-in did not finish. Try the upload again.')
  const stallMs = options.stallMs ?? WATCHED_UPLOAD_STALL_MS
  const maxMs = options.maxMs
  const storageRef = ref(storage, storagePath)
  return new Promise<WatchedUploadResult>((resolve, reject) => {
    let settled = false
    const task = uploadBytesResumable(storageRef, file, { contentType })
    let stall: ReturnType<typeof setTimeout> | null = null
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      if (stall) clearTimeout(stall)
      if (overall) clearTimeout(overall)
      outcome()
    }
    const cancel = (message: string) => {
      finish(() => reject(new UploadStalledError(message)))
      try {
        task.cancel()
      } catch {
        /* already finished */
      }
    }
    const armStall = () => {
      if (stall) clearTimeout(stall)
      stall = setTimeout(() => cancel('The photo upload stopped (no progress). Check the connection and retry.'), stallMs)
    }
    const overall = maxMs ? setTimeout(() => cancel('The photo upload took too long. Check the connection and retry.'), maxMs) : null
    // The caller gave up (the person signed out and the audit is being removed): stop at once, never retried.
    const abort = () => {
      finish(() => reject(Object.assign(new Error('The upload was stopped.'), { code: 'upload/aborted' })))
      try {
        task.cancel()
      } catch {
        /* already finished */
      }
    }
    if (options.signal?.aborted) {
      abort()
      return
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    armStall()
    task.on(
      'state_changed',
      (snapshot) => {
        armStall()
        if (snapshot.totalBytes > 0) options.onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes)
      },
      (error) => finish(() => reject(error)),
      () => {
        withTimeout(getDownloadURL(storageRef), 15_000, 'The photo uploaded but its link could not be read. Retry.')
          .then((downloadURL) => finish(() => resolve({ storagePath, downloadURL, contentType, sizeBytes: file.size })))
          .catch((error) => finish(() => reject(error)))
      }
    )
  })
}

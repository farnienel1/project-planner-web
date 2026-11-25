import { ref, uploadBytesResumable, getDownloadURL, getMetadata, deleteObject } from 'firebase/storage'
import { qualificationCertificateStoragePath } from '@/lib/canonical/operativeQualifications'
import { timesheetExportStoragePath } from '@/lib/canonical/timesheetPeriod'
import { storage, auth } from '@/lib/firebase/config'
import { TimeoutError, isTimeoutError, withTimeout } from '@/lib/client/withTimeout'
import { generatedStorageFileName } from '@/lib/security/uploadLimits'
import { assertUploadAllowed } from '@/lib/security/uploadGuard'
import { variationUploadStallReason } from '@/lib/variations/variationUploadStall'

/**
 * An upload that sends nothing for this long is cancelled (owner issue 16, 23 Nov: a certificate renewal sat on
 * "Saving…"). The Firebase SDK silently retries a request that gets no reply for up to 10 minutes. 25 Nov (owner:
 * uploads solid everywhere before launch): this stall check is the only limit — an upload that is still sending is
 * never cancelled for taking long, so a large file on a slow site connection finishes.
 */
export const UPLOAD_STALL_MS = 60_000

export const UPLOAD_STALLED_MESSAGE =
  'The file stopped uploading for a minute, so it was cancelled and nothing was saved. Check your connection and try again.'
export const UPLOAD_TOO_SLOW_MESSAGE = 'The file upload did not finish. Check your connection and try again.'

export function requireStorageUid(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) {
    throw new Error('You must be signed in to upload files.')
  }
  return uid
}

async function ensureStorageAuth(): Promise<void> {
  const user = auth?.currentUser
  if (!user) {
    throw new Error('You must be signed in to upload files.')
  }
  await withTimeout(user.getIdToken(), 15_000, 'Sign-in did not finish. Try the upload again.')
}

/**
 * Resumable upload with a fresh auth token. A short race timeout used to abandon
 * a 200KB PDF while Storage was still accepting it, so the talk or certificate
 * never got its new URL.
 */
function isStoragePermissionError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
  const message = error instanceof Error ? error.message : String(error || '')
  return (
    code === 'storage/unauthorized' ||
    code === 'storage/unauthenticated' ||
    /does not have permission to access/i.test(message) ||
    /insufficient permissions/i.test(message)
  )
}

/**
 * Rulebook 1.50.0 §24: every upload is checked first (`assertUploadAllowed` → `uploadAllowed`: the kind's types and
 * cap, and the first bytes against the claimed type and the name) and written with the type read from the bytes —
 * never `application/octet-stream`. A refused file throws the rulebook's message.
 */
export async function uploadFile(
  storagePath: string,
  file: Blob,
  claimedContentType?: string | null,
  options: { onProgress?: (fraction: number) => void } = {}
): Promise<string> {
  if (!storage) {
    throw new Error('File storage is not configured.')
  }
  const contentType = await assertUploadAllowed(storagePath, file, claimedContentType)
  const once = () =>
    startTrackedUpload(storagePath, file, contentType, {
      stallMs: UPLOAD_STALL_MS,
      sdkRetryMs: UPLOAD_STALL_MS,
      onProgress: options.onProgress ? (sent, total) => options.onProgress?.(total > 0 ? sent / total : 0) : undefined,
    }).done
  try {
    return await once()
  } catch (first) {
    if (isStoragePermissionError(first) || isTimeoutError(first)) throw first
    try {
      return await once()
    } catch {
      throw first
    }
  }
}

/** A task upload in progress: cancel it, read its progress. */
export type TrackedUpload = {
  /** Resolves with the download URL; rejects with the SDK error, a `TimeoutError` (stalled) or an `UploadCancelledError`. */
  done: Promise<string>
  cancel: () => void
}

export class UploadCancelledError extends Error {
  readonly cancelled = true as const
  constructor() {
    super('Upload cancelled.')
    this.name = 'UploadCancelledError'
  }
}

/**
 * Rulebook 1.89.0 §34 (tasks, issue 1): one upload with progress, cancel and a stall watchdog. It never hangs: no
 * progress for `stallMs` cancels it (a `TimeoutError`), and the SDK is told to stop retrying a failing request after
 * `sdkRetryMs` (it retries for 10 minutes by default, which looked like "Saving… for ages"). The bytes are checked
 * first (`assertUploadAllowed`, §24) and written with the detected type.
 */
export function startTrackedUpload(
  storagePath: string,
  file: Blob,
  claimedContentType: string | null | undefined,
  options: { stallMs: number; sdkRetryMs: number; onProgress?: (sent: number, total: number) => void }
): TrackedUpload {
  let task: ReturnType<typeof uploadBytesResumable> | null = null
  let cancelled = false
  let rejectNow: ((error: unknown) => void) | null = null
  const done = (async () => {
    if (!storage) throw new Error('File storage is not configured.')
    const contentType = await assertUploadAllowed(storagePath, file, claimedContentType)
    await ensureStorageAuth()
    if (cancelled) throw new UploadCancelledError()
    const storageRef = ref(storage, storagePath)
    const sharedStorage = storage
    return await new Promise<string>((resolve, reject) => {
      let settled = false
      let stall: ReturnType<typeof setTimeout> | null = null
      const finish = (outcome: () => void) => {
        if (settled) return
        settled = true
        if (stall) clearTimeout(stall)
        outcome()
      }
      rejectNow = (error) => finish(() => reject(error))
      // The upload task copies `maxUploadRetryTime` (its retry back-off limit) from the shared Storage instance when it
      // is made; set it for this one task and put it straight back, so no other upload in the session gets the short
      // retry (review of #452). Each request's own timeout keeps the default; the stall watchdog below stops a hung
      // task either way.
      const previousRetry = sharedStorage.maxUploadRetryTime
      sharedStorage.maxUploadRetryTime = options.sdkRetryMs
      try {
        task = uploadBytesResumable(storageRef, file, { contentType })
      } finally {
        sharedStorage.maxUploadRetryTime = previousRetry
      }
      const arm = () => {
        if (stall) clearTimeout(stall)
        stall = setTimeout(() => {
          try {
            task?.cancel()
          } catch {
            /* already finished */
          }
          finish(() => reject(new TimeoutError(UPLOAD_STALLED_MESSAGE)))
        }, options.stallMs)
      }
      arm()
      task.on(
        'state_changed',
        (snap) => {
          arm()
          options.onProgress?.(snap.bytesTransferred, snap.totalBytes)
        },
        (error) => finish(() => reject(cancelled ? new UploadCancelledError() : error)),
        () => {
          if (stall) clearTimeout(stall)
          stall = null
          withTimeout(getDownloadURL(storageRef), 15_000, 'The file uploaded but its link could not be created. Try again.')
            .then((url) => finish(() => resolve(url)))
            .catch((error) => finish(() => reject(error)))
        }
      )
    })
  })()
  return {
    done,
    cancel: () => {
      cancelled = true
      try {
        ;(task as { cancel: () => boolean } | null)?.cancel()
      } catch {
        /* already finished */
      }
      rejectNow?.(new UploadCancelledError())
    },
  }
}

/**
 * Best-effort delete of an object this person just uploaded (cancel, remove before save). The Storage rules allow
 * it for the uploader within 15 minutes (§24); anything older is kept for recovery. Never throws.
 */
export async function deleteJustUploadedFile(downloadUrl: string): Promise<void> {
  if (!storage || !downloadUrl) return
  try {
    await deleteObject(ref(storage, downloadUrl))
  } catch {
    /* kept: the rules refuse, or it is already gone */
  }
}

export type VariationEvidenceUpload = {
  storagePath: string
  downloadURL: string
  /** The type the bytes were checked as and the object was written with (never the picked file's guess). */
  contentType: string
  sizeBytes: number
}

export const VARIATION_UPLOAD_STALL_MS = 60_000

/**
 * Variation evidence (rulebook 1.52.0): a resumable upload that reports progress and IS cancelled when it stalls for
 * 60 seconds (25 Nov: no overall cap — a slow upload that is still sending finishes), so a timed-out file never lands
 * in Storage later, unlinked. Resolves with what
 * was really uploaded (the checked content type and the size of the prepared file). Errors keep their Storage code.
 */
export async function uploadVariationEvidenceFile(
  storagePath: string,
  file: Blob,
  claimedContentType?: string | null,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
): Promise<VariationEvidenceUpload> {
  if (!storage) {
    throw new Error('File storage is not configured.')
  }
  const contentType = await assertUploadAllowed(storagePath, file, claimedContentType)
  await ensureStorageAuth()
  const storageRef = ref(storage, storagePath)
  return new Promise<VariationEvidenceUpload>((resolve, reject) => {
    let settled = false
    const task = uploadBytesResumable(storageRef, file, { contentType })
    let stall: ReturnType<typeof setTimeout> | null = null
    const cancel = (message: string) => {
      try {
        task.cancel()
      } catch {
        /* already finished */
      }
      finish(() => reject(new Error(message)))
    }
    let sentBytes = 0
    // Bumped by every progress snapshot: a stall check only cancels when nothing arrived while it asked Storage.
    let progressMark = 0
    const armStall = () => {
      if (stall) clearTimeout(stall)
      stall = setTimeout(() => {
        if (settled) return
        // 17 Nov bug: a refusal from the Storage rules comes back at once as storage/unauthorized (error callback
        // below). A stall means File storage never answered: the SDK silently retries a request that got no reply
        // (network, a blocked request, an App Check token that never arrived) for up to 10 minutes. Before giving up,
        // ask Storage one quick question about the same path to say which it is, instead of a vague "stopped".
        // Review of #388: if the upload moves on or finishes during that question, it is not cancelled (a cancel
        // then could leave a finished file unlinked).
        const markAtStall = progressMark
        void variationUploadStallReason({ sentBytes }, () => withTimeout(getMetadata(storageRef), 10_000, 'no-answer')).then((reason) => {
          if (settled || progressMark !== markAtStall) return
          cancel(reason)
        })
      }, VARIATION_UPLOAD_STALL_MS)
    }
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      if (stall) clearTimeout(stall)
      options.signal?.removeEventListener('abort', onAbort)
      outcome()
    }
    const onAbort = () => cancel('The evidence upload was cancelled.')
    options.signal?.addEventListener('abort', onAbort)
    armStall()
    task.on(
      'state_changed',
      (snapshot) => {
        progressMark += 1
        sentBytes = snapshot.bytesTransferred
        armStall()
        if (snapshot.totalBytes > 0) options.onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes)
      },
      (error) => finish(() => reject(error)),
      () => {
        // Uploaded: a stall check still waiting must not cancel it while the link is fetched.
        progressMark += 1
        withTimeout(getDownloadURL(storageRef), 15_000, 'The evidence file uploaded but its link could not be created. Try again.')
          .then((downloadURL) => finish(() => resolve({ storagePath, downloadURL, contentType, sizeBytes: file.size })))
          .catch((error) => finish(() => reject(error)))
      }
    )
  })
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

function generatedObjectName(originalName: string, uid: string): string {
  return generatedStorageFileName(originalName, uid)
}

/** Evidence sits under healthSafety, the prefix other job files already upload to. */
export function variationEvidencePath(
  organizationId: string,
  parentId: string,
  fileName: string
): string {
  const uid = requireStorageUid()
  return `organizations/${organizationId}/healthSafety/${parentId}/variations/${generatedObjectName(fileName, uid)}`
}

export function healthSafetyFilePath(
  organizationId: string,
  projectId: string,
  category: string,
  fileName: string
): string {
  const uid = auth.currentUser?.uid || 'web'
  return `organizations/${organizationId}/healthSafety/${projectId}/${category}/${generatedObjectName(fileName, uid)}`
}

export function companyLogoPath(organizationId: string, fileName: string): string {
  const uid = auth.currentUser?.uid || 'web'
  return `organizations/${organizationId}/branding/company_logo/${generatedObjectName(fileName, uid)}`
}

/** iOS: organizations/{orgId}/userProfiles/{uid}/profile.jpg */
export function profilePhotoPath(organizationId: string, userId: string): string {
  const uid = userId || auth.currentUser?.uid || 'web'
  return `organizations/${organizationId}/userProfiles/${uid}/profile.jpg`
}

/**
 * Rulebook 1.54.1 §24 (`timesheetExportStoragePath`): `{uid}_{seconds}_{file}`, so the Storage rules let the exporter
 * (and admins) read it back; exports are invoices, never readable by every manager.
 */
export function timesheetExportPath(organizationId: string, fileName: string): string {
  const stamp = Math.floor(Date.now() / 1000)
  return timesheetExportStoragePath(organizationId, sanitizeFileName(fileName), stamp, auth?.currentUser?.uid ?? null)
}

export function taskAttachmentPath(
  organizationId: string,
  taskId: string,
  fileName: string
): string {
  const uid = auth.currentUser?.uid || 'web'
  return `organizations/${organizationId}/tasks/${taskId}/${generatedObjectName(fileName, uid)}`
}

/** iOS: organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{uid}_{ts}.{ext} */
export function qualificationCertificatePath(
  organizationId: string,
  operativeId: string,
  qualificationId: string,
  fileName: string
): string {
  const uid = requireStorageUid()
  const path = qualificationCertificateStoragePath({
    organizationId,
    operativeId,
    qualificationId,
    fileName: generatedObjectName(fileName, uid),
  })
  if (!path) {
    throw new Error('Could not save the certificate. Organisation or qualification is missing.')
  }
  return path
}

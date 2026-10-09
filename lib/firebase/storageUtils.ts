import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '@/lib/firebase/config'
import { withTimeout } from '@/lib/client/withTimeout'

const UPLOAD_TIMEOUT_MS = 180_000

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

function uploadOnce(storagePath: string, file: Blob, contentType: string): Promise<string> {
  const storageRef = ref(storage, storagePath)
  return new Promise((resolve, reject) => {
    let settled = false
    const task = uploadBytesResumable(storageRef, file, { contentType })
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      outcome()
    }
    const timer = setTimeout(() => {
      try {
        task.cancel()
      } catch {
        /* already finished */
      }
      finish(() => reject(new Error('The file upload did not finish. Check your connection and try again.')))
    }, UPLOAD_TIMEOUT_MS)
    task.on(
      'state_changed',
      () => {},
      (error) => finish(() => reject(error)),
      () => {
        getDownloadURL(storageRef)
          .then((url) => finish(() => resolve(url)))
          .catch((error) => finish(() => reject(error)))
      }
    )
  })
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

export async function uploadFile(
  storagePath: string,
  file: Blob,
  contentType = 'image/jpeg'
): Promise<string> {
  if (!storage) {
    throw new Error('File storage is not configured.')
  }
  await ensureStorageAuth()
  try {
    return await uploadOnce(storagePath, file, contentType)
  } catch (first) {
    if (isStoragePermissionError(first)) throw first
    await ensureStorageAuth()
    try {
      return await uploadOnce(storagePath, file, contentType)
    } catch {
      throw first
    }
  }
}

/**
 * Variation evidence: one request, no retry. A denied or hung resumable upload
 * used to sit on Save for minutes and then still lose the variation.
 */
export async function uploadVariationEvidenceFile(
  storagePath: string,
  file: Blob,
  contentType = 'application/octet-stream'
): Promise<string> {
  if (!storage) {
    throw new Error('File storage is not configured.')
  }
  await ensureStorageAuth()
  const storageRef = ref(storage, storagePath)
  await withTimeout(
    uploadBytes(storageRef, file, { contentType }),
    60_000,
    'The evidence file did not finish uploading. Check the connection and try again.'
  )
  return withTimeout(
    getDownloadURL(storageRef),
    15_000,
    'The evidence file uploaded but its link could not be created. Try again.'
  )
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export function siteAuditImagePath(
  organizationId: string,
  auditId: string,
  imageName: string
): string {
  const uid = auth.currentUser?.uid || 'web'
  const timestamp = Date.now()
  return `organizations/${organizationId}/siteAudits/${auditId}/images/${uid}_${timestamp}_${sanitizeFileName(imageName)}`
}

/** Evidence sits under healthSafety, the prefix other job files already upload to. */
export function variationEvidencePath(
  organizationId: string,
  parentId: string,
  fileName: string
): string {
  const uid = requireStorageUid()
  const timestamp = Date.now()
  return `organizations/${organizationId}/healthSafety/${parentId}/variations/${uid}_${timestamp}_${sanitizeFileName(fileName)}`
}

export function healthSafetyFilePath(
  organizationId: string,
  projectId: string,
  category: string,
  fileName: string
): string {
  const uid = auth.currentUser?.uid || 'web'
  const timestamp = Date.now()
  return `organizations/${organizationId}/healthSafety/${projectId}/${category}/${uid}_${timestamp}_${sanitizeFileName(fileName)}`
}

export function companyLogoPath(organizationId: string, fileName: string): string {
  const uid = auth.currentUser?.uid || 'web'
  const timestamp = Date.now()
  return `organizations/${organizationId}/branding/company_logo/${uid}_${timestamp}_${sanitizeFileName(fileName)}`
}

/** iOS: organizations/{orgId}/userProfiles/{uid}/profile.jpg */
export function profilePhotoPath(organizationId: string, userId: string): string {
  const uid = userId || auth.currentUser?.uid || 'web'
  return `organizations/${organizationId}/userProfiles/${uid}/profile.jpg`
}

export function timesheetExportPath(organizationId: string, fileName: string): string {
  const stamp = Math.floor(Date.now() / 1000)
  return `organizations/${organizationId}/timesheetExports/${stamp}_${sanitizeFileName(fileName)}`
}

export function taskAttachmentPath(
  organizationId: string,
  taskId: string,
  fileName: string
): string {
  const uid = auth.currentUser?.uid || 'web'
  const timestamp = Date.now()
  return `organizations/${organizationId}/tasks/${taskId}/${uid}_${timestamp}_${sanitizeFileName(fileName)}`
}

/** iOS: organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{uid}_{ts}_{name} */
export function qualificationCertificatePath(
  organizationId: string,
  operativeId: string,
  qualificationId: string,
  fileName: string
): string {
  const uid = requireStorageUid()
  const timestamp = Date.now()
  return `organizations/${organizationId}/operatives/${operativeId}/qualifications/${qualificationId}/certificates/${uid}_${timestamp}_${sanitizeFileName(fileName)}`
}

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
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
    const task = uploadBytesResumable(storageRef, file, { contentType })
    const timer = setTimeout(() => {
      task.cancel()
      reject(new Error('The file upload did not finish. Check your connection and try again.'))
    }, UPLOAD_TIMEOUT_MS)
    task.on(
      'state_changed',
      () => {},
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
      () => {
        clearTimeout(timer)
        getDownloadURL(storageRef).then(resolve).catch(reject)
      }
    )
  })
}

/**
 * Resumable upload with a fresh auth token. A short race timeout used to abandon
 * a 200KB PDF while Storage was still accepting it, so the talk or certificate
 * never got its new URL.
 */
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
    await ensureStorageAuth()
    try {
      return await uploadOnce(storagePath, file, contentType)
    } catch {
      throw first
    }
  }
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

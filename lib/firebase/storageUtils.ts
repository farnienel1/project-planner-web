import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '@/lib/firebase/config'

export function requireStorageUid(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) {
    throw new Error('You must be signed in to upload files.')
  }
  return uid
}

export async function uploadFile(
  storagePath: string,
  file: Blob,
  contentType = 'image/jpeg'
): Promise<string> {
  if (!storage) {
    throw new Error('File storage is not configured.')
  }
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file, { contentType })
  return getDownloadURL(storageRef)
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

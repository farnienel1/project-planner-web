import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '@/lib/firebase/config'

export async function uploadFile(
  storagePath: string,
  file: Blob,
  contentType = 'image/jpeg'
): Promise<string> {
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file, { contentType })
  try {
    return await getDownloadURL(storageRef)
  } catch {
    return `gs://${storage.app.options.storageBucket}/${storagePath}`
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

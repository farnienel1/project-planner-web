/**
 * Reads a stored file's bytes in the browser (site audit photos, the company logo, PAYE claim evidence). First the
 * download URL itself; when that fetch fails outright (the bucket has no CORS configuration, so the browser refuses
 * the answer — owner report 26 Nov, every site audit photo blank), the same object through `/api/storage/file` as the
 * signed-in person. A refusal (403 / 404) from the first fetch is final: it is the Storage rules or a missing file.
 */
import { auth } from '@/lib/firebase/config'
import { awaitAppCheckToken, initializedAppCheck } from '@/lib/firebase/appCheck'
import { storageObjectPathFromDownloadUrl } from '@/lib/firebase/storageFilePath'

export async function fetchStoredFile(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (init?.signal?.aborted) throw error
    const path = storageObjectPathFromDownloadUrl(url, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    const user = auth?.currentUser
    if (!path || !user) throw error
    const headers: Record<string, string> = { Authorization: `Bearer ${await user.getIdToken()}` }
    const appCheck = await awaitAppCheckToken(initializedAppCheck(), { timeoutMs: 3_000 }).catch(() => '')
    if (appCheck) headers['X-Firebase-AppCheck'] = appCheck
    return fetch(`/api/storage/file?path=${encodeURIComponent(path)}`, { ...init, headers, cache: 'no-store' })
  }
}

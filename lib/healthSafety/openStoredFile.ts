'use client'

import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/lib/firebase/config'
import { withTimeout } from '@/lib/client/withTimeout'
import { storedFileTarget } from '@/lib/healthSafety/storedFile'

const RESOLVE_TIMEOUT_MS = 15_000

/** A URL the browser can load for a stored file reference (`storedFileTarget`), asking Storage when needed. */
export async function resolveStoredFileUrl(fileRef: string | null | undefined): Promise<string> {
  const target = storedFileTarget(fileRef)
  if (!target) throw new Error('This file has no link.')
  if (target.kind === 'url') return target.url
  if (!storage) throw new Error('File storage is not configured.')
  return withTimeout(getDownloadURL(ref(storage, target.path)), RESOLVE_TIMEOUT_MS, 'The file link could not be created.')
}

/**
 * Open a stored file in a new tab. A Storage path is resolved after the click, so the tab is opened first (inside
 * the click, which pop-up blockers allow) and pointed at the file once its URL arrives; it is closed on failure.
 */
export async function openStoredFile(fileRef: string | null | undefined): Promise<void> {
  const target = storedFileTarget(fileRef)
  if (!target) throw new Error('This file has no link.')
  if (target.kind === 'url') {
    window.open(target.url, '_blank', 'noopener,noreferrer')
    return
  }
  const tab = window.open('', '_blank')
  try {
    const url = await resolveStoredFileUrl(fileRef)
    if (tab) {
      tab.opener = null
      tab.location.href = url
    } else {
      window.location.assign(url)
    }
  } catch (error) {
    tab?.close()
    throw error
  }
}

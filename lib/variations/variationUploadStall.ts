/**
 * Why a variation evidence upload stalled (owner report 17 Nov: "0 of 1" for a minute, then "The evidence upload
 * stopped for a minute and was cancelled").
 *
 * A refusal by the Storage rules is not a stall: it comes back within a second as `storage/unauthorized` and is shown
 * at once. A stall means File storage never answered — the Firebase SDK silently retries a request that got no reply
 * (no network, a blocked request, a firewall or ad blocker on firebasestorage.googleapis.com) for up to 10 minutes. So
 * when the 60-second stall timer fires, the app asks Storage one quick question about the same path (a metadata read,
 * at most 10 seconds) and says which it is.
 */
export const VARIATION_UPLOAD_REFUSED_MESSAGE =
  'File storage refused this upload: your account may not add evidence to this job (storage/unauthorized). Ask an admin to check your access.'
export const VARIATION_UPLOAD_NO_ANSWER_MESSAGE =
  'File storage did not answer for a minute, so the upload was cancelled and nothing was saved. Check the internet connection, or a firewall or ad blocker that blocks firebasestorage.googleapis.com, and add the file again.'
export const VARIATION_UPLOAD_NEVER_STARTED_MESSAGE =
  'File storage is reachable, but this upload got no answer for a minute, so it was cancelled and nothing was saved. Add the file again; if it happens again, tell support (upload never started).'
export const VARIATION_UPLOAD_SLOW_MESSAGE =
  'The file stopped sending for a minute, so the upload was cancelled and nothing was saved. Check the connection and add the file again.'

function errorCode(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
}

/** `probe` reads the same path's metadata (with its own timeout); it settles one way or the other. */
export async function variationUploadStallReason(
  state: { sentBytes: number },
  probe: () => Promise<unknown>
): Promise<string> {
  try {
    await probe()
  } catch (error) {
    const code = errorCode(error)
    if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') return VARIATION_UPLOAD_REFUSED_MESSAGE
    if (code !== 'storage/object-not-found') return VARIATION_UPLOAD_NO_ANSWER_MESSAGE
  }
  // Storage answered (the object is not there yet, or it is).
  return state.sentBytes > 0 ? VARIATION_UPLOAD_SLOW_MESSAGE : VARIATION_UPLOAD_NEVER_STARTED_MESSAGE
}

/** The message shown for an upload error that came back from Storage (never a stall). */
export function variationUploadErrorText(error: unknown): string {
  const code = errorCode(error)
  const message = error instanceof Error ? error.message : String(error || 'Upload failed.')
  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') return VARIATION_UPLOAD_REFUSED_MESSAGE
  if (code === 'storage/canceled') return 'The upload was cancelled.'
  if (code === 'storage/retry-limit-exceeded') return VARIATION_UPLOAD_NO_ANSWER_MESSAGE
  return code ? `${message} (${code})` : message
}

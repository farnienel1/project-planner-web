import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { withTimeout } from '@/lib/client/withTimeout'
import { saveFounderConfirmEmailPayload, type FounderConfirmEmailPayload } from '@/lib/orgSetup/founderConfirmEmail'

const CONFIRM_EMAIL_TIMEOUT_MS = 20000

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name?: string }).name ?? '') : ''
  return name === 'AbortError' || name === 'TimeoutError'
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = getFirebaseAuth().currentUser
  if (!user) {
    throw new Error('Sign in required to send the confirmation email.')
  }
  const token = await withTimeout(
    user.getIdToken(true),
    8000,
    'Could not read your sign-in token to send the confirmation email.'
  )
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function requestFounderConfirmEmail(params: {
  confirmationToken: string
  organizationName: string
  firstName: string
  to: string
}): Promise<void> {
  const payload: FounderConfirmEmailPayload = {
    confirmationToken: params.confirmationToken.trim(),
    organizationName: params.organizationName.trim(),
    firstName: params.firstName.trim() || 'there',
    to: params.to.trim().toLowerCase(),
  }
  if (!payload.confirmationToken || !payload.to) {
    throw new Error('Missing confirmation details — the organisation was created but we cannot send the email yet.')
  }
  saveFounderConfirmEmailPayload(payload)

  let response: Response
  try {
    response = await fetch('/api/org-setup/send-confirm-email', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONFIRM_EMAIL_TIMEOUT_MS),
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        'The organisation was created but the confirmation email is taking too long. Stay on Check your email and tap Resend.'
      )
    }
    throw error
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not send confirmation email')
  }
}

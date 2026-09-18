import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'

const CONFIRM_EMAIL_TIMEOUT_MS = 12000

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name?: string }).name ?? '') : ''
  return name === 'AbortError' || name === 'TimeoutError'
}

export async function requestFounderConfirmEmail(params: {
  confirmationToken: string
  organizationName: string
  firstName: string
  to: string
}): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/org-setup/send-confirm-email', {
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(CONFIRM_EMAIL_TIMEOUT_MS),
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        'The organisation was created but the confirmation email is taking too long. Check your inbox, or refresh and try Activate again.'
      )
    }
    throw error
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not send confirmation email')
  }
}

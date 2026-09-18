import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'

export async function requestFounderConfirmEmail(params: {
  confirmationToken: string
  organizationName: string
  firstName: string
  to: string
}): Promise<void> {
  const response = await fetch('/api/org-setup/send-confirm-email', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not send confirmation email')
  }
}

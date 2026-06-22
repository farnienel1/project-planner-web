/** Client helper — asks the server to send a Resend invite email. */
export async function requestInviteSetupEmail(params: {
  invitationId: string
  organizationName: string
  firstName: string
  role: 'manager' | 'operative'
  to: string
}): Promise<void> {
  const response = await fetch('/api/invites/send-setup-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not send invite email')
  }
}

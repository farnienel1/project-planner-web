import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'

export async function auditOwnerAction(action: string, payload: Record<string, unknown> = {}) {
  try {
    await fetch('/api/owner/audit', {
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    /* audit is best-effort */
  }
}

export async function ownerChangeUserEmail(input: {
  uid: string
  newEmail: string
  reason: string
  sendReset: boolean
}) {
  const response = await fetch('/api/owner/change-email', {
    method: 'POST',
    credentials: 'include',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not change that login email.')
}

export async function ownerSendPasswordReset(uid: string, email?: string) {
  const response = await fetch('/api/owner/send-password-reset', {
    method: 'POST',
    credentials: 'include',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ uid, email }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not send a password reset email.')
}

export async function ownerDeleteOrganisation(orgId: string) {
  const response = await fetch('/api/owner/delete-organisation', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ orgId }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not delete that organisation.')
}

export async function ownerMarkInternal(input: { orgId?: string; uid?: string; isInternal: boolean }) {
  const response = await fetch('/api/owner/mark-internal', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not update the internal flag.')
}

export async function ownerDeleteUnfinishedUser(uid: string) {
  const response = await fetch('/api/owner/delete-unfinished-user', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ uid }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'Could not delete that unfinished account.')
}

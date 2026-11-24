import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { markOwnerDirectoryStale } from '@/lib/owner/client/ownerApi'
import { OWNER_MFA_REVERIFY_CODE } from '@/lib/owner/ownerMfaCodes'

/** The action needs a code entered within the last 10 minutes (PLAN A3): the console asks for one, then retries. */
export class OwnerReverifyRequiredError extends Error {
  readonly code = OWNER_MFA_REVERIFY_CODE
  constructor(message = 'Enter a new emailed code to go on.') {
    super(message)
    this.name = 'OwnerReverifyRequiredError'
  }
}

export function isOwnerReverifyRequired(error: unknown): error is OwnerReverifyRequiredError {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === OWNER_MFA_REVERIFY_CODE)
}

/** POST an owner action; throws OwnerReverifyRequiredError on a stale code, else the route's own message. */
async function ownerPost<T>(path: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string }
  if (response.status === 403 && data.code === OWNER_MFA_REVERIFY_CODE) throw new OwnerReverifyRequiredError(data.error)
  if (!response.ok) throw new Error(data.error || fallback)
  return data
}

/** Emails the owner a new code without signing them out (POST /api/owner/reverify). */
export async function ownerRequestReverify(): Promise<{ retryAfterSec?: number }> {
  return ownerPost('/api/owner/reverify', {}, 'Could not email a code.')
}

export type NameChangeSummary = {
  users: { id: string; organisation: string }[]
  rows: { id: string; collection: 'operatives' | 'managers'; organisation: string }[]
  unchanged: boolean
}

export async function ownerChangeUserName(input: { uid: string; firstName: string; surname: string; reason?: string; preview?: boolean }) {
  const data = await ownerPost<NameChangeSummary>('/api/owner/actions/change-name', input, 'Could not change the name.')
  if (!input.preview) markOwnerDirectoryStale()
  return data
}

export type RevokeSummary = {
  accounts?: { uid: string; emailMasked: string; lastLoginAtMs: number | null; disabled: boolean }[]
  signedOut?: number
  failed?: string[]
  ok?: boolean
}

export async function ownerRevokeSessions(input: { uid: string; reason?: string; preview?: boolean }) {
  return ownerPost<RevokeSummary>('/api/owner/actions/revoke-sessions', input, 'Could not sign this person out.')
}

export async function ownerRevealEmail(uid: string): Promise<string[]> {
  const data = await ownerPost<{ emails?: string[] }>(`/api/owner/people/${encodeURIComponent(uid)}/reveal-email`, {}, 'Could not reveal the email.')
  return Array.isArray(data.emails) ? data.emails : []
}

export type ChangeEmailPreview = { organizations: number; claimWrites: number; claimDeletes: number; membershipsRead: boolean }

export async function ownerPreviewChangeEmail(input: { uid: string; newEmail: string; sendReset: boolean }) {
  return ownerPost<ChangeEmailPreview>('/api/owner/change-email', { ...input, preview: true }, 'Could not check that email change.')
}

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
  confirmEmail: string
  reason: string
  sendReset: boolean
}) {
  const data = await ownerPost<{ incomplete?: string[] }>('/api/owner/change-email', input, 'Could not change that login email.')
  markOwnerDirectoryStale()
  // The login email changed; any claim or roster row that could not be moved is reported, never hidden.
  return { incomplete: Array.isArray(data.incomplete) ? data.incomplete : [] }
}

export async function ownerSendPasswordReset(uid: string, email?: string, reason?: string) {
  await ownerPost('/api/owner/send-password-reset', { uid, email, reason }, 'Could not send a password reset email.')
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
  markOwnerDirectoryStale()
}

export async function ownerDeleteUnfinishedUser(uid: string, reason?: string) {
  await ownerPost('/api/owner/delete-unfinished-user', { uid, reason }, 'Could not delete that unfinished account.')
  markOwnerDirectoryStale()
}

/** Rulebook §20 (`canRestoreOrganization`): the platform owner restores a company scheduled for erasure. */
export async function ownerRestoreOrganisation(orgId: string): Promise<{ message: string; stripe?: string }> {
  const response = await fetch('/api/owner/restore-organisation', {
    method: 'POST',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify({ orgId }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; stripe?: string }
  if (!response.ok) throw new Error(data.error || 'Could not restore that organisation.')
  markOwnerDirectoryStale()
  return { message: data.message || 'Organisation restored.', stripe: data.stripe }
}

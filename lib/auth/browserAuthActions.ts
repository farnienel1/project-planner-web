import { getClientAuthHeaders } from '@/lib/security/clientAuthHeaders'

export class AuthFlowError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'AuthFlowError'
    this.code = code
    this.status = status
  }
}

async function postAuth(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!response.ok) {
    throw new AuthFlowError(data.error || 'Request failed', data.code || 'auth/internal-error', response.status)
  }
}

export function requestEmailSignIn(email: string, password: string): Promise<void> {
  return postAuth('/api/auth/sign-in', { email, password })
}

export function requestEmailSignUp(email: string, password: string): Promise<void> {
  return postAuth('/api/auth/sign-up', { email, password })
}

export function requestPasswordReset(email: string): Promise<void> {
  return postAuth('/api/auth/password/reset', { email })
}

export function requestPasswordConfirm(oobCode: string, newPassword: string): Promise<void> {
  return postAuth('/api/auth/password/confirm', { oobCode, newPassword })
}

export async function requestPasswordChange(currentPassword: string, nextPassword: string): Promise<void> {
  const headers = await getClientAuthHeaders()
  await postAuth('/api/auth/password/change', { currentPassword, nextPassword }, headers)
}

let syncedSessionUid = ''

export async function syncWebSessionCookie(uid: string): Promise<void> {
  if (!uid || syncedSessionUid === uid) return
  syncedSessionUid = uid
  try {
    const headers = await getClientAuthHeaders()
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { ...headers },
    })
    if (!response.ok) syncedSessionUid = ''
  } catch {
    syncedSessionUid = ''
  }
}

export async function clearWebSession(): Promise<void> {
  syncedSessionUid = ''
  try {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin', keepalive: true })
  } catch {
    /* Sign-out still clears Firebase. */
  }
}

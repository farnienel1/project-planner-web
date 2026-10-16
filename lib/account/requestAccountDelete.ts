import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { SOLE_ADMIN_CODE, type SoleAdminBlock } from '@/lib/account/accountDelete'

export type AccountDeleteResult =
  | { ok: true }
  | { ok: false; error: string; soleAdmin?: SoleAdminBlock }

export async function requestAccountDelete(input: {
  confirmation: string
  password: string
}): Promise<AccountDeleteResult> {
  const response = await fetch('/api/account/delete', {
    method: 'POST',
    credentials: 'include',
    headers: await jsonAuthHeaders(),
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    code?: string
    orgId?: string
    orgName?: string
  }
  if (response.ok) return { ok: true }
  if (data.code === SOLE_ADMIN_CODE && data.orgId) {
    return {
      ok: false,
      error: data.error || 'Transfer admin first.',
      soleAdmin: { code: SOLE_ADMIN_CODE, orgId: data.orgId, orgName: data.orgName || '' },
    }
  }
  return { ok: false, error: data.error || 'Could not delete your account.' }
}

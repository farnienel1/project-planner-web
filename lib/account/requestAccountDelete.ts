import { jsonAuthHeaders } from '@/lib/security/clientAuthHeaders'
import { COMPANY_DELETE_REQUIRED_CODE, HANDOVER_REQUIRED_CODE } from '@/lib/account/accountDelete'

export type AccountDeleteOrg = { orgId: string; orgName: string }

export type AccountDeleteResult =
  | { ok: true }
  | {
      ok: false
      error: string
      /** Rulebook 1.15.0: the super admin hands super admin to another admin first. */
      handover?: AccountDeleteOrg
      /** Rulebook 1.15.0: the organisations deleted with the account; type each company name to confirm. */
      deleteWithCompany?: AccountDeleteOrg[]
    }

export async function requestAccountDelete(input: {
  confirmation: string
  password: string
  companyNames?: Record<string, string>
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
    orgs?: AccountDeleteOrg[]
  }
  if (response.ok) return { ok: true }
  if (data.code === HANDOVER_REQUIRED_CODE && data.orgId) {
    return { ok: false, error: data.error || 'Hand over super admin first.', handover: { orgId: data.orgId, orgName: data.orgName || '' } }
  }
  if (data.code === COMPANY_DELETE_REQUIRED_CODE && Array.isArray(data.orgs)) {
    return { ok: false, error: data.error || '', deleteWithCompany: data.orgs }
  }
  return { ok: false, error: data.error || 'Could not delete your account.' }
}

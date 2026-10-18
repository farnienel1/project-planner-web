import { parseOrganizationName } from '@/lib/canonical/organizationSettings'

export function resolveInviteSetupIdentity(input: {
  invitationFirstName: string
  fallbackFirstName: string
  organization: Record<string, unknown> | undefined
  fallbackOrganizationName: string
}): { firstName: string; organizationName: string } | null {
  const firstName =
    String(input.invitationFirstName || '').trim() || String(input.fallbackFirstName || '').trim()
  const organizationName =
    parseOrganizationName(input.organization) || String(input.fallbackOrganizationName || '').trim()
  if (!firstName || !organizationName) return null
  return { firstName, organizationName }
}

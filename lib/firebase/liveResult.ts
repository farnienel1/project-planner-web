import { currentOrganizationId, organizationIdsMatch } from '@/lib/canonical'

/**
 * A live listener result still belongs to the open organisation (rulebook §1, 1.9.0). Before any organisation has
 * been adopted (boot, tests) results are not gated, like `organizationContextStillCurrent`.
 */
export function liveResultStillCurrent(organizationId: string): boolean {
  const open = currentOrganizationId()
  if (!open) return true
  return organizationIdsMatch(open, organizationId)
}

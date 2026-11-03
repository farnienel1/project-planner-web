'use client'

import { useMemo } from 'react'
import { parsePayrollPolicy } from '@/lib/canonical/organizationSettings'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

/** The open organisation's working-hours policy from its live document (`parsePayrollPolicy`), for pickers' notes. */
export function useOrganizationPayrollPolicy(): OrgPayrollTimePolicy {
  const data = useOrganizationDocumentStore((state) => state.data)
  return useMemo(
    () => parsePayrollPolicy((data as Record<string, unknown> | null)?.payrollTimePolicy as Record<string, unknown> | undefined),
    [data]
  )
}

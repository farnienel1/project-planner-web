import type { OrgInvoicingSettings } from '@/lib/settings/organizationSettings'

export const INVOICING_READ_CAP_MS = 2_500

const memory = new Map<string, OrgInvoicingSettings>()

function storageKey(organizationId: string): string {
  return `pp.invoicing:${organizationId}`
}

export function rememberInvoicingSettings(organizationId: string, settings: OrgInvoicingSettings): void {
  if (!organizationId) return
  memory.set(organizationId, settings)
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(organizationId), JSON.stringify(settings))
  } catch {
    /* The in-memory copy still covers this visit. */
  }
}

export function readRememberedInvoicing(organizationId: string): OrgInvoicingSettings | null {
  if (!organizationId) return null
  const cached = memory.get(organizationId)
  if (cached) return cached
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(organizationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrgInvoicingSettings
    if (!parsed || typeof parsed !== 'object' || !parsed.paymentRunMode) return null
    memory.set(organizationId, parsed)
    return parsed
  } catch {
    return null
  }
}

/**
 * The quick-select line. A company that already has invoicing must not flash
 * the unset sentence while the organisation read is still running.
 */
export function invoicingQuickSelectLabel(input: {
  invoicing: OrgInvoicingSettings | null | undefined
  periodLabel: string | null
  readFinished: boolean
}): { label: string; enabled: boolean } {
  if (input.invoicing && input.periodLabel) {
    return { label: input.periodLabel, enabled: true }
  }
  if (!input.readFinished) {
    return { label: 'Loading invoicing dates…', enabled: false }
  }
  return { label: 'Set invoicing dates in Organisation settings', enabled: false }
}

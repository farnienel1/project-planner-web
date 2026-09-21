import {
  copyWarningDetection,
  parseWarningDetection,
  warningDetectionToFirestore,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'

const memory = new Map<string, OrgWarningDetectionSettings>()

export function warningDetectionCacheKey(organizationId: string): string {
  return `orgWarningDetection.${organizationId}`
}

export function readCachedWarningDetection(
  organizationId: string
): OrgWarningDetectionSettings | null {
  const fromMemory = memory.get(organizationId)
  if (fromMemory) return copyWarningDetection(fromMemory)
  if (typeof window === 'undefined') return null
  try {
    const raw =
      window.localStorage.getItem(warningDetectionCacheKey(organizationId)) ||
      window.sessionStorage.getItem(warningDetectionCacheKey(organizationId))
    if (!raw) return null
    const parsed = parseWarningDetection(JSON.parse(raw) as Record<string, unknown>)
    memory.set(organizationId, parsed)
    return copyWarningDetection(parsed)
  } catch {
    return null
  }
}

export function writeCachedWarningDetection(
  organizationId: string,
  settings: OrgWarningDetectionSettings
): void {
  const copy = copyWarningDetection(settings)
  memory.set(organizationId, copy)
  if (typeof window === 'undefined') return
  try {
    const encoded = JSON.stringify(warningDetectionToFirestore(copy))
    window.localStorage.setItem(warningDetectionCacheKey(organizationId), encoded)
    window.sessionStorage.setItem(warningDetectionCacheKey(organizationId), encoded)
  } catch {
    /* ignore quota / private mode */
  }
}

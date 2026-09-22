/** Dual-write: iOS reads `settings/healthSafety_{projects|smallWorks}_{projectId}`. Web also keeps the nested job doc. */
export const HEALTH_SAFETY_DOC_ID = 'data'

export function healthSafetyDocPath(
  organizationId: string,
  projectId: string,
  isSmallWorks: boolean
): { collection: 'projects' | 'smallWorks'; segments: string[] } {
  const collection = isSmallWorks ? 'smallWorks' : 'projects'
  return {
    collection,
    segments: ['organizations', organizationId, collection, projectId, 'healthSafety', HEALTH_SAFETY_DOC_ID],
  }
}

/** Legacy web path before iOS parity fix. */
export function legacyHealthSafetySettingsDocId(projectId: string, isSmallWorks: boolean): string {
  return `healthSafety_${isSmallWorks ? 'smallWorks' : 'projects'}_${projectId}`
}

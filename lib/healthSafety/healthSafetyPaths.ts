/** iOS parity: project H&S lives under projects/{id}/healthSafety/data (not org settings). */
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

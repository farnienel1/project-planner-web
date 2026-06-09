/** Project or small-works schedule hub (mirrors iOS open-in-schedule from warnings). */
export function projectSchedulePath(projectId: string, smallWorkIds: ReadonlySet<string>): string {
  if (smallWorkIds.has(projectId)) {
    return `/dashboard/small-works/${projectId}/schedule`
  }
  return `/dashboard/projects/${projectId}/schedule`
}

export function projectMaterialsPath(projectId: string, smallWorkIds: ReadonlySet<string>): string {
  if (smallWorkIds.has(projectId)) {
    return `/dashboard/small-works/${projectId}/materials`
  }
  return `/dashboard/projects/${projectId}/materials`
}

export function projectScheduleOpenLabel(projectLabel: string, isSmallWork: boolean): string {
  return isSmallWork
    ? `Open in Small Works Schedule - ${projectLabel}`
    : `Open in Project Schedule - ${projectLabel}`
}

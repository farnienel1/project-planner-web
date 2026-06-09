import { isSameDay, startOfDay } from 'date-fns'
import type { MaterialSendRecord, Project, ProjectMaterialLine } from '@/types'

export type MissedMaterialOrderWarning = {
  id: string
  type: 'missed_material_order'
  projectId: string
  projectLabel: string
  date: Date
  unorderedCount: number
  message: string
}

/** Material line has been sent/ordered — not a missed order. */
export function isMaterialLineOrdered(
  line: ProjectMaterialLine,
  sendRecords: MaterialSendRecord[]
): boolean {
  const status = `${line.status || ''}`.toLowerCase()
  if (status.includes('sent') || status.includes('order')) {
    return true
  }
  return sendRecords.some(
    (record) =>
      record.requestType === 'order' &&
      record.lines.some((entry) => entry.materialId === line.id)
  )
}

/**
 * Missed material order warnings (iOS + web parity):
 * - Only for **today** (resolves automatically at midnight when the calendar day rolls over).
 * - Only when the project/small work has material lines on that day that are not yet ordered.
 */
export function computeMissedMaterialOrderWarnings(
  materials: ProjectMaterialLine[],
  sendRecords: MaterialSendRecord[],
  projects: Project[],
  referenceDate: Date = new Date()
): MissedMaterialOrderWarning[] {
  const today = startOfDay(referenceDate)
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const warnings: MissedMaterialOrderWarning[] = []

  const linesToday = materials.filter((line) => isSameDay(startOfDay(new Date(line.date)), today))
  const byProject = new Map<string, ProjectMaterialLine[]>()

  for (const line of linesToday) {
    const list = byProject.get(line.projectId) || []
    list.push(line)
    byProject.set(line.projectId, list)
  }

  for (const [projectId, lines] of byProject) {
    const unordered = lines.filter((line) => !isMaterialLineOrdered(line, sendRecords))
    if (unordered.length === 0) continue

    const project = projectsById.get(projectId)
    const projectLabel = project?.siteName || project?.jobNumber || projectId.slice(0, 8)
    warnings.push({
      id: `material-${projectId}-${today.toISOString()}`,
      type: 'missed_material_order',
      projectId,
      projectLabel,
      date: today,
      unorderedCount: unordered.length,
      message: `${unordered.length} material item${unordered.length !== 1 ? 's' : ''} not ordered for today on ${projectLabel}.`,
    })
  }

  return warnings.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
}

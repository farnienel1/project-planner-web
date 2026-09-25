import { isSmallWorksJobType } from '@/lib/ios-parity/enums'
import type { Project } from '@/types'

function jobKey(id: string): string {
  return id.trim().toLowerCase()
}

/**
 * Projects and small works stay in their own lists.
 * A job that lives in the small-works collection is never also offered under Projects,
 * even when its job type is not "Small Works". Duplicate ids are kept once.
 */
export function splitBookingMoveCatalogues(
  projects: Project[],
  smallWorks: Project[]
): { projects: Project[]; smallWorks: Project[] } {
  const seenSmall = new Set<string>()
  const smallOut: Project[] = []
  for (const row of smallWorks) {
    const key = jobKey(row.id)
    if (!key || seenSmall.has(key)) continue
    seenSmall.add(key)
    smallOut.push(row)
  }

  const seenProject = new Set<string>()
  const projectOut: Project[] = []
  for (const row of projects) {
    const key = jobKey(row.id)
    if (!key || seenProject.has(key) || seenSmall.has(key)) continue
    if (isSmallWorksJobType(row.jobType)) {
      seenSmall.add(key)
      smallOut.push(row)
      continue
    }
    seenProject.add(key)
    projectOut.push(row)
  }

  return { projects: projectOut, smallWorks: smallOut }
}

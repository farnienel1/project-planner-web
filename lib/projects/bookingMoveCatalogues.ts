import { jobKind } from '@/lib/canonical/staffAccess'
import type { Project } from '@/types'

function jobKey(id: string): string {
  return id.trim().toLowerCase()
}

/**
 * Projects and small works stay in their own lists (rulebook 1.11.0 `jobKind`): a document read from `projects` is a
 * project and one read from `smallWorks` is a small works job, whatever its job type says. A project and a small works
 * job that share one id (older iOS builds created such pairs) are both kept, each in its own list
 * (`jobIdsInBothCollections` lists them for the owner). Duplicate ids within one list are kept once.
 */
export function splitBookingMoveCatalogues(
  projects: Project[],
  smallWorks: Project[]
): { projects: Project[]; smallWorks: Project[] } {
  const seen = { projects: new Set<string>(), smallWorks: new Set<string>() }
  const out: { projects: Project[]; smallWorks: Project[] } = { projects: [], smallWorks: [] }
  for (const [rows, collection] of [[projects, 'projects'], [smallWorks, 'smallWorks']] as const) {
    for (const row of rows) {
      const key = jobKey(row.id)
      const kind = jobKind(row, row.collection ?? collection)
      if (!key || seen[kind].has(key)) continue
      seen[kind].add(key)
      out[kind].push(row)
    }
  }
  return out
}

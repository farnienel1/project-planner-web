/**
 * Owner console → Data quality → Test organisations (owner bug 17 Nov: "Mark internal does nothing").
 *
 * Since D12 (#348) an organisation is test data only when it is flagged (`isTestOrganisation`), so the old list —
 * which offered "Mark internal" on every row of `isTestOrganisation` — only ever offered it on organisations that were
 * already marked: the click re-wrote `true` over `true` and the row looked the same. The page now shows two lists:
 * - `marked`: flagged organisations, shown as "Marked internal" (with Unmark);
 * - `unmarked`: every other organisation that has a saved document, offered "Mark internal". An "Unfinished setup"
 *   row (no organisation document) is never offered: there is nothing to flag, and the route refuses it (404).
 * A console display rule, not a business rule (like `testData.ts`), so it lives in lib/owner.
 */
import { isTestOrganisation } from '@/lib/owner/testData'

export type DataQualityOrg = {
  id: string
  name: string
  isInternal?: boolean
  unfinishedSetup?: boolean
}

/** The flag each organisation should show after a successful click, before the reload catches up (id → marked). */
export type MarkOverrides = Readonly<Record<string, boolean>>

function byName(a: DataQualityOrg, b: DataQualityOrg) {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
}

/** Splits the organisations into marked and markable, applying the clicks that already succeeded. */
export function dataQualityTestOrgSections<T extends DataQualityOrg>(
  orgs: readonly T[],
  overrides: MarkOverrides = {}
): { marked: T[]; unmarked: T[] } {
  const marked: T[] = []
  const unmarked: T[] = []
  for (const org of orgs) {
    const flagged = Object.prototype.hasOwnProperty.call(overrides, org.id) ? overrides[org.id] === true : isTestOrganisation(org)
    if (flagged) marked.push(org)
    else if (!org.unfinishedSetup) unmarked.push(org)
  }
  return { marked: marked.sort(byName), unmarked: unmarked.sort(byName) }
}

/** Filters the markable organisations by name or id (trimmed, without case). An empty query keeps them all. */
export function filterMarkableOrgs<T extends DataQualityOrg>(orgs: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...orgs]
  return orgs.filter((org) => org.name.toLowerCase().includes(q) || org.id.toLowerCase().includes(q))
}

/** Drops overrides the reloaded data already agrees with, so a later change elsewhere is never hidden. */
export function settledMarkOverrides(orgs: readonly DataQualityOrg[], overrides: MarkOverrides): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  const byId = new Map(orgs.map((org) => [org.id, org]))
  for (const [id, value] of Object.entries(overrides)) {
    const org = byId.get(id)
    if (org && isTestOrganisation(org) === value) continue
    next[id] = value
  }
  return next
}

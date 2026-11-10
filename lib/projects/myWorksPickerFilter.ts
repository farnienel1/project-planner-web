import type { Project } from '@/types'
import { worksInTab, worksTabCounts, type WorksTab, type WorksTabCounts } from '@/lib/canonical'
import { searchWorks } from '@/lib/projects/workStatus'

/**
 * Owner request 10 Nov: the My Projects / My Small works ⚙ picker filters its rows by All / Active / Upcoming /
 * Completed. Which tab a job is under is rulebook §21 (`worksInTab`, counts `worksTabCounts`, an inactive job under
 * Completed) on the organisation day; only the search text match is local (`searchWorks`). The chip narrows what is
 * shown, never the ticks: Save writes the whole list.
 */
export const MY_WORKS_PICKER_TABS: ReadonlyArray<{ tab: WorksTab; label: string }> = [
  { tab: 'all', label: 'All' },
  { tab: 'active', label: 'Active' },
  { tab: 'upcoming', label: 'Upcoming' },
  { tab: 'completed', label: 'Completed' },
]

/** The picker's default chip. */
export const MY_WORKS_PICKER_DEFAULT_TAB: WorksTab = 'all'

/** The rows shown: the chip's jobs (`worksInTab`, in order), then the search text. */
export function myWorksPickerShownJobs<T extends Project>(
  jobs: ReadonlyArray<T>,
  tab: WorksTab,
  search: string,
  now: unknown,
  timeZone: string
): T[] {
  return searchWorks(worksInTab(jobs, tab, now, timeZone), search)
}

/** The chip counts: `worksTabCounts` over every job the picker lists (not narrowed by the search). */
export function myWorksPickerCounts(jobs: ReadonlyArray<Project>, now: unknown, timeZone: string): WorksTabCounts {
  return worksTabCounts(jobs, now, timeZone)
}

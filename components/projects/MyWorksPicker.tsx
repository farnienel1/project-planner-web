'use client'

/**
 * Rulebook 1.33.0 §21: the ⚙ of "My Projects" / "My Small works" — every job of the list the person sees, ticked when it
 * is on their list. The rows and the list after a tick are the rulebook's (`myWorksPickerRows`,
 * `myWorksPicksAfterToggle`); Save writes `organizations/{orgId}/worksListPicks/{uid}`.
 * Owner request 10 Nov: All / Active / Upcoming / Completed chips narrow the rows while ticking (`worksInTab`,
 * `worksTabCounts` on the organisation day, `lib/projects/myWorksPickerFilter.ts`); ticks survive a chip change and Save
 * writes the whole list. The ticks start from the whole stored list (`storedIds`, `myWorksIds`), not the rows shown, so
 * ids of deleted or hidden jobs stay stored after Save (rulebook §21, guardrail 3).
 * Save hands the list to Firestore and closes at once; Cancel is never locked (iOS PR #210). The list screen shows a
 * small notice when the server has not confirmed within 15 s or refused it (`useMyWorksList().saveNotice`).
 */
import { useMemo, useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { myWorksPicksAfterToggle, myWorksTabLabel, type WorkCatalogue, type WorksTab } from '@/lib/canonical'
import { FilterChip, IosFormModal, SearchField } from '@/components/ios/primitives'
import {
  MY_WORKS_PICKER_DEFAULT_TAB,
  MY_WORKS_PICKER_TABS,
  myWorksPickerCounts,
  myWorksPickerShownJobs,
  myWorksPickerStartIds,
} from '@/lib/projects/myWorksPickerFilter'
import type { Project } from '@/types'

export function MyWorksPicker({
  kind,
  rows,
  storedIds,
  todayKey,
  timeZone,
  onCancel,
  onSave,
}: {
  kind: WorkCatalogue
  /** `myWorksPickerRows` for the viewer. */
  rows: ReadonlyArray<{ job: Project; picked: boolean }>
  /** `useMyWorksList().storedIds`: the whole stored list, ids not shown included. */
  storedIds: ReadonlyArray<string>
  /** The organisation day and zone the list screen uses for its own tabs. */
  todayKey: string
  timeZone: string
  onCancel: () => void
  /** Hands the list to the save and closes; never awaited (the list screen shows a pending / refused notice). */
  onSave: (ids: string[]) => void
}) {
  const [ids, setIds] = useState<string[]>(() => myWorksPickerStartIds(storedIds))
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<WorksTab>(MY_WORKS_PICKER_DEFAULT_TAB)
  const picked = useMemo(() => new Set(ids.map((id) => id.toLowerCase())), [ids])
  const jobs = useMemo(() => rows.map((row) => row.job), [rows])
  const counts = useMemo(() => myWorksPickerCounts(jobs, todayKey, timeZone), [jobs, todayKey, timeZone])
  const shown = useMemo(
    () => myWorksPickerShownJobs(jobs, tab, search, todayKey, timeZone),
    [jobs, tab, search, todayKey, timeZone]
  )
  const noun = kind === 'smallWorks' ? 'small works' : 'projects'

  return (
    <IosFormModal
      title={myWorksTabLabel(kind)}
      onCancel={onCancel}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => onSave(ids)}>
            Save
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[var(--ink3)]">Tick the {noun} you want on your list. Your list is the same on the web and on iPhone.</p>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={`Filter ${noun}`}>
        {MY_WORKS_PICKER_TABS.map((option) => (
          <FilterChip
            key={option.tab}
            title={`${option.label} · ${counts[option.tab]}`}
            selected={tab === option.tab}
            onClick={() => setTab(option.tab)}
          />
        ))}
      </div>
      <SearchField value={search} onChange={setSearch} placeholder={`Search ${noun}…`} />
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {shown.map((job) => {
          const on = picked.has(job.id.toLowerCase())
          return (
            <li key={job.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 py-2.5 text-left"
                aria-pressed={on}
                onClick={() => setIds((current) => myWorksPicksAfterToggle(current, job.id, !on))}
              >
                {on ? (
                  <CheckCircleIcon className="h-6 w-6 shrink-0 text-[var(--blue)]" />
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[var(--line)]" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{job.siteName || job.jobNumber}</span>
                  <span className="block truncate text-xs text-[var(--ink3)]">{job.jobNumber}</span>
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 ? <li className="py-6 text-center text-sm text-[var(--ink3)]">No {noun} found.</li> : null}
      </ul>
    </IosFormModal>
  )
}

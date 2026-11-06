'use client'

/**
 * Rulebook 1.33.0 §21: the ⚙ of "My Projects" / "My Small works" — every job of the list the person sees, ticked when it
 * is on their list. The rows and the list after a tick are the rulebook's (`myWorksPickerRows`,
 * `myWorksPicksAfterToggle`); Save writes `organizations/{orgId}/worksListPicks/{uid}`.
 */
import { useMemo, useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { myWorksPicksAfterToggle, myWorksTabLabel, type WorkCatalogue } from '@/lib/canonical'
import { IosFormModal, SearchField } from '@/components/ios/primitives'
import { searchWorks } from '@/lib/projects/workStatus'
import type { Project } from '@/types'

export function MyWorksPicker({
  kind,
  rows,
  onCancel,
  onSave,
}: {
  kind: WorkCatalogue
  /** `myWorksPickerRows` for the viewer. */
  rows: ReadonlyArray<{ job: Project; picked: boolean }>
  onCancel: () => void
  onSave: (ids: string[]) => Promise<void>
}) {
  const [ids, setIds] = useState<string[]>(() => rows.filter((row) => row.picked).map((row) => row.job.id))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picked = useMemo(() => new Set(ids.map((id) => id.toLowerCase())), [ids])
  const shown = useMemo(() => searchWorks(rows.map((row) => row.job), search), [rows, search])
  const noun = kind === 'smallWorks' ? 'small works' : 'projects'

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(ids)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your list.')
      setSaving(false)
    }
  }

  return (
    <IosFormModal
      title={myWorksTabLabel(kind)}
      onCancel={onCancel}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[var(--ink3)]">Tick the {noun} you want on your list. Your list is the same on the web and on iPhone.</p>
      <SearchField value={search} onChange={setSearch} placeholder={`Search ${noun}…`} />
      {error ? <p className="mt-3 text-sm text-[var(--red)]">{error}</p> : null}
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

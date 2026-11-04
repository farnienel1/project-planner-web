'use client'

import { useMemo, useState } from 'react'
import { JOB_MANAGER_NO_CANDIDATES_MESSAGE } from '@/lib/canonical'
import type { ProjectManagerChoice, ProjectManagerSelectedEntry } from '@/lib/projects/projectManagerChoices'

type JobManagerPickerProps = {
  /** `projectManagerChoices` (rulebook `jobManagerCandidates`). */
  choices: readonly ProjectManagerChoice[]
  /** `projectManagerSelectedEntries` for the ids on the form. */
  selected: readonly ProjectManagerSelectedEntry[]
  /** Whether a choice is already picked (`projectManagerChoiceSelected`). */
  isSelected: (choice: ProjectManagerChoice) => boolean
  onAdd: (choice: ProjectManagerChoice) => void
  onRemove: (id: string) => void
  disabled?: boolean
  disabledReason?: string
  invalid?: boolean
  errorId?: string
  loading?: boolean
}

function LevelBadge({ label }: { label: string }) {
  const admin = label === 'Admin'
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        admin ? 'border-slate-300 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
      }`}
    >
      {label}
    </span>
  )
}

/**
 * The job-manager picker for create and edit, projects and small works: the picked managers as chips at the top
 * (each with a remove ×; a former manager says why they no longer count), then a searchable list of the people who
 * can be picked, each with their level. The list and the notes come from the rulebook (`jobManagerCandidates`,
 * `jobManagerAssignments`); this component only shows them.
 */
export function JobManagerPicker({
  choices,
  selected,
  isSelected,
  onAdd,
  onRemove,
  disabled,
  disabledReason,
  invalid,
  errorId,
  loading,
}: JobManagerPickerProps) {
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      choices.filter(
        (choice) => !needle || choice.label.toLowerCase().includes(needle) || choice.email.toLowerCase().includes(needle)
      ),
    [choices, needle]
  )

  return (
    <div
      className={`rounded-lg border bg-white ${invalid ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-300'}`}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      title={disabled ? disabledReason : undefined}
    >
      <div className="border-b border-slate-200 px-3 py-2" data-testid="job-manager-selected">
        <p className="mb-1.5 text-xs font-semibold text-slate-500">
          {selected.length === 0 ? 'No managers assigned yet' : `Assigned (${selected.length})`}
        </p>
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((entry) => {
              const flagged = entry.state !== 'current'
              return (
                <li
                  key={entry.id}
                  className={`flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-sm ${
                    flagged ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-slate-50 text-slate-800'
                  }`}
                >
                  <span className="truncate font-medium">{entry.label}</span>
                  {entry.levelLabel && <LevelBadge label={entry.levelLabel} />}
                  {entry.note && <span className="truncate text-xs">{entry.note}</span>}
                  {entry.state === 'unknown' && <span className="text-xs text-slate-500">Not loaded</span>}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                      aria-label={`Remove ${entry.label}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {selected.some((entry) => entry.state === 'former') && (
          <p className="mt-1.5 text-xs text-amber-800">
            Former managers no longer count as managers of this job. They are removed when you save.
          </p>
        )}
      </div>

      {!disabled && (
        <div className="px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search managers and admins"
            aria-label="Search managers and admins"
            className="mb-2 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          {loading && choices.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">Loading people…</p>
          ) : choices.length === 0 ? (
            <p className="py-2 text-xs text-amber-700">{JOB_MANAGER_NO_CANDIDATES_MESSAGE}</p>
          ) : filtered.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">No one matches “{search.trim()}”.</p>
          ) : (
            <ul className="max-h-52 space-y-0.5 overflow-y-auto" data-testid="job-manager-choices">
              {filtered.map((choice) => {
                const picked = isSelected(choice)
                return (
                  <li key={choice.id}>
                    <button
                      type="button"
                      disabled={picked}
                      onClick={() => onAdd(choice)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                        picked ? 'cursor-default text-slate-400' : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{choice.label}</span>
                        {choice.email && <span className="block truncate text-xs text-slate-500">{choice.email}</span>}
                      </span>
                      <LevelBadge label={choice.levelLabel} />
                      <span className="w-14 shrink-0 text-right text-xs font-semibold">{picked ? 'Added' : '+ Add'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

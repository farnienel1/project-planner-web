'use client'

/**
 * F9 "Assign to": person chips, a Me shortcut and one Add people picker (search, Managers / Operatives, trade filter;
 * managers and operatives may be mixed). One row per person (`taskPersonIndex`, owner decision 17 Nov); an assignee
 * whose row is gone reads "Removed user" (bug B11, `taskAssigneeNames`). Visual and selection only.
 */

import { useMemo, useState } from 'react'
import { CheckIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  isTaskPersonSelected,
  peopleForTaskPicker,
  taskAssigneeNames,
  toggleTaskPerson,
  type TaskPersonIndex,
} from '@/lib/tasks/taskAssigneePeople'
import { personDisplayName } from '@/lib/tasks/projectTaskFilters'
import { TASK_COPY } from '@/lib/canonical'
import type { Manager, Operative } from '@/types'

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function tradeLabel(row: { tradeTypePreset?: string; tradeTypeCustom?: string }): string {
  return (row.tradeTypeCustom || '').trim() || (row.tradeTypePreset || '').trim()
}

export function TaskPeopleField({
  managers,
  allManagers,
  operatives,
  offeredOperatives,
  goneIds,
  index,
  selectedManagers,
  selectedOperatives,
  onChange,
  me,
  error,
  loaded = true,
}: {
  /** Managers offered for a new assignment (rulebook 1.91.0 `taskAssigneeCandidates`). */
  managers: Manager[]
  /** Operatives offered for a new assignment (rulebook 1.91.0 `taskAssigneeCandidates`). */
  offeredOperatives: Operative[]
  /** Rows whose person no longer exists ("Removed user"). */
  goneIds?: ReadonlySet<string>
  /** Every managers row (an existing assignment to a row not offered still shows). */
  allManagers: Manager[]
  operatives: Operative[]
  index: TaskPersonIndex
  selectedManagers: Set<string>
  selectedOperatives: Set<string>
  onChange: (next: { managers: Set<string>; operatives: Set<string> }) => void
  me: { kind: 'manager' | 'operative'; id: string } | null
  error?: string
  /** False while the rosters load: chosen people are not shown yet (never a false "Removed user"). */
  loaded?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [route, setRoute] = useState<'managers' | 'operatives'>('operatives')
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('')

  const chosen = taskAssigneeNames(
    { managerIds: [...selectedManagers], operativeIds: [...selectedOperatives] },
    { managers: allManagers, operatives, index, loaded, goneIds }
  )
  const meSelected = me ? isTaskPersonSelected(index, me.kind, me.id, selectedManagers, selectedOperatives) : false

  const toggle = (kind: 'manager' | 'operative', id: string) => {
    const next = toggleTaskPerson(index, kind, id, selectedManagers, selectedOperatives)
    onChange({ managers: next.managers, operatives: next.operatives })
  }
  const removeEntry = (kind: 'manager' | 'operative', id: string) => {
    const managersNext = new Set(selectedManagers)
    const operativesNext = new Set(selectedOperatives)
    if (kind === 'manager') managersNext.delete(id)
    else operativesNext.delete(id)
    // A person stored under several ids loses all of them (the toggle does that for a known row).
    const known = (kind === 'manager' ? allManagers : operatives).some((row) => row.id.toLowerCase() === id.toLowerCase())
    if (known) {
      const next = toggleTaskPerson(index, kind, id, selectedManagers, selectedOperatives)
      onChange({ managers: next.managers, operatives: next.operatives })
    } else onChange({ managers: managersNext, operatives: operativesNext })
  }

  const offered = useMemo(
    () => peopleForTaskPicker(managers, offeredOperatives, route, [], index),
    [managers, offeredOperatives, route, index]
  )
  const rows: Array<{ kind: 'manager' | 'operative'; row: Manager | Operative }> =
    route === 'managers'
      ? offered.managers.map((row) => ({ kind: 'manager' as const, row }))
      : offered.operatives.map((row) => ({ kind: 'operative' as const, row }))
  const trades = [...new Set(rows.map(({ row }) => tradeLabel(row)).filter(Boolean))].sort()
  const q = search.trim().toLowerCase()
  const shown = rows.filter(({ row }) => {
    if (q && !personDisplayName(row).toLowerCase().includes(q) && !(row.email || '').toLowerCase().includes(q)) return false
    if (trade && tradeLabel(row) !== trade) return false
    return true
  })
  const selectedCount = chosen.length

  return (
    <div className="tk-field">
      <span className="tk-label" id="tk-assign-label">
        {TASK_COPY.form.assigneesLabel}
      </span>
      <div className="tk-pchips" aria-labelledby="tk-assign-label">
        {chosen.map((entry) => (
          <span key={`${entry.kind}:${entry.id}`} className={`tk-pchip${entry.removed ? ' removed' : ''}`}>
            <span className={`tk-avatar${entry.removed ? ' removed' : ''}`} aria-hidden>
              {entry.removed ? '?' : initialsOf(entry.name)}
            </span>
            {entry.name}
            <button type="button" className="x" aria-label={`Remove ${entry.name}`} onClick={() => removeEntry(entry.kind, entry.id)}>
              <XMarkIcon width={16} height={16} aria-hidden />
            </button>
          </span>
        ))}
        {me && !meSelected ? (
          <button type="button" className="tk-btn sm" onClick={() => toggle(me.kind, me.id)}>
            <PlusIcon width={16} height={16} aria-hidden />
            {TASK_COPY.form.me}
          </button>
        ) : null}
        <div className="tk-picker">
          <button type="button" className="tk-btn sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <PlusIcon width={16} height={16} aria-hidden />
            {TASK_COPY.form.addPeople}
          </button>
          {open ? (
            <div className="tk-pop" role="dialog" aria-label={TASK_COPY.form.addPeople}>
              <div className="tk-pop-h">
                <div className="tk-search" style={{ height: 40 }}>
                  <MagnifyingGlassIcon aria-hidden />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" autoFocus />
                </div>
                <div className="tk-seg" role="group" aria-label="Kind of person">
                  <button type="button" aria-pressed={route === 'managers'} onClick={() => setRoute('managers')}>
                    Managers
                  </button>
                  <button type="button" aria-pressed={route === 'operatives'} onClick={() => setRoute('operatives')}>
                    Operatives
                  </button>
                </div>
                {trades.length > 0 ? (
                  <select className="tk-select" value={trade} onChange={(e) => setTrade(e.target.value)} aria-label="Trade" style={{ maxWidth: 'none' }}>
                    <option value="">All trades</option>
                    {trades.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="tk-pop-b">
                {shown.length === 0 ? <p className="tk-muted" style={{ padding: 10 }}>No one matches.</p> : null}
                {shown.map(({ kind, row }) => {
                  const on = isTaskPersonSelected(index, kind, row.id, selectedManagers, selectedOperatives)
                  const name = personDisplayName(row)
                  return (
                    <button key={`${kind}:${row.id}`} type="button" className="tk-pop-row" aria-pressed={on} onClick={() => toggle(kind, row.id)}>
                      <span className="tk-avatar" aria-hidden>
                        {initialsOf(name)}
                      </span>
                      <span style={{ flex: 1 }}>
                        {name}
                        <small>{tradeLabel(row) || (kind === 'manager' ? 'Manager' : 'Operative')}</small>
                      </span>
                      {on ? <CheckIcon width={20} height={20} aria-hidden /> : null}
                    </button>
                  )
                })}
              </div>
              <div className="tk-pop-f">
                <span className="tk-muted">{selectedCount} selected</span>
                <button type="button" className="tk-btn sm primary" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <span className="tk-error" role="alert">{error}</span> : null}
    </div>
  )
}

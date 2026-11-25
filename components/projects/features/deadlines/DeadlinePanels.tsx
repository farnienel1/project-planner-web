'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { isPlausibleDayKey } from '@/lib/security/boundedValue'
import { uploadPickError } from '@/lib/security/uploadLimits'
import {
  applyCreatedHistory,
  applyEditHistory,
  daysRemaining,
  deadlineLocationList,
  deadlineLocationText,
  dependents,
  formatDay,
  formatStamp,
  formatWeekCommencing,
  historyLine,
  deadlineDayLabel,
  deadlineView,
  predecessors,
  progressPercent,
  statusLabel,
} from '@/lib/deadlines/logic'
import type { DeadlineDisplay } from '@/lib/canonical'
import {
  DEADLINE_REOPEN_LABEL,
  DEADLINE_RESCHEDULE_OTHER_REASON,
  DEADLINE_RESCHEDULE_REASONS,
  deadlineRescheduleReasonError,
  deadlineRescheduleReasonText,
} from '@/lib/canonical'
import {
  DEADLINE_LOCATION_PRESETS,
  DEADLINE_TRADE_OPTIONS,
} from '@/lib/deadlines/types'
import type { Deadline } from '@/lib/deadlines/types'
import type { SiteAudit } from '@/types'
import { ReportFileLink } from '@/components/fileReports/ReportFileLink'
import { StoredFileLink } from '@/components/projects/features/StoredFileLink'
import { storedFileDirectHref } from '@/lib/healthSafety/storedFile'
import { safeExternalUrl } from '@/lib/canonical/uploadPolicy'
import { deadlineLocationWriteFields } from '@/lib/canonical/workDocumentReaders'
import { TaskDialog } from '@/components/tasks/upgrade/TaskDialog'

export type DeadlinePerson = { id: string; name: string; subtitle: string; isLive: boolean }

const PROGRESS_STEPS = [0, 25, 50, 75, 100]

export function auditTitle(audit: SiteAudit): string {
  return audit.customTitle?.trim() || audit.type
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const backdropArmed = useRef(false)
  return (
    <div
      className="fixed inset-0 z-110 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onPointerDown={(event) => {
        backdropArmed.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (backdropArmed.current && event.target === event.currentTarget) onClose()
        backdropArmed.current = false
      }}
    >
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[22px] bg-(--bg) shadow-(--sh-pop) sm:rounded-[22px]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-(--line) bg-(--card) px-4 py-3">
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Close
          </button>
          <div className="min-w-0 pt-1">
            <p className="truncate font-(family-name:--head) text-lg font-extrabold text-(--ink)">{title}</p>
            {subtitle ? <p className="truncate text-xs text-(--ink3)">{subtitle}</p> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="border-t border-(--line) bg-(--card) p-4">{footer}</div> : null}
      </div>
    </div>
  )
}

/** Rulebook 1.94.0 §23: the 30 px progress ring in the deadline's colour (a check once completed). */
export function ProgressRing({ view }: { view: DeadlineDisplay }) {
  const r = 12
  const length = 2 * Math.PI * r
  const done = view.group === 'completed'
  return (
    <span className="dl-ring" data-dl-tone={view.tone} aria-hidden>
      <svg viewBox="0 0 30 30">
        <circle className="track" cx="15" cy="15" r={r} fill="none" strokeWidth="3" />
        <circle
          className="fill"
          cx="15"
          cy="15"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(view.progressPercent / 100) * length} ${length}`}
          transform="rotate(-90 15 15)"
        />
        {done ? <path d="M10 15.5l3.2 3.2L20 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
    </span>
  )
}

/** Rulebook 1.94.0 §23: the progress bar with a tick where progress should be by today, and its words. */
export function ProgressBar({ view, big = false }: { view: DeadlineDisplay; big?: boolean }) {
  const label = view.paceText ?? `${view.progressPercent}% complete`
  return (
    <div data-dl-tone={view.tone}>
      <div
        className={`dl-bar${big ? ' big' : ''}`}
        role="img"
        aria-label={view.expectedPercent != null && view.group !== 'completed' ? `${view.progressPercent}% complete, expected ${view.expectedPercent}%` : `${view.progressPercent}% complete`}
      >
        <span className="fill" style={{ width: `${view.progressPercent}%` }} />
        {view.expectedPercent != null && view.group !== 'completed' ? <span className="tick" style={{ left: `${view.expectedPercent}%` }} /> : null}
      </div>
      <p className={`dl-bar-text${view.paceText ? ' behind' : ''}`}>{label}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-bold tracking-wide text-(--ink3)">{label.toUpperCase()}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

export function DetailSheet({
  item,
  items,
  projectLabel,
  now,
  canManage,
  audits,
  onClose,
  onEdit,
  onReschedule,
  onOpen,
  onProgress,
  onComplete,
  onReopen,
}: {
  item: Deadline
  items: Deadline[]
  /** The project or small works the deadline is on ("Site · J-1042"), never the floor. */
  projectLabel: string
  now: Date
  canManage: boolean
  audits: SiteAudit[]
  onClose: () => void
  onEdit: () => void
  onReschedule: () => void
  onOpen: (id: string) => void
  onProgress: (pct: number) => void
  onComplete: () => void
  onReopen: () => void
}) {
  const [percent, setPercent] = useState(progressPercent(item))
  useEffect(() => setPercent(progressPercent(item)), [item])
  const view = deadlineView(item, now)
  const completed = view.group === 'completed'
  const before = predecessors(items, item)
  const after = dependents(items, item)
  const audit = audits.find((row) => row.id === item.siteAuditId)
  const chipTone = view.tone === 'primary' ? 'blue' : view.tone
  return (
    <TaskDialog
      open
      title={item.title}
      onClose={onClose}
      subtitle={
        <div className="tk-chips" style={{ alignItems: 'center' }} data-dl-tone={view.tone}>
          {projectLabel ? <span className="tk-muted">{projectLabel}</span> : null}
          <span className="tk-chip" data-tone={chipTone}>
            {view.statusLabel}
          </span>
          <span className="tk-chip" data-tone={chipTone}>
            {view.dueText}
            {view.group !== 'completed' ? ` · ${deadlineDayLabel(item.due)}` : ''}
          </span>
          {item.isCritical ? (
            <span className="tk-chip" data-tone="red">
              Critical path
            </span>
          ) : null}
        </div>
      }
      footer={
        canManage ? (
          <>
            <button type="button" className="tk-btn" onClick={onEdit}>
              Edit
            </button>
            <span className="grow" />
            <button type="button" className="tk-btn" onClick={onReschedule}>
              Reschedule
            </button>
            {item.status !== 'complete' ? (
              <button type="button" className="tk-btn primary" onClick={onComplete}>
                Mark complete
              </button>
            ) : (
              <button type="button" className="tk-btn primary" onClick={onReopen}>
                {DEADLINE_REOPEN_LABEL}
              </button>
            )}
          </>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="card pad">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-[0.08em] text-(--ink3)">PROGRESS</h3>
            <span className="pill">{statusLabel(item.status)}</span>
          </div>
          <ProgressBar view={view} big />
          {canManage && !completed ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {PROGRESS_STEPS.map((step) => (
                <button key={step} type="button" className={`btn sm ${percent === step ? 'primary' : ''}`} onClick={() => setPercent(step)}>
                  {step}%
                </button>
              ))}
            </div>
          ) : null}
          {canManage && !completed && percent !== progressPercent(item) ? (
            <button type="button" className="btn primary mt-3" onClick={() => onProgress(percent)}>
              Save progress
            </button>
          ) : null}
        </div>
        <div className="card divide-y divide-(--line)">
          <Field label="Location" value={deadlineLocationText(item) || 'Not set'} />
          <Field label="Trade" value={item.trade || 'Not set'} />
          <Field label="Critical path" value={item.isCritical ? 'Yes — slipping this pushes the whole programme' : 'No'} />
          <Field label="Work starts" value={item.start ? deadlineDayLabel(item.start, true) : 'Not set'} />
          <Field label="Due" value={deadlineDayLabel(item.due, true)} />
          <Field
            label="Responsible"
            value={item.assignees.length === 0 ? 'Unassigned' : `${item.assignees.join(', ')}${item.company ? ` · ${item.company}` : ''}`}
          />
          <Field
            label="Reminder"
            value={item.reminderDaysBefore == null ? 'None' : `${item.reminderDaysBefore} days before, and on the day`}
          />
        </div>
        {item.fileURL || item.fileName || item.siteAuditId ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">ATTACHED</h3>
            <div className="card divide-y divide-(--line)">
              {item.fileURL ? (
                <div className="px-4 py-3">
                  <StoredFileLink className="block text-sm font-semibold" fileRef={item.fileURL}>
                    {item.fileName || 'Attached file'}
                    {storedFileDirectHref(item.fileURL) && /\.(png|jpe?g|webp|gif|heic)$/i.test(item.fileName || item.fileURL) ? (
                      <img src={storedFileDirectHref(item.fileURL) ?? undefined} alt="" className="mt-2 max-h-48 rounded-lg object-cover" />
                    ) : null}
                  </StoredFileLink>
                  <ReportFileLink fileRef={item.fileURL} surface="deadline" parentId={item.id} fileName={item.fileName} />
                </div>
              ) : item.fileName ? (
                <p className="px-4 py-3 text-sm font-semibold">{item.fileName}</p>
              ) : null}
              {item.siteAuditId ? (
                <div className="px-4 py-3">
                  <a className="text-sm font-semibold text-(--blue)" href="/dashboard/site-audit">
                    {audit ? auditTitle(audit) : item.siteAuditTitle || 'Attached site audit'}
                  </a>
                  {audit ? (
                    <div className="mt-3 space-y-3">
                      {audit.items.map((entry) => (
                        <div key={entry.id} className="rounded-xl bg-(--soft) p-3">
                          <p className="text-sm font-semibold">{entry.title}</p>
                          <p className="text-[11px] font-semibold text-(--ink3)">Taken {formatStamp(entry.createdAt)}</p>
                          {entry.location ? <p className="text-xs text-(--ink3)">{entry.location}</p> : null}
                          {entry.comments ? <p className="mt-1 text-sm">{entry.comments}</p> : null}
                          {entry.imageURL ? (
                            <>
                              <a href={safeExternalUrl(entry.imageURL) ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block">
                                <img src={entry.imageURL} alt="" className="max-h-40 rounded-lg object-cover" />
                              </a>
                              <ReportFileLink fileRef={entry.imageURL} surface="site_audit" parentId={audit.id} />
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-(--ink3)">Open site audits to see the photos if this one is not on the job yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {before.length > 0 || after.length > 0 ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">KNOCK-ON EFFECTS</h3>
            <div className="card divide-y divide-(--line)">
              {before.map((dep) => (
                <button key={dep.id} type="button" className="block w-full px-4 py-3 text-left" onClick={() => onOpen(dep.id)}>
                  <span className="block text-sm font-semibold">{dep.title}</span>
                  <span className="text-xs text-(--ink3)">Must finish first · {deadlineView(dep, now).dueText}</span>
                </button>
              ))}
              {after.map((dep) => (
                <button key={dep.id} type="button" className="block w-full px-4 py-3 text-left" onClick={() => onOpen(dep.id)}>
                  <span className="block text-sm font-semibold">{dep.title}</span>
                  <span className="text-xs text-(--ink3)">Waits on this · due {deadlineDayLabel(dep.due)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {item.detail ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">SCOPE</h3>
            <p className="card pad text-sm text-(--ink2)">{item.detail}</p>
          </section>
        ) : null}
        {item.history.length > 0 ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">HISTORY</h3>
            <div className="card divide-y divide-(--line)">
              {item.history.map((change) => (
                <div key={change.id} className="px-4 py-3">
                  <p className="text-sm font-semibold">{historyLine(change)}</p>
                  <p className="text-xs text-(--ink3)">
                    {change.author} · {formatStamp(change.at)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-(--ink3)">
              Every date change is recorded with who moved it and why. This is the record you will want if the programme is ever disputed.
            </p>
          </section>
        ) : null}
      </div>
    </TaskDialog>
  )
}

function PeopleList({
  people,
  selected,
  onToggle,
}: {
  people: DeadlinePerson[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (people.length === 0) return null
  return (
    <div className="card divide-y divide-(--line)">
      {people.map((person) => (
        <button key={person.id} type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left" onClick={() => onToggle(person.id)}>
          <span
            className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
              selected.includes(person.id) ? 'bg-(--hs) text-white' : 'bg-(--soft2) text-(--ink3)'
            }`}
          >
            {selected.includes(person.id) ? '✓' : ''}
          </span>
          <span>
            <span className="block text-sm font-semibold">{person.name}</span>
            <span className="text-xs text-(--ink3)">{person.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export function EditorSheet({
  existing,
  contextKind,
  people,
  audits,
  authorName,
  onClose,
  onSave,
}: {
  existing: Deadline | null
  contextKind: string
  people: DeadlinePerson[]
  audits: SiteAudit[]
  authorName: string
  onClose: () => void
  onSave: (draft: Deadline, file: File | null) => void | Promise<void>
}) {
  const [title, setTitle] = useState(existing?.title || '')
  // Rulebook 1.92.0: a deadline may be on several floors / areas (presets and typed ones).
  const [locations, setLocations] = useState<string[]>(existing ? deadlineLocationList(existing) : [])
  const [customLocation, setCustomLocation] = useState('')
  const customLocations = locations.filter((name) => !(DEADLINE_LOCATION_PRESETS as readonly string[]).includes(name))
  const [trade, setTrade] = useState(existing?.trade || 'General')
  const [due, setDue] = useState(dayKey(existing?.due || new Date()))
  const [hasStart, setHasStart] = useState(existing ? existing.start != null : true)
  const [start, setStart] = useState(dayKey(existing?.start || new Date()))
  const [selected, setSelected] = useState<string[]>(existing?.assigneeUserIds || [])
  const [extraSearch, setExtraSearch] = useState('')
  const [critical, setCritical] = useState(existing?.isCritical || false)
  const [reminder, setReminder] = useState(existing ? existing.reminderDaysBefore != null : true)
  const [detail, setDetail] = useState(existing?.detail || '')
  const [auditId, setAuditId] = useState(existing?.siteAuditId || '')
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const live = people.filter((person) => person.isLive)
  const extras = people.filter((person) => {
    if (person.isLive) return false
    const q = extraSearch.trim().toLowerCase()
    if (!q) return true
    return person.name.toLowerCase().includes(q) || person.subtitle.toLowerCase().includes(q)
  })
  const tradeChoices = Array.from(new Set([...(existing?.trade ? [existing.trade] : []), ...DEADLINE_TRADE_OPTIONS]))

  function toggleLocation(name: string) {
    setLocations((current) =>
      current.some((row) => row.toLowerCase() === name.toLowerCase())
        ? current.filter((row) => row.toLowerCase() !== name.toLowerCase())
        : [...current, name]
    )
  }

  function addCustomLocation() {
    const name = customLocation.trim()
    if (!name) return
    setLocations((current) => (current.some((row) => row.toLowerCase() === name.toLowerCase()) ? current : [...current, name]))
    setCustomLocation('')
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]))
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!title.trim()) {
      setFormError('Give the deadline a title to continue.')
      return
    }
    if (file && file.name.length > 180) {
      setFormError('That file name is too long. Rename the file and try again.')
      return
    }
    if (file) {
      const blocked = uploadPickError(file, 'work')
      if (blocked) {
        setFormError(blocked)
        return
      }
    }
    if (!isPlausibleDayKey(due)) {
      setFormError('Choose a due date.')
      return
    }
    const dueDate = dateFromDayKey(due)
    if (Number.isNaN(dueDate.getTime())) {
      setFormError('Choose a due date.')
      return
    }
    const chosen = people.filter((person) => selected.includes(person.id))
    const audit = audits.find((row) => row.id === auditId)
    const base: Deadline = existing
      ? { ...existing }
      : {
          id: newUuid(),
          title: '',
          location: null,
          trade: null,
          detail: null,
          start: null,
          due: dueDate,
          completedAt: null,
          assignees: [],
          assigneeUserIds: [],
          company: null,
          status: 'notStarted',
          progress: 0,
          isCritical: false,
          dependsOn: [],
          blockedReason: null,
          reminderDaysBefore: 2,
          originalDue: null,
          history: [],
          contextKind,
          projectId: '',
          createdByUserId: '',
          fileURL: null,
          fileName: null,
          siteAuditId: null,
          siteAuditTitle: null,
        }
    const next: Deadline = {
      ...base,
      title: title.trim(),
      ...(() => {
        const floors = deadlineLocationWriteFields([...locations, customLocation])
        return { location: floors.location || null, locations: floors.locations }
      })(),
      trade,
      detail: detail.trim() || null,
      start: hasStart && isPlausibleDayKey(start) ? dateFromDayKey(start) : null,
      due: dueDate,
      isCritical: critical,
      reminderDaysBefore: reminder ? 2 : null,
      contextKind,
      assigneeUserIds: chosen.map((person) => person.id),
      assignees: chosen.map((person) => person.name),
      siteAuditId: audit?.id || null,
      siteAuditTitle: audit ? auditTitle(audit) : null,
      fileName: file?.name || base.fileName,
    }
    if (hasStart && Number.isNaN(next.start?.getTime())) {
      setFormError('Choose a start date, or turn the start date off.')
      return
    }
    if (hasStart && next.start && dueDate.getTime() < next.start.getTime()) {
      setFormError('The due date is before the start date.')
      return
    }
    const stamped = existing ? applyEditHistory(existing, next, authorName, new Date()) : applyCreatedHistory(next, authorName, new Date())
    setSaving(true)
    setFormError(null)
    try {
      await onSave(stamped, file)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not save the deadline.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={existing ? 'Edit deadline' : 'New deadline'}
      subtitle={contextKind}
      onClose={onClose}
      footer={
        <div>
          {formError ? <p className="mb-2 text-xs font-semibold text-(--red)">{formError}</p> : null}
          <button type="button" className="btn primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add deadline'}
          </button>
        </div>
      }
    >
      <form id="deadline-editor" className="space-y-5" onSubmit={submit}>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">WHAT IS DUE</h3>
          <div className="card space-y-3 p-4">
            <input className="pp-in w-full" placeholder="e.g. 3rd Floor WC 1st Fix" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="pp-in w-full" rows={3} placeholder="Scope detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">WHERE</h3>
          <p className="mb-2 text-xs text-(--ink3)">Pick every floor or area this deadline covers.</p>
          <div className="chips">
            {DEADLINE_LOCATION_PRESETS.map((area) => {
              const on = locations.some((row) => row.toLowerCase() === area.toLowerCase())
              return (
                <button key={area} type="button" aria-pressed={on} className={`chip ${on ? 'on' : ''}`} onClick={() => toggleLocation(area)}>
                  {area}
                </button>
              )
            })}
            {customLocations.map((area) => (
              <button key={area} type="button" aria-pressed className="chip on" onClick={() => toggleLocation(area)} aria-label={`Remove ${area}`}>
                {area} ✕
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="pp-in min-w-0 grow"
              placeholder="Type another floor or area"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomLocation()
                }
              }}
            />
            <button type="button" className="btn sm" disabled={!customLocation.trim()} onClick={addCustomLocation}>
              Add
            </button>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">WHEN</h3>
          <div className="card space-y-3 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Has a start date
              <input type="checkbox" checked={hasStart} onChange={(e) => setHasStart(e.target.checked)} />
            </label>
            <p className="text-xs text-(--ink3)">Needed for pace tracking and the timeline</p>
            {hasStart ? (
              <label className="block text-sm font-semibold">
                Starts
                <input className="pp-in mt-1 w-full" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Due
              <input className="pp-in mt-1 w-full" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[11px] font-bold tracking-[0.08em] text-(--ink3)">WHO</h3>
            {live.length > 0 ? (
              <button
                type="button"
                className="ml-auto text-xs font-bold text-(--hs)"
                onClick={() => {
                  const liveIds = live.map((person) => person.id)
                  const allOn = liveIds.every((id) => selected.includes(id))
                  setSelected((current) => (allOn ? current.filter((id) => !liveIds.includes(id)) : Array.from(new Set([...current, ...liveIds]))))
                }}
              >
                {live.every((person) => selected.includes(person.id)) ? 'Clear live' : 'Select all live users'}
              </button>
            ) : null}
          </div>
          {live.length === 0 && people.every((person) => person.isLive) ? (
            <p className="card pad text-sm text-(--ink3)">No people available to assign yet.</p>
          ) : (
            <>
              {live.length > 0 ? (
                <>
                  <p className="mb-1 text-[11.5px] font-bold text-(--ink3)">Booked or tasked on this job</p>
                  <PeopleList people={live} selected={selected} onToggle={toggle} />
                </>
              ) : null}
              {people.some((person) => !person.isLive) ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11.5px] font-bold text-(--ink3)">Add extra people</p>
                  <input className="pp-in mb-2 w-full" placeholder="Search everyone else" value={extraSearch} onChange={(e) => setExtraSearch(e.target.value)} />
                  <PeopleList people={extras} selected={selected} onToggle={toggle} />
                </div>
              ) : null}
            </>
          )}
          <label className="mt-3 block text-sm font-semibold">
            Trade
            <select className="pp-in mt-1 w-full" value={trade} onChange={(e) => setTrade(e.target.value)}>
              {tradeChoices.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">ATTACH</h3>
          <div className="card space-y-3 p-4">
            <label className="block text-sm font-semibold">
              File
              <input className="mt-1 block w-full text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="mt-1 block text-xs font-medium text-(--ink3)">{file?.name || existing?.fileName || 'None — tap to upload'}</span>
            </label>
            <label className="block text-sm font-semibold">
              Site audit
              <select className="pp-in mt-1 w-full" value={auditId} onChange={(e) => setAuditId(e.target.value)}>
                <option value="">None — tap to attach one</option>
                {audits.map((audit) => (
                  <option key={audit.id} value={audit.id}>
                    {auditTitle(audit)} · {formatDay(audit.date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">PRIORITY AND REMINDERS</h3>
          <div className="card space-y-3 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>
                On the critical path
                <span className="mt-0.5 block text-xs font-medium text-(--ink3)">Slipping this pushes the whole programme</span>
              </span>
              <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>
                Remind me
                <span className="mt-0.5 block text-xs font-medium text-(--ink3)">Two days before, and again on the day</span>
              </span>
              <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
            </label>
          </div>
        </section>
      </form>
    </Sheet>
  )
}

export function RescheduleSheet({
  item,
  items,
  onClose,
  onSave,
}: {
  item: Deadline
  items: Deadline[]
  onClose: () => void
  onSave: (date: Date, reason: string) => void
}) {
  const [date, setDate] = useState(dayKey(item.due))
  const [picked, setPicked] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const next = isPlausibleDayKey(date) ? dateFromDayKey(date) : new Date(NaN)
  const movedDays = Number.isNaN(next.getTime()) ? 0 : daysRemaining({ due: next }, item.due)
  const reasonError = deadlineRescheduleReasonError(picked, detail)
  const reason = deadlineRescheduleReasonText(picked, detail)
  const canSave = isPlausibleDayKey(date) && movedDays !== 0 && reasonError === null
  const knockOn = dependents(items, item)
  return (
    <Sheet
      title="Reschedule"
      subtitle={item.title}
      onClose={onClose}
      footer={
        <div>
          {!canSave ? (
            <p className="mb-2 text-xs text-(--ink3)">{movedDays === 0 ? 'Pick a different date to continue' : reasonError}</p>
          ) : null}
          <button type="button" className="btn primary" disabled={!canSave} onClick={() => onSave(next, reason)}>
            Confirm new date
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
          <div>
            <p className="text-[10px] font-bold tracking-wide text-(--ink3)">CURRENTLY</p>
            <p className="text-lg font-extrabold">{formatDay(item.due)}</p>
            <p className="text-[11px] text-(--ink3)">{formatWeekCommencing(item.due)}</p>
          </div>
          <span className="text-(--ink3)">→</span>
          <div>
            <p className="text-[10px] font-bold tracking-wide text-(--ink3)">MOVING TO</p>
            <p className={`text-lg font-extrabold ${movedDays > 0 ? 'text-(--red)' : movedDays < 0 ? 'text-(--green)' : ''}`}>{formatDay(next)}</p>
            <p className="text-[11px] text-(--ink3)">{formatWeekCommencing(next)}</p>
          </div>
        </div>
        {movedDays !== 0 ? (
          <p className={`text-[12.5px] font-bold ${movedDays > 0 ? 'text-(--red)' : 'text-(--green)'}`}>
            {movedDays > 0
              ? `Pushing back ${movedDays} day${movedDays === 1 ? '' : 's'}`
              : `Pulling forward ${-movedDays} day${movedDays === -1 ? '' : 's'}`}
          </p>
        ) : null}
        <input className="pp-in w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {knockOn.length > 0 && movedDays > 0 ? (
          <div className="rounded-[14px] bg-(--leave-t) p-3 text-sm">
            <p className="font-bold">
              {knockOn.length} deadline{knockOn.length === 1 ? '' : 's'} depend{knockOn.length === 1 ? 's' : ''} on this
            </p>
            {knockOn.map((dep) => (
              <p key={dep.id} className="text-(--ink2)">
                · {dep.title} — currently due {formatDay(dep.due)}
              </p>
            ))}
            <p className="mt-1 text-[11.5px] text-(--ink3)">They are not moved automatically. Review them after saving.</p>
          </div>
        ) : null}
        <section>
          <h3 id="dl-reschedule-reason" className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ink3)">
            Reason — required
          </h3>
          <div className="chips flex-wrap" role="radiogroup" aria-labelledby="dl-reschedule-reason">
            {DEADLINE_RESCHEDULE_REASONS.map((reasonChip) => (
              <button
                key={reasonChip}
                type="button"
                role="radio"
                aria-checked={picked === reasonChip}
                className={`chip ${picked === reasonChip ? 'on' : ''}`}
                onClick={() => setPicked(picked === reasonChip ? null : reasonChip)}
              >
                {reasonChip}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-bold tracking-[0.08em] text-(--ink3)">Note</span>
            <textarea
              className="pp-in w-full"
              rows={3}
              placeholder={picked === DEADLINE_RESCHEDULE_OTHER_REASON ? 'Say why (required)' : 'Add detail (optional)'}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
        </section>
      </div>
    </Sheet>
  )
}

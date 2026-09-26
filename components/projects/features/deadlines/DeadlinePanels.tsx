'use client'

import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import {
  applyCreatedHistory,
  applyEditHistory,
  daysRemaining,
  dependents,
  formatDay,
  formatStamp,
  formatWeekCommencing,
  historyLine,
  pacingGap,
  predecessors,
  progressPercent,
  projectedFinish,
  statusLabel,
  urgency,
  urgencyPhrase,
  urgencyPill,
  urgencyTone,
} from '@/lib/deadlines/logic'
import {
  DEADLINE_LOCATION_PRESETS,
  DEADLINE_RESCHEDULE_REASONS,
  DEADLINE_TRADE_OPTIONS,
} from '@/lib/deadlines/types'
import type { Deadline, DeadlineUrgency } from '@/lib/deadlines/types'
import type { SiteAudit } from '@/types'

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
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[22px] bg-[var(--bg)] shadow-[var(--sh-pop)] sm:rounded-[22px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[var(--card)] px-4 py-3">
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Close
          </button>
          <div className="min-w-0 pt-1">
            <p className="truncate font-[family-name:var(--head)] text-lg font-extrabold text-[var(--ink)]">{title}</p>
            {subtitle ? <p className="truncate text-xs text-[var(--ink3)]">{subtitle}</p> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="border-t border-[var(--line)] bg-[var(--card)] p-4">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Countdown({ value }: { value: DeadlineUrgency }) {
  return (
    <span className="pill shrink-0" data-hue={urgencyTone(value)} style={{ background: 'var(--ht)', color: 'var(--h)' }}>
      {urgencyPill(value)}
    </span>
  )
}

export function Pacing({ item, now }: { item: Deadline; now: Date }) {
  const tone = urgencyTone(urgency(item, now))
  const expected = item.start && item.due.getTime() > item.start.getTime()
    ? Math.min(Math.max((now.getTime() - item.start.getTime()) / (item.due.getTime() - item.start.getTime()), 0), 1)
    : null
  const gap = pacingGap(item, now)
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--soft2)]">
        <div
          className="h-full rounded-full"
          data-hue={tone}
          style={{ width: `${Math.min(100, Math.max(0, item.progress * 100))}%`, background: 'var(--h)' }}
        />
        {expected != null ? (
          <span className="absolute top-[-2px] h-3 w-[2px] bg-[var(--ink)]" style={{ left: `${Math.min(100, expected * 100)}%` }} />
        ) : null}
      </div>
      <p className="mt-1 text-[11.5px] font-semibold text-[var(--ink3)]">
        {progressPercent(item)}% complete
        {gap != null && gap >= 5 && item.status !== 'complete' ? (
          <span className="font-bold text-[var(--red)]"> · {gap}% behind pace</span>
        ) : null}
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink3)]">{label.toUpperCase()}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

export function DetailSheet({
  item,
  items,
  now,
  canManage,
  audits,
  onClose,
  onEdit,
  onReschedule,
  onOpen,
  onProgress,
  onComplete,
}: {
  item: Deadline
  items: Deadline[]
  now: Date
  canManage: boolean
  audits: SiteAudit[]
  onClose: () => void
  onEdit: () => void
  onReschedule: () => void
  onOpen: (id: string) => void
  onProgress: (pct: number) => void
  onComplete: () => void
}) {
  const [percent, setPercent] = useState(progressPercent(item))
  useEffect(() => setPercent(progressPercent(item)), [item])
  const value = urgency(item, now)
  const gap = pacingGap(item, now)
  const before = predecessors(items, item)
  const after = dependents(items, item)
  const audit = audits.find((row) => row.id === item.siteAuditId)
  const finish = projectedFinish(item, now)
  return (
    <Sheet
      title="Deadline"
      subtitle={item.location || undefined}
      onClose={onClose}
      footer={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={onReschedule}>
              Reschedule
            </button>
            {item.status !== 'complete' ? (
              <button type="button" className="btn primary" onClick={onComplete}>
                Mark complete
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="card pad" data-hue={urgencyTone(value)}>
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 grow font-[family-name:var(--head)] text-xl font-extrabold">{item.title}</h2>
            <Countdown value={value} />
          </div>
          <p className="mt-1 text-sm text-[var(--ink3)]">{urgencyPhrase(value)}</p>
        </div>
        <div className="card pad">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">PROGRESS</h3>
            <span className="pill">{statusLabel(item.status)}</span>
          </div>
          <Pacing item={item} now={now} />
          {canManage ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {PROGRESS_STEPS.map((step) => (
                <button key={step} type="button" className={`btn sm ${percent === step ? 'primary' : ''}`} onClick={() => setPercent(step)}>
                  {step}%
                </button>
              ))}
            </div>
          ) : null}
          {canManage && percent !== progressPercent(item) ? (
            <button type="button" className="btn primary mt-3" onClick={() => onProgress(percent)}>
              Save progress
            </button>
          ) : null}
          {gap != null && gap >= 5 && item.status !== 'complete' ? (
            <p className="mt-3 rounded-xl bg-[var(--warn-t)] p-3 text-[12.5px]">
              At the current rate this finishes around {formatDay(finish)}. That is {gap}% behind where the programme expects it to be today.
            </p>
          ) : null}
        </div>
        <div className="card divide-y divide-[var(--line)]">
          <Field label="Location" value={item.location || 'Not set'} />
          <Field label="Trade" value={item.trade || 'Not set'} />
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
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">ATTACHED</h3>
            <div className="card divide-y divide-[var(--line)]">
              {item.fileURL ? (
                <a className="block px-4 py-3 text-sm font-semibold" href={item.fileURL} target="_blank" rel="noreferrer">
                  {item.fileName || 'Attached file'}
                </a>
              ) : item.fileName ? (
                <p className="px-4 py-3 text-sm font-semibold">{item.fileName}</p>
              ) : null}
              {item.siteAuditId ? (
                <p className="px-4 py-3 text-sm font-semibold">{audit ? auditTitle(audit) : item.siteAuditTitle || 'Attached site audit'}</p>
              ) : null}
            </div>
          </section>
        ) : null}
        {before.length > 0 || after.length > 0 ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">KNOCK-ON EFFECTS</h3>
            <div className="card divide-y divide-[var(--line)]">
              {before.map((dep) => (
                <button key={dep.id} type="button" className="block w-full px-4 py-3 text-left" onClick={() => onOpen(dep.id)}>
                  <span className="block text-sm font-semibold">{dep.title}</span>
                  <span className="text-xs text-[var(--ink3)]">Must finish first · {urgencyPhrase(urgency(dep, now))}</span>
                </button>
              ))}
              {after.map((dep) => (
                <button key={dep.id} type="button" className="block w-full px-4 py-3 text-left" onClick={() => onOpen(dep.id)}>
                  <span className="block text-sm font-semibold">{dep.title}</span>
                  <span className="text-xs text-[var(--ink3)]">Waits on this · due {formatDay(dep.due)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {item.detail ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">SCOPE</h3>
            <p className="card pad text-sm text-[var(--ink2)]">{item.detail}</p>
          </section>
        ) : null}
        {item.history.length > 0 ? (
          <section>
            <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">HISTORY</h3>
            <div className="card divide-y divide-[var(--line)]">
              {item.history.map((change) => (
                <div key={change.id} className="px-4 py-3">
                  <p className="text-sm font-semibold">{historyLine(change)}</p>
                  <p className="text-xs text-[var(--ink3)]">
                    {change.author} · {formatStamp(change.at)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--ink3)]">
              Every date change is recorded with who moved it and why. This is the record you will want if the programme is ever disputed.
            </p>
          </section>
        ) : null}
        {canManage ? (
          <button type="button" className="btn" onClick={onEdit}>
            Edit deadline
          </button>
        ) : null}
      </div>
    </Sheet>
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
    <div className="card divide-y divide-[var(--line)]">
      {people.map((person) => (
        <button key={person.id} type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left" onClick={() => onToggle(person.id)}>
          <span
            className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
              selected.includes(person.id) ? 'bg-[var(--hs)] text-white' : 'bg-[var(--soft2)] text-[var(--ink3)]'
            }`}
          >
            {selected.includes(person.id) ? '✓' : ''}
          </span>
          <span>
            <span className="block text-sm font-semibold">{person.name}</span>
            <span className="text-xs text-[var(--ink3)]">{person.subtitle}</span>
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
  const [location, setLocation] = useState(existing?.location || '')
  const [customLocation, setCustomLocation] = useState(
    Boolean(existing?.location && !(DEADLINE_LOCATION_PRESETS as readonly string[]).includes(existing.location))
  )
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

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]))
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!title.trim()) {
      setFormError('Give the deadline a title to continue.')
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
      location: location.trim() || null,
      trade,
      detail: detail.trim() || null,
      start: hasStart ? dateFromDayKey(start) : null,
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
          {formError ? <p className="mb-2 text-xs font-semibold text-[var(--red)]">{formError}</p> : null}
          <button type="button" className="btn primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add deadline'}
          </button>
        </div>
      }
    >
      <form id="deadline-editor" className="space-y-5" onSubmit={submit}>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">WHAT IS DUE</h3>
          <div className="card space-y-3 p-4">
            <input className="pp-in w-full" placeholder="e.g. 3rd Floor WC 1st Fix" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="pp-in w-full" rows={3} placeholder="Scope detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">WHERE</h3>
          <div className="chips">
            <button
              type="button"
              className={`chip ${customLocation ? 'on' : ''}`}
              onClick={() => {
                if (!customLocation && (DEADLINE_LOCATION_PRESETS as readonly string[]).includes(location)) setLocation('')
                setCustomLocation(true)
              }}
            >
              Custom
            </button>
            {DEADLINE_LOCATION_PRESETS.map((area) => (
              <button
                key={area}
                type="button"
                className={`chip ${!customLocation && location === area ? 'on' : ''}`}
                onClick={() => {
                  setCustomLocation(false)
                  setLocation(area)
                }}
              >
                {area}
              </button>
            ))}
          </div>
          {customLocation ? (
            <input className="pp-in mt-2 w-full" placeholder="Type floor or area" value={location} onChange={(e) => setLocation(e.target.value)} />
          ) : null}
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">WHEN</h3>
          <div className="card space-y-3 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Has a start date
              <input type="checkbox" checked={hasStart} onChange={(e) => setHasStart(e.target.checked)} />
            </label>
            <p className="text-xs text-[var(--ink3)]">Needed for pace tracking and the timeline</p>
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
            <h3 className="text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">WHO</h3>
            {live.length > 0 ? (
              <button
                type="button"
                className="ml-auto text-xs font-bold text-[var(--hs)]"
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
            <p className="card pad text-sm text-[var(--ink3)]">No people available to assign yet.</p>
          ) : (
            <>
              {live.length > 0 ? (
                <>
                  <p className="mb-1 text-[11.5px] font-bold text-[var(--ink3)]">Booked or tasked on this job</p>
                  <PeopleList people={live} selected={selected} onToggle={toggle} />
                </>
              ) : null}
              {people.some((person) => !person.isLive) ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11.5px] font-bold text-[var(--ink3)]">Add extra people</p>
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
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">ATTACH</h3>
          <div className="card space-y-3 p-4">
            <label className="block text-sm font-semibold">
              File
              <input className="mt-1 block w-full text-sm" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="mt-1 block text-xs font-medium text-[var(--ink3)]">{file?.name || existing?.fileName || 'None — tap to upload'}</span>
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
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">PRIORITY AND REMINDERS</h3>
          <div className="card space-y-3 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>
                On the critical path
                <span className="mt-0.5 block text-xs font-medium text-[var(--ink3)]">Slipping this pushes the whole programme</span>
              </span>
              <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>
                Remind me
                <span className="mt-0.5 block text-xs font-medium text-[var(--ink3)]">Two days before, and again on the day</span>
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
  const next = dateFromDayKey(date)
  const movedDays = daysRemaining({ due: next }, item.due)
  const reason = [picked, detail.trim() || null].filter(Boolean).join(' — ')
  const canSave = movedDays !== 0 && reason.length > 0
  const knockOn = dependents(items, item)
  return (
    <Sheet
      title="Reschedule"
      subtitle={item.title}
      onClose={onClose}
      footer={
        <div>
          {!canSave ? (
            <p className="mb-2 text-xs text-[var(--ink3)]">{movedDays === 0 ? 'Pick a different date to continue' : 'Choose a reason to continue'}</p>
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
            <p className="text-[10px] font-bold tracking-wide text-[var(--ink3)]">CURRENTLY</p>
            <p className="text-lg font-extrabold">{formatDay(item.due)}</p>
            <p className="text-[11px] text-[var(--ink3)]">{formatWeekCommencing(item.due)}</p>
          </div>
          <span className="text-[var(--ink3)]">→</span>
          <div>
            <p className="text-[10px] font-bold tracking-wide text-[var(--ink3)]">MOVING TO</p>
            <p className={`text-lg font-extrabold ${movedDays > 0 ? 'text-[var(--red)]' : movedDays < 0 ? 'text-[var(--green)]' : ''}`}>{formatDay(next)}</p>
            <p className="text-[11px] text-[var(--ink3)]">{formatWeekCommencing(next)}</p>
          </div>
        </div>
        {movedDays !== 0 ? (
          <p className={`text-[12.5px] font-bold ${movedDays > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
            {movedDays > 0
              ? `Pushing back ${movedDays} day${movedDays === 1 ? '' : 's'}`
              : `Pulling forward ${-movedDays} day${movedDays === -1 ? '' : 's'}`}
          </p>
        ) : null}
        <input className="pp-in w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {knockOn.length > 0 && movedDays > 0 ? (
          <div className="rounded-[14px] bg-[var(--leave-t)] p-3 text-sm">
            <p className="font-bold">
              {knockOn.length} deadline{knockOn.length === 1 ? '' : 's'} depend{knockOn.length === 1 ? 's' : ''} on this
            </p>
            {knockOn.map((dep) => (
              <p key={dep.id} className="text-[var(--ink2)]">
                · {dep.title} — currently due {formatDay(dep.due)}
              </p>
            ))}
            <p className="mt-1 text-[11.5px] text-[var(--ink3)]">They are not moved automatically. Review them after saving.</p>
          </div>
        ) : null}
        <section>
          <h3 className="mb-2 text-[11px] font-bold tracking-[0.08em] text-[var(--ink3)]">REASON — REQUIRED</h3>
          <div className="chips">
            {DEADLINE_RESCHEDULE_REASONS.map((reasonChip) => (
              <button
                key={reasonChip}
                type="button"
                className={`chip ${picked === reasonChip ? 'on' : ''}`}
                onClick={() => setPicked(picked === reasonChip ? null : reasonChip)}
              >
                {reasonChip}
              </button>
            ))}
          </div>
          <textarea className="pp-in mt-2 w-full" rows={3} placeholder="Add detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        </section>
      </div>
    </Sheet>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOrganizationCurrency, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import {
  VARIATION_LIST_FILTERS,
  parentDisplayName,
  TRACKER_ADDED_DESCRIPTION,
  variationMatchesListFilter,
  type Variation,
  type VariationListFilter,
  type VariationStatus,
  type VariationTracker,
} from '@/lib/variations/variationModel'
import { assignedManagerIds, canSeeVariationCostsFor, canUseVariationTracker } from '@/lib/variations/variationAccess'
import {
  VariationsChangedError,
  applyVariationOrder,
  createVariation,
  disableTracker,
  enableTracker,
  setTrackerOrderLock,
  setVariationStatus,
  softDeleteVariation,
  subscribeParentVariations,
  subscribeVariationTracker,
  updateVariation,
  variationCopyWarning,
  variationRecipientIds,
} from '@/lib/variations/variationStorage'
import {
  VARIATION_PINNED_MESSAGE,
  formatMoney,
  variationDateText,
  variationIsPinned,
  variationListTotals,
  variationPreviousNumbers,
  variationRenumberPlan,
  variationTotals,
} from '@/lib/canonical'
import type { Project } from '@/types'

const NOTES = [
  'Every variation on the job is here, in its current order. Turning the tracker on renumbered nothing.',
  'Drag an open variation to change the order. The numbers update as you drag and are saved when you drop.',
  'Submitted and closed variations are pinned. The client has seen those numbers, so they keep them and cannot be moved. They can still be removed.',
  'Every renumber is recorded on the variation ("was VO-003") and shows in the Excel export.',
  'A number is never reused: a removed variation retires its number, and the others do not close the gap.',
  "Add what site doesn't know about. It shows up in their app as open, with no hours, ready to be filled in.",
]

const STATUS_HUE: Record<VariationStatus, string> = { open: 'warn', submitted: 'green', closed: 'lib' }

function personName(user: { firstName?: string; surname?: string; email?: string } | null | undefined): string {
  if (!user) return 'Someone'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Someone'
}

/**
 * The VO tracker (rulebook 1.52.0, owner decisions 15 Nov): a full-screen register for one job. Admins and the job's
 * managers (`canRenumberVariations`) drag open variations into a new order; the numbers follow live
 * (`variationRenumberPlan`, the same plan the save uses) and are written on drop in one transaction that refuses when
 * the variations changed meanwhile (`variationRenumberConflict`). Submitted and Closed are pinned. Heading, status and
 * description are edited in place; line items open the variation editor.
 */
export function VariationTrackerScreen({
  project,
  parentType,
}: {
  project: Project
  parentType: 'project' | 'smallWork'
}) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { managers, loadManagers } = useOperativeStore()
  const timeZone = useOrganizationTimeZone()
  const currency = useOrganizationCurrency()
  const [rows, setRows] = useState<Variation[]>([])
  const [tracker, setTracker] = useState<VariationTracker | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [filter, setFilter] = useState<VariationListFilter>('all')
  const [heading, setHeading] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null)
  const [busy, setBusy] = useState(false)
  const baseRows = useRef<Variation[] | null>(null)
  const dragging = useRef<string | null>(null)
  const allowed = canUseVariationTracker(user, project, managers)
  const showCost = canSeeVariationCostsFor(user)
  const base = parentType === 'smallWork' ? `/dashboard/small-works/${project.id}/variations` : `/dashboard/projects/${project.id}/variations`
  const actor = user ? { uid: user.id, name: personName(user) } : null

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadManagers(organization.id)
  }, [organization?.id, loadUsers, loadManagers])

  useEffect(() => {
    if (!allowed || !organization?.id) return
    const unsubRows = subscribeParentVariations(organization.id, project.id, setRows)
    const unsubTracker = subscribeVariationTracker(organization.id, project.id, setTracker)
    return () => {
      unsubRows()
      unsubTracker()
    }
  }, [allowed, organization?.id, project.id])

  const live = useMemo(() => rows.filter((row) => !row.isDeleted), [rows])
  const storedOrder = useMemo(
    () => [...live].sort((a, b) => a.sequence - b.sequence || a.createdAt.getTime() - b.createdAt.getTime()).map((row) => row.id),
    [live]
  )
  const byId = useMemo(() => new Map(live.map((row) => [row.id, row])), [live])
  // The order on screen is the OPEN variations only: pinned ones keep their places (`variationRenumberPlan`).
  const openIds = order || storedOrder.filter((id) => !variationIsPinned(byId.get(id) ?? {}))
  // Rulebook 1.52.0 `variationRenumberPlan`: every stored variation of the job (deleted included, so their numbers
  // are never handed out again) and the open order on screen.
  const plan = useMemo(
    () => variationRenumberPlan({ rows, order: openIds, prefix: tracker?.prefix, padding: tracker?.padding }),
    [rows, openIds, tracker?.prefix, tracker?.padding]
  )
  const planById = useMemo(() => new Map(plan.rows.map((row) => [row.id, row])), [plan])
  const ordered = plan.rows.map((row) => byId.get(row.id)).filter((row): row is Variation => Boolean(row))
  const visible = ordered.filter((row) => variationMatchesListFilter(row.status, filter))
  const totals = variationListTotals(visible)
  const orderLocked = Boolean(tracker?.orderLocked)
  const canDrag = Boolean(tracker?.enabled) && !orderLocked && filter === 'all' && !busy

  if (!allowed) {
    return (
      <div className="empty card pad">
        <h3>VO tracker</h3>
        <p>The tracker is for admins and the managers of this job.</p>
        <Link href={base} className="btn sm">Back to variations</Link>
      </div>
    )
  }

  // Moves an open variation to the place of another open one; a pinned row is never a target and never moves.
  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const current = [...openIds]
    const from = current.indexOf(fromId)
    const to = current.indexOf(toId)
    if (from < 0 || to < 0) return
    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    setOrder(current)
  }

  const save = async (nextOrder: string[]) => {
    if (!organization?.id || !actor || !tracker) return
    const snapshot = baseRows.current ?? rows
    setBusy(true)
    try {
      const result = await applyVariationOrder({
        organizationId: organization.id,
        parentId: project.id,
        order: nextOrder,
        baseRows: snapshot,
        tracker,
        actor,
        // `receivesJobNotification` for this job's managers, then `excludeActor`.
        notifyUserIds: variationRecipientIds(users, actor.uid, assignedManagerIds(project)),
      })
      setMessage(
        result.changed.length === 0
          ? { text: 'Order saved. No numbers changed.', tone: 'ok' }
          : {
              text: `Saved: ${result.changed.map((row) => `${row.from} → ${row.to}`).join(', ')}.${result.copiesFailed.length ? ' The copy older iPhone builds read did not all update — save again.' : ''}`,
              tone: result.copiesFailed.length ? 'warn' : 'ok',
            }
      )
    } catch (error) {
      console.error('[variations] tracker save failed', error)
      setMessage({
        text: error instanceof VariationsChangedError ? error.message : error instanceof Error ? `Nothing was renumbered: ${error.message}` : 'Nothing was renumbered.',
        tone: 'warn',
      })
    } finally {
      setOrder(null)
      baseRows.current = null
      setBusy(false)
    }
  }

  // ↑ / ↓: swap with the next open variation (pinned rows keep their places).
  const moveBy = (id: string, delta: number) => {
    const current = [...openIds]
    const from = current.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= current.length) return
    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    baseRows.current = rows
    void save(current)
  }

  const patch = async (row: Variation, changes: Partial<Pick<Variation, 'heading' | 'description'>>) => {
    if (!organization?.id || !user) return
    const next = { ...row, ...changes }
    if (next.heading === row.heading && next.description === row.description) return
    try {
      // Only the field edited here is written (`base` = the row as shown).
      const outcome = await updateVariation({ organizationId: organization.id, variation: next, actorUid: user.id, base: row })
      const warning = variationCopyWarning(outcome)
      setMessage({ text: warning || `${row.voNumber} saved.`, tone: warning ? 'warn' : 'ok' })
    } catch (error) {
      console.error('[variations] tracker edit failed', error)
      setMessage({ text: error instanceof Error ? error.message : 'Could not save.', tone: 'warn' })
    }
  }

  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-[var(--bg)]" role="region" aria-label="VO tracker">
      <div className="stack" style={{ gap: 16, padding: '16px clamp(12px, 3vw, 32px) 40px', maxWidth: 1600, margin: '0 auto' }}>
        <section className="hero" data-hue="lib" style={{ padding: '20px 24px' }}>
          <div className="relative z-[1]">
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={base} className="btn sm hbtn">← Back to variations</Link>
              <span className="grow" />
              <label className="row small" style={{ gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={Boolean(tracker?.enabled)}
                  disabled={busy}
                  onChange={async (event) => {
                    if (!organization?.id || !user) return
                    if (event.target.checked) {
                      if (!window.confirm('Every existing variation will be pulled in, in its current order. Nothing will be renumbered.')) return
                      setBusy(true)
                      try {
                        await enableTracker({ organizationId: organization.id, parentId: project.id, parentType, actorUid: user.id })
                      } catch (error) {
                        setMessage({ text: error instanceof Error ? error.message : 'The tracker could not be turned on.', tone: 'warn' })
                      } finally {
                        setBusy(false)
                      }
                      return
                    }
                    await disableTracker(organization.id, project.id).catch((error: Error) => setMessage({ text: error.message, tone: 'warn' }))
                  }}
                />
                Tracker on
              </label>
              <label className="row small" style={{ gap: 8, alignItems: 'center' }} title="Stops every move and renumber on this job, for everyone, until unlocked">
                <input
                  type="checkbox"
                  checked={orderLocked}
                  disabled={busy || !tracker?.enabled}
                  onChange={async (event) => {
                    if (!organization?.id || !actor) return
                    setBusy(true)
                    try {
                      await setTrackerOrderLock({ organizationId: organization.id, parentId: project.id, parentType, locked: event.target.checked, actor })
                    } catch (error) {
                      setMessage({ text: error instanceof Error ? error.message : 'The lock could not be changed.', tone: 'warn' })
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
                Lock order
              </label>
            </div>
            <h1 className="big" style={{ fontSize: 30, marginTop: 10 }}>VO tracker</h1>
            <p style={{ opacity: 0.9 }}>{parentDisplayName(project.jobNumber, project.siteName)}</p>
            <div className="stats" aria-label="Totals">
              <div className="st"><b>{totals.count}</b><span>Variations</span></div>
              <div className="st"><b>{Math.round(totals.labourHours * 100) / 100}h</b><span>Labour hours</span></div>
              {showCost ? <div className="st"><b>{formatMoney(totals.costTotal, currency)}</b><span>Total cost</span></div> : null}
            </div>
          </div>
        </section>

        {!tracker?.enabled ? (
          <div className="empty card pad">
            <h3>Tracker is off</h3>
            <p>Variations keep the number they were given when raised. Turn the tracker on to reorder them. The rest of the app carries on unchanged.</p>
          </div>
        ) : null}

        {orderLocked ? (
          <div className="banner" data-hue="warn" role="status">
            <div className="grow small">
              Order locked by {tracker?.orderLockedByName || 'someone'}
              {tracker?.orderLockedAt ? ` on ${variationDateText(tracker.orderLockedAt.getTime(), timeZone)}` : ''}. Nobody can move or renumber a
              variation until it is unlocked. Editing, status changes and removal still work.
            </div>
          </div>
        ) : null}

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg" role="tablist" aria-label="Filter by status">
            {VARIATION_LIST_FILTERS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'on' : ''} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {!tracker?.enabled
              ? ''
              : filter !== 'all'
                ? 'Show All to drag.'
                : orderLocked
                  ? 'Order locked.'
                  : busy
                    ? 'Saving…'
                    : 'Drag open variations, or use ↑ ↓. Saved on drop.'}
          </span>
        </div>

        {message ? (
          <p role="status" className="small" style={{ margin: 0, color: message.tone === 'warn' ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
            {message.text}
            {message.tone === 'warn' ? (
              <button type="button" className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => window.location.reload()}>Reload</button>
            ) : null}
          </p>
        ) : null}

        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink3)', fontSize: 12 }}>
                <th style={{ padding: '10px 8px', width: 64 }} aria-label="Move" />
                <th style={{ padding: '10px 8px', width: 130 }}>VO</th>
                <th style={{ padding: '10px 8px' }}>Heading and description</th>
                <th style={{ padding: '10px 8px', width: 130 }}>Status</th>
                <th style={{ padding: '10px 8px', width: 70, textAlign: 'right' }}>Hours</th>
                <th style={{ padding: '10px 8px', width: 120 }}>Items</th>
                {showCost ? <th style={{ padding: '10px 8px', width: 110, textAlign: 'right' }}>Cost</th> : null}
                <th style={{ padding: '10px 8px', width: 150 }}>Raised</th>
                <th style={{ padding: '10px 8px', width: 150 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const step = planById.get(row.id)
                const pinned = variationIsPinned(row)
                const t = variationTotals(row)
                const previous = variationPreviousNumbers(row)
                const draggable = canDrag && !pinned
                return (
                  <tr
                    key={row.id}
                    draggable={draggable}
                    onDragStart={(event) => {
                      if (!draggable) return
                      baseRows.current = rows
                      dragging.current = row.id
                      setDragId(row.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(event) => {
                      if (!dragId || !canDrag) return
                      event.preventDefault()
                      if (!pinned) move(dragId, row.id)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (!dragging.current) return
                      dragging.current = null
                      setDragId(null)
                      void save(openIds)
                    }}
                    onDragEnd={() => {
                      // Dropped outside a row: the order on screen is still saved (the numbers already showed it).
                      if (!dragging.current) return
                      dragging.current = null
                      setDragId(null)
                      if (order) void save(order)
                    }}
                    style={{
                      borderTop: '1px solid var(--line)',
                      background: dragId === row.id ? 'var(--blue-t)' : pinned ? 'var(--soft)' : undefined,
                      opacity: dragId && dragId !== row.id ? 0.92 : 1,
                    }}
                  >
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      {pinned ? (
                        <span title={VARIATION_PINNED_MESSAGE} aria-label="Pinned" className="muted">📌</span>
                      ) : (
                        <span className="row" style={{ gap: 2 }}>
                          <span aria-hidden style={{ cursor: draggable ? 'grab' : 'default', color: 'var(--ink3)', fontSize: 18 }}>⋮⋮</span>
                          <button type="button" className="btn sm ghost" style={{ padding: '0 6px' }} disabled={!canDrag || openIds.indexOf(row.id) <= 0} aria-label={`Move ${row.voNumber} up`} onClick={() => moveBy(row.id, -1)}>↑</button>
                          <button type="button" className="btn sm ghost" style={{ padding: '0 6px' }} disabled={!canDrag || openIds.indexOf(row.id) === openIds.length - 1} aria-label={`Move ${row.voNumber} down`} onClick={() => moveBy(row.id, 1)}>↓</button>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      <b className="tabular-nums">{step?.changed ? <s style={{ opacity: 0.6 }}>{row.voNumber}</s> : row.voNumber}</b>
                      {step?.changed ? <b className="tabular-nums" style={{ display: 'block', color: 'var(--warn)' }}>→ {step.to}</b> : null}
                      {previous.length ? <span className="xs muted" style={{ display: 'block' }}>was {previous.join(', ')}</span> : null}
                    </td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      <InlineText
                        label={`Heading of ${row.voNumber}`}
                        value={row.heading}
                        onSave={(value) => (value.trim() ? patch(row, { heading: value.trim() }) : Promise.resolve())}
                        bold
                      />
                      <InlineText label={`Description of ${row.voNumber}`} value={row.description} multiline onSave={(value) => patch(row, { description: value.trim() })} />
                    </td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      <select
                        className="input"
                        aria-label={`Status of ${row.voNumber}`}
                        value={row.status}
                        data-hue={STATUS_HUE[row.status]}
                        onChange={async (event) => {
                          if (!organization?.id || !actor) return
                          const status = event.target.value as VariationStatus
                          if (status === 'submitted' && !window.confirm('This variation has gone to the client. Its number will be pinned.')) return
                          try {
                            await setVariationStatus({ organizationId: organization.id, variation: row, status, actor })
                          } catch (error) {
                            setMessage({ text: error instanceof Error ? error.message : 'Could not change the status.', tone: 'warn' })
                          }
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="submitted">Submitted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'right' }}>{Math.round(t.labourHours * 100) / 100}</td>
                    <td className="xs" style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      {t.materialsCount} mat · {t.customCount} custom · {t.subcontractorCount} sub
                      <span style={{ display: 'block' }}>📎 {t.evidenceCount}</span>
                    </td>
                    {showCost ? (
                      <td className="tabular-nums" style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'right' }}>{formatMoney(t.costTotal, currency)}</td>
                    ) : null}
                    <td className="xs" style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      {row.createdByName}
                      <span style={{ display: 'block' }}>{variationDateText(row.createdAt.getTime(), timeZone)}</span>
                    </td>
                    <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                      <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <Link href={`${base}?edit=${encodeURIComponent(row.id)}`} className="btn sm ghost">Edit items</Link>
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={async () => {
                            if (!organization?.id || !user) return
                            if (!window.confirm(`Remove ${row.voNumber}? Its number is retired and never reused; the other numbers stay as they are.`)) return
                            try {
                              const warning = variationCopyWarning(await softDeleteVariation(organization.id, row, user.id))
                              setMessage({ text: warning || `${row.voNumber} removed.`, tone: warning ? 'warn' : 'ok' })
                            } catch (error) {
                              setMessage({ text: error instanceof Error ? error.message : 'Could not remove it.', tone: 'warn' })
                            }
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={showCost ? 9 : 8} style={{ padding: 20 }} className="muted">No variations.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="grid g2" style={{ alignItems: 'start' }}>
          <form
            className="card pad row"
            style={{ gap: 8, flexWrap: 'wrap' }}
            onSubmit={async (event) => {
              event.preventDefault()
              if (!organization?.id || !actor || !heading.trim()) return
              setBusy(true)
              try {
                const created = await createVariation({
                  organizationId: organization.id,
                  parentType,
                  parentId: project.id,
                  parentName: parentDisplayName(project.jobNumber, project.siteName),
                  origin: 'tracker',
                  heading: heading.trim(),
                  description: TRACKER_ADDED_DESCRIPTION,
                  status: 'open' as VariationStatus,
                  labour: [],
                  materials: [],
                  evidence: [],
                  actor,
                  users,
                  managerIds: assignedManagerIds(project),
                  existingRows: rows,
                  tracker: tracker ?? undefined,
                })
                setHeading('')
                const warning = variationCopyWarning(created.saveOutcome)
                setMessage({ text: warning || `${created.voNumber} added.`, tone: warning ? 'warn' : 'ok' })
              } catch (error) {
                setMessage({ text: error instanceof Error ? error.message : 'Could not add it.', tone: 'warn' })
              } finally {
                setBusy(false)
              }
            }}
          >
            <b>Add to tracker</b>
            <input className="input grow" placeholder="Heading" aria-label="Heading of the new variation" value={heading} onChange={(event) => setHeading(event.target.value)} />
            <button type="submit" className="btn sm primary" disabled={busy || !heading.trim()}>Add</button>
          </form>
          <aside className="card pad">
            <h2 className="h2">How the tracker works</h2>
            <ol className="mt-2 space-y-2 small">
              {NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  )
}

function InlineText({
  label,
  value,
  onSave,
  multiline,
  bold,
}: {
  label: string
  value: string
  onSave: (value: string) => Promise<void>
  multiline?: boolean
  bold?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) void onSave(draft)
  }
  const style = {
    width: '100%',
    border: '1px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    padding: '4px 6px',
    fontWeight: bold ? 700 : 400,
    color: bold ? 'var(--ink)' : 'var(--ink2)',
    resize: 'vertical' as const,
  }
  return multiline ? (
    <textarea aria-label={label} value={draft} rows={2} placeholder="Add a description" onChange={(event) => setDraft(event.target.value)} onBlur={commit} style={style} className="focus:border-[var(--line2)]" />
  ) : (
    <input
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        if (event.key === 'Escape') setDraft(value)
      }}
      style={style}
      className="focus:border-[var(--line2)]"
    />
  )
}

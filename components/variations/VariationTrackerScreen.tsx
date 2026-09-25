'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { hasAdminAccess } from '@/lib/permissions'
import { parentDisplayName, TRACKER_ADDED_DESCRIPTION, type Variation, type VariationStatus, type VariationTracker } from '@/lib/variations/variationModel'
import { previewRenumber } from '@/lib/variations/variationNumbering'
import { assignedManagerIds, canManageVariationTracker } from '@/lib/variations/variationAccess'
import {
  TrackerVersionError,
  applyNumbering,
  claimTrackerLock,
  createVariation,
  disableTracker,
  enableTracker,
  loadVariationTracker,
  releaseTrackerLock,
  setTrackerMode,
  subscribeParentVariations,
  subscribeVariationTracker,
  trackerLockActive,
} from '@/lib/variations/variationStorage'
import type { Project } from '@/types'

const NOTES = [
  'Everything from the app is already here. Turning the tracker on pulled in every existing variation in its current order. Nothing was renumbered.',
  'Drag to change the order. Numbers follow position, so moving one variation renumbers the ones below it.',
  'Submitted and closed stay put. The client has already seen those numbers, so they keep them and act as anchors. Everything else flows around them.',
  "Add what site doesn't know about. Anything you add here shows up in their app as open, with no hours, ready to be filled in.",
  "Nothing changes until you apply. You'll see every old and new number before a single one moves.",
  'Numbers are never reused. Closing a variation retires its number for good.',
]

export function VariationTrackerScreen({
  project,
  parentType,
}: {
  project: Project
  parentType: 'project' | 'smallWork'
}) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const [rows, setRows] = useState<Variation[]>([])
  const [tracker, setTracker] = useState<VariationTracker | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const [mode, setMode] = useState<'lockSubmitted' | 'resequenceAll'>('lockSubmitted')
  const [dragId, setDragId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [heading, setHeading] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const allowed = canManageVariationTracker(user)
  const base = parentType === 'smallWork' ? `/dashboard/small-works/${project.id}/variations` : `/dashboard/projects/${project.id}/variations`

  useEffect(() => {
    if (!allowed || !organization?.id) return
    loadUsers(organization.id)
    const unsubRows = subscribeParentVariations(organization.id, project.id, setRows)
    const unsubTracker = subscribeVariationTracker(organization.id, project.id, (next) => {
      setTracker(next)
      setMode(next.numberingMode)
    })
    return () => {
      unsubRows()
      unsubTracker()
      if (user?.id) void releaseTrackerLock(organization.id, project.id, user.id)
    }
  }, [allowed, organization?.id, project.id, loadUsers, user?.id])

  const live = useMemo(() => rows.filter((row) => !row.isDeleted), [rows])
  const visual = useMemo(() => {
    const byId = new Map(live.map((row) => [row.id, row]))
    const ids = order || [...live].sort((a, b) => a.sequence - b.sequence || a.createdAt.getTime() - b.createdAt.getTime()).map((row) => row.id)
    return ids.map((id) => byId.get(id)).filter((row): row is Variation => Boolean(row))
  }, [live, order])
  const preview = previewRenumber(visual, mode, tracker?.prefix || 'VO-', tracker?.padding || 3)
  const changes = preview.filter((row) => row.changed)
  const lockedByOther =
    tracker && user && trackerLockActive(tracker) && tracker.lockedByUid && tracker.lockedByUid !== user.id
      ? tracker
      : null
  const readOnly = Boolean(lockedByOther)

  const move = (targetId: string) => {
    if (!dragId || dragId === targetId || readOnly) return
    const ids = visual.map((row) => row.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setOrder(next)
  }

  if (!allowed) {
    return (
      <div className="empty card pad">
        <h3>Variation tracker</h3>
        <p>Only an admin can reorder variation numbers.</p>
        <Link href={base} className="btn sm">Back to variations</Link>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="hero" data-hue="lib" style={{ padding: '22px 24px' }}>
        <div className="relative z-[1]">
          <h1 className="big" style={{ fontSize: 32 }}>Variation tracker</h1>
          <p style={{ opacity: 0.9, marginTop: 6 }}>{parentDisplayName(project.jobNumber, project.siteName)}</p>
          <p style={{ opacity: 0.85, maxWidth: 680 }}>
            The register for this job. Numbers stay where they were given until you turn the tracker on and apply a new order.
          </p>
          <label className="row mt-3" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(tracker?.enabled)}
              onChange={async (event) => {
                if (!organization?.id || !user) return
                if (event.target.checked) {
                  const ok = window.confirm(
                    'Every existing variation will be pulled in, in its current order. Nothing will be renumbered.'
                  )
                  if (!ok) return
                  setBusy(true)
                  await enableTracker({
                    organizationId: organization.id,
                    parentId: project.id,
                    parentType,
                    actorUid: user.id,
                  })
                  setOrder(null)
                  setBusy(false)
                  return
                }
                await disableTracker(organization.id, project.id)
                setOrder(null)
              }}
            />
            Tracker on for this job
          </label>
        </div>
      </section>
      {!tracker?.enabled ? (
        <div className="empty card pad">
          <h3>Tracker is off</h3>
          <p>Variations keep the number they were given when raised. Nothing on this job can be reordered. The rest of the app carries on unchanged.</p>
        </div>
      ) : (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="stack" style={{ gap: 10 }}>
            {lockedByOther ? (
              <div className="banner" data-hue="warn">
                <div className="grow small">
                  {lockedByOther.lockedByName || 'Someone'} is editing this tracker.
                  {trackerLockActive(lockedByOther) ? ' You can take over after the lock expires.' : null}
                </div>
                {!trackerLockActive(lockedByOther) && organization?.id && user ? (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() =>
                      void claimTrackerLock({
                        organizationId: organization.id,
                        parentId: project.id,
                        parentType,
                        actor: { uid: user.id, name: `${user.firstName} ${user.surname}`.trim() },
                      }).catch((error: Error) => setMessage(error.message))
                    }
                  >
                    Take over
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="seg">
                <button
                  type="button"
                  className={mode === 'lockSubmitted' ? 'on' : ''}
                  onClick={() => {
                    setMode('lockSubmitted')
                    if (organization?.id) void setTrackerMode(organization.id, project.id, 'lockSubmitted')
                  }}
                >
                  Lock submitted and closed
                </button>
                <button
                  type="button"
                  className={mode === 'resequenceAll' ? 'on' : ''}
                  onClick={() => {
                    setMode('resequenceAll')
                    if (organization?.id) void setTrackerMode(organization.id, project.id, 'resequenceAll')
                  }}
                >
                  Renumber everything
                </button>
              </div>
              <span className="muted small">{changes.length} number{changes.length === 1 ? '' : 's'} will change</span>
              <button type="button" className="btn sm ghost" onClick={() => setOrder(null)}>Discard</button>
              <button
                type="button"
                className="btn sm primary"
                disabled={changes.length === 0 || readOnly}
                onClick={async () => {
                  if (!organization?.id || !user) return
                  try {
                    await claimTrackerLock({
                      organizationId: organization.id,
                      parentId: project.id,
                      parentType,
                      actor: { uid: user.id, name: `${user.firstName} ${user.surname}`.trim() },
                    })
                    setConfirming(true)
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Could not lock the tracker.')
                  }
                }}
              >
                Review and apply
              </button>
            </div>
            <div className="rows">
              {visual.map((row) => {
                const next = preview.find((item) => item.id === row.id)
                const anchored = mode === 'lockSubmitted' && (row.status === 'submitted' || row.status === 'closed')
                return (
                  <div
                    key={row.id}
                    className="ritem"
                    draggable={!readOnly && !anchored}
                    onDragStart={() => setDragId(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => move(row.id)}
                    style={{ opacity: anchored ? 0.74 : 1 }}
                  >
                    <span className="muted">{anchored ? 'Lock' : 'Drag'}</span>
                    <span className="grow">
                      <span className="t">
                        {row.voNumber}
                        {next?.changed ? <span style={{ color: '#C98400' }}> → {next.to}</span> : null}
                        {' · '}
                        {row.heading}
                      </span>
                      <span className="s">{row.origin} · {row.totalLabourHours.toFixed(1)} hrs · {row.materialLineCount} materials</span>
                    </span>
                    <span className="pill">{row.status}</span>
                  </div>
                )
              })}
            </div>
            <form
              className="card pad row"
              style={{ gap: 8, flexWrap: 'wrap' }}
              onSubmit={async (event) => {
                event.preventDefault()
                if (!organization?.id || !user || !heading.trim()) return
                setBusy(true)
                await createVariation({
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
                  actor: { uid: user.id, name: `${user.firstName} ${user.surname}`.trim() },
                  users,
                  managerIds: assignedManagerIds(project),
                })
                setHeading('')
                setOrder(null)
                setBusy(false)
              }}
            >
              <b>Add to tracker</b>
              <input className="input grow" placeholder="Heading" value={heading} onChange={(event) => setHeading(event.target.value)} />
              <button type="submit" className="btn sm primary" disabled={busy || !heading.trim()}>Add</button>
            </form>
            {message ? <p className="muted">{message}</p> : null}
          </div>
          <aside className="card pad" style={{ position: 'sticky', top: 12 }}>
            <h2 className="h2">How the tracker works</h2>
            <ol className="mt-2 space-y-2">
              {NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ol>
            <p className="mt-3">
              <b>Renumber everything</b> ignores the locks and renumbers the whole list top to bottom. Only use it before anything has gone to the client.
            </p>
          </aside>
        </div>
      )}
      {confirming && tracker ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card stack max-w-lg" style={{ gap: 10, padding: 18 }}>
            <h2 className="h2">Review and apply</h2>
            {changes.map((row) => {
              const source = visual.find((item) => item.id === row.id)
              return (
                <p key={row.id}>
                  {row.from} → {row.to} · {source?.heading}
                </p>
              )
            })}
            {mode === 'resequenceAll' && changes.some((row) => row.status === 'submitted' || row.status === 'closed') ? (
              <p style={{ color: 'var(--red, #D3453F)' }}>
                This will renumber a variation that has already been submitted or closed. The client may already have that number.
              </p>
            ) : null}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn sm ghost" onClick={() => setConfirming(false)}>Cancel</button>
              <button
                type="button"
                className="btn sm primary"
                disabled={busy}
                onClick={async () => {
                  if (!organization?.id || !user) return
                  setBusy(true)
                  const fresh = await loadVariationTracker(organization.id, project.id)
                  try {
                    await applyNumbering({
                      organizationId: organization.id,
                      parentId: project.id,
                      expectedVersion: fresh.version,
                      actor: { uid: user.id, name: `${user.firstName} ${user.surname}`.trim() },
                      rows: visual,
                      notifyUserIds: users
                        .filter((person) => hasAdminAccess(person) || assignedManagerIds(project).includes(person.id))
                        .map((person) => person.id)
                        .filter((id) => id !== user.id),
                      changes: preview.map((row, index) => ({ id: row.id, to: row.to, sequence: index + 1 })),
                    })
                    setOrder(null)
                    setConfirming(false)
                    setMessage('Numbers updated.')
                  } catch (error) {
                    if (error instanceof TrackerVersionError) {
                      setOrder(null)
                      setMessage(error.message)
                    } else {
                      setMessage(error instanceof Error ? error.message : 'Apply failed. Nothing was renumbered.')
                    }
                    setConfirming(false)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

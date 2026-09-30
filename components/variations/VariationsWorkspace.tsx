'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useToast } from '@/components/ui/ToastProvider'
import { uploadFile } from '@/lib/firebase/storageUtils'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  EVIDENCE_MAX_FILES,
  VARIATION_HEADER_COPY,
  VARIATION_STATUS_COPY,
  VARIATION_TRADES,
  evidenceFileAllowed,
  parentDisplayName,
  type Variation,
  type VariationEvidence,
  type VariationLabourLine,
  type VariationMaterialLine,
  type VariationStatus,
  type VariationTracker,
} from '@/lib/variations/variationModel'
import { nextFreeVoNumber, voNumberTaken } from '@/lib/variations/variationNumbering'
import {
  lineHours,
  NewVariationSheet,
  type LabourLine,
  type MaterialLine,
  type Unit,
} from '@/components/variations/NewVariationSheet'
import { canChangeVariationStatus, canEditVariationContent, canManageVariationTracker, canSeeJobVariations } from '@/lib/variations/variationAccess'
import { variationsToCsv } from '@/lib/variations/variationCsv'
import {
  createVariation,
  loadCustomTrades,
  loadVariationTracker,
  saveCustomTrade,
  setVariationStatus,
  removeEvidenceObject,
  softDeleteVariation,
  subscribeParentVariations,
  subscribeVariationTracker,
  updateVariation,
} from '@/lib/variations/variationStorage'
import type { Project } from '@/types'

type Filter = 'all' | VariationStatus

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'closed', label: 'Closed' },
]

function displayUser(user: { firstName?: string; surname?: string; email?: string } | null): string {
  if (!user) return 'Someone'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Someone'
}

function formatWhen(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VariationsWorkspace({
  project,
  parentType,
}: {
  project: Project
  parentType: 'project' | 'smallWork'
}) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const toast = useToast()
  const [rows, setRows] = useState<Variation[]>([])
  const [tracker, setTracker] = useState<VariationTracker | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Variation | null | 'new'>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [trades, setTrades] = useState<string[]>([])

  const parentName = parentDisplayName(project.jobNumber, project.siteName)
  const canEdit = canEditVariationContent(user, project)
  const canStatus = canChangeVariationStatus(user, project)
  const canTrack = canManageVariationTracker(user)
  const base = parentType === 'smallWork' ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`

  const allowed = canSeeJobVariations(user, project)

  useEffect(() => {
    if (!allowed || !organization?.id) {
      setLoading(false)
      return
    }
    loadUsers(organization.id)
    loadCustomTrades(organization.id).then(setTrades).catch(() => {})
    loadVariationTracker(organization.id, project.id).then(setTracker).catch(() => {})
    const unsubRows = subscribeParentVariations(
      organization.id,
      project.id,
      (next) => {
        setRows(next)
        setLoading(false)
      },
      () => {
        setError('Variations did not load. Check the connection and try again.')
        setLoading(false)
      }
    )
    const unsubTracker = subscribeVariationTracker(organization.id, project.id, setTracker)
    return () => {
      unsubRows()
      unsubTracker()
    }
  }, [allowed, organization?.id, project.id, loadUsers])

  const live = rows.filter((row) => !row.isDeleted)
  const counts = {
    all: live.length,
    open: live.filter((row) => row.status === 'open').length,
    submitted: live.filter((row) => row.status === 'submitted').length,
    closed: live.filter((row) => row.status === 'closed').length,
    hours: live.reduce((sum, row) => sum + row.totalLabourHours, 0),
  }
  const sorted = useMemo(() => {
    const copy = [...live]
    if (tracker?.enabled) copy.sort((a, b) => a.sequence - b.sequence || b.createdAt.getTime() - a.createdAt.getTime())
    else copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return copy
  }, [live, tracker?.enabled])
  const visible = sorted.filter((row) => {
    if (filter !== 'all' && row.status !== filter) return false
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    const materials = row.materials.map((line) => line.name).join(' ')
    return `${row.voNumber} ${row.heading} ${materials}`.toLowerCase().includes(needle)
  })
  const selected = openId ? live.find((row) => row.id === openId) || null : null

  if (!allowed) {
    return (
      <div className="empty card pad">
        <h1>Variations</h1>
        <p>Variations are for admins, and for managers assigned to this job.</p>
      </div>
    )
  }

  const exportCsv = () => {
    const blob = new Blob([variationsToCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.jobNumber || 'variations'}-variations.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="hero" data-hue={parentType === 'smallWork' ? 'sw' : 'proj'} style={{ padding: '22px 24px' }}>
        <div className="relative z-[1]">
          <h1 className="big" style={{ fontSize: 32 }}>Variations</h1>
          <p style={{ opacity: 0.9, marginTop: 6, maxWidth: 640 }}>{VARIATION_HEADER_COPY}</p>
          <p className="mt-1" style={{ opacity: 0.8 }}>{parentName}</p>
        </div>
      </section>
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Stat label="Open" value={String(counts.open)} hue="warn" />
        <Stat label="Submitted" value={String(counts.submitted)} hue="green" />
        <Stat label="Closed" value={String(counts.closed)} hue="red" />
        <Stat label="Hours" value={counts.hours.toFixed(1)} hue="blue" />
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="seg">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={filter === item.id ? 'on' : ''} onClick={() => setFilter(item.id)}>
              {item.label} {counts[item.id]}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Search number, heading, materials"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ minWidth: 220, flex: 1 }}
        />
        <button type="button" className="btn sm ghost" onClick={exportCsv}>Export CSV</button>
        {canTrack && tracker?.enabled ? (
          <Link href={`${base}/variations/tracker`} className="btn sm ghost">Variation tracker</Link>
        ) : null}
        {canEdit ? (
          <button type="button" className="btn sm primary" onClick={() => setEditing('new')}>New variation</button>
        ) : null}
      </div>
      {filter !== 'all' ? (
        <div className="card pad">
          <p>{VARIATION_STATUS_COPY[filter]}</p>
        </div>
      ) : null}
      {error ? <p className="muted">{error}</p> : null}
      {loading ? <p className="muted">Loading variations…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="empty card pad">
          <h3>No variations</h3>
          <p>{VARIATION_HEADER_COPY}</p>
        </div>
      ) : (
        <div className="rows">
          {visible.map((row) => (
            <VariationRow key={row.id} row={row} onClick={() => setOpenId(row.id)} />
          ))}
        </div>
      )}
      {editing && organization?.id && user ? (
        <VariationEditor
          existing={editing === 'new' ? null : editing}
          siblings={rows}
          trackerEnabled={Boolean(tracker?.enabled)}
          prefix={tracker?.prefix || 'VO-'}
          padding={tracker?.padding || 3}
          trades={trades}
          onClose={() => setEditing(null)}
          onSave={async (draft, files) => {
            if (!organization.id) return
            const evidence = await uploadEvidenceFiles(organization.id, editing === 'new' ? newUuid() : editing.id, files, user.id)
            const mergedEvidence = [...(editing === 'new' ? [] : editing.evidence), ...evidence]
            if (editing === 'new') {
              await createVariation({
                organizationId: organization.id,
                parentType,
                parentId: project.id,
                parentName,
                origin: 'app',
                voNumber: draft.voNumber,
                heading: draft.heading,
                description: draft.description,
                labour: draft.labour,
                materials: draft.materials,
                evidence: mergedEvidence,
                actor: { uid: user.id, name: displayUser(user) },
                users,
                managerIds: [project.managerId || '', ...(project.managerIds || [])],
              })
              toast('Variation saved as open')
            } else {
              await updateVariation({
                organizationId: organization.id,
                actorUid: user.id,
                variation: { ...editing, ...draft, evidence: mergedEvidence },
              })
              toast('Variation updated')
            }
            if (draft.customTrades?.length) {
              let next = trades
              for (const trade of draft.customTrades) {
                next = await saveCustomTrade(organization.id, trade)
              }
              setTrades(next)
            }
            setEditing(null)
          }}
        />
      ) : null}
      {selected && user ? (
        <VariationDrawer
          row={selected}
          canEdit={canEdit}
          canStatus={canStatus}
          viewerId={user.id}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setEditing(selected)
            setOpenId(null)
          }}
          onStatus={async (status) => {
            if (!organization?.id) return
            if (status === 'submitted' && !window.confirm('This variation has gone to the client. Its number will be locked.')) return
            const next = await setVariationStatus({
              organizationId: organization.id,
              variation: selected,
              status,
              actor: { uid: user.id, name: displayUser(user) },
            })
            setOpenId(next.id)
          }}
          onDelete={async () => {
            if (!organization?.id || !window.confirm('Remove this variation from the list? Its number will not be reused.')) return
            await softDeleteVariation(organization.id, selected, user.id)
            setOpenId(null)
          }}
          onRemoveEvidence={async (evidenceId) => {
            if (!organization?.id) return
            const file = selected.evidence.find((item) => item.id === evidenceId)
            if (!file) return
            if (!canEdit && file.uploadedByUid !== user.id) return
            if (!window.confirm('Remove this file?')) return
            await removeEvidenceObject(file.storagePath)
            await updateVariation({
              organizationId: organization.id,
              variation: { ...selected, evidence: selected.evidence.filter((item) => item.id !== evidenceId) },
              actorUid: user.id,
            })
          }}
        />
      ) : null}
    </div>
  )
}

function Stat({ label, value, hue }: { label: string; value: string; hue: string }) {
  return (
    <div className="card pad" data-hue={hue} style={{ textAlign: 'center' }}>
      <b style={{ fontFamily: 'var(--head)', fontSize: 26 }}>{value}</b>
      <div className="xs" style={{ fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function VariationRow({ row, onClick }: { row: Variation; onClick: () => void }) {
  const opacity = row.status === 'closed' ? 0.54 : row.status === 'submitted' ? 0.74 : 1
  const recent = row.numberHistory.find((item) => Date.now() - item.at.getTime() < 7 * 24 * 60 * 60 * 1000)
  return (
    <button type="button" className="ritem" onClick={onClick} style={{ opacity, textAlign: 'left' }}>
      <span className="ico-chip" data-hue={row.status === 'open' ? 'warn' : row.status === 'submitted' ? 'green' : 'red'}>
        {row.voNumber.replace('VO-', '')}
      </span>
      <span className="grow">
        <span className="t">
          {row.heading}
          {row.origin === 'tracker' ? <span className="pill" style={{ marginLeft: 8 }}>From tracker</span> : null}
        </span>
        <span className="s">{row.description}</span>
        {recent ? <span className="s">was {recent.from}</span> : null}
        <span className="s">
          {row.totalLabourHours.toFixed(1)} hrs · {row.materialLineCount} materials ·{' '}
          <span style={row.evidenceCount === 0 ? { color: 'var(--red, #D3453F)', fontWeight: 700 } : undefined}>
            {row.evidenceCount === 0 ? 'None' : `${row.evidenceCount} evidence`}
          </span>
          {' · '}
          {row.createdByName} · {formatWhen(row.createdAt)}
        </span>
      </span>
      <span className="pill" data-hue={row.status === 'open' ? 'warn' : row.status === 'submitted' ? 'green' : 'red'}>
        {row.status}
      </span>
    </button>
  )
}

async function uploadEvidenceFiles(
  organizationId: string,
  variationId: string,
  files: File[],
  uid: string
): Promise<VariationEvidence[]> {
  const uploaded: VariationEvidence[] = []
  for (const file of files) {
    const id = newUuid()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const storagePath = `organizations/${organizationId}/variations/${variationId}/${id}.${ext}`
    const downloadURL = await uploadFile(storagePath, file, file.type || 'application/octet-stream')
    uploaded.push({
      id,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storagePath,
      downloadURL,
      uploadedByUid: uid,
      uploadedAt: new Date(),
    })
  }
  return uploaded
}

function VariationEditor({
  existing,
  siblings,
  trackerEnabled,
  prefix,
  padding,
  trades,
  onClose,
  onSave,
}: {
  existing: Variation | null
  siblings: Variation[]
  trackerEnabled: boolean
  prefix: string
  padding: number
  trades: string[]
  onClose: () => void
  onSave: (
    draft: {
      voNumber: string
      heading: string
      description: string
      labour: VariationLabourLine[]
      materials: VariationMaterialLine[]
      customTrades?: string[]
    },
    files: File[]
  ) => Promise<void>
}) {
  const suggested = nextFreeVoNumber(siblings, prefix, padding)
  const tradeOptions = [...VARIATION_TRADES, ...trades.filter((item) => !VARIATION_TRADES.includes(item as (typeof VARIATION_TRADES)[number]))]
  const initialLabour: LabourLine[] = (existing?.labour || []).map((line) => ({
    id: line.id,
    trade: line.trade,
    operatives: 1,
    hoursEach: line.hours,
  }))
  const initialMaterials: MaterialLine[] = (existing?.materials || []).map((line) => splitMaterialQuantity(line))

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" role="dialog" aria-modal="true">
      <div className="h-[min(100dvh,920px)] w-full max-w-lg overflow-hidden bg-[var(--bg)] shadow-2xl sm:rounded-3xl">
        <NewVariationSheet
          parentName="this job"
          defaultVoNumber={trackerEnabled ? existing?.voNumber || suggested : existing?.voNumber || suggested}
          voNumberLocked={trackerEnabled || Boolean(existing)}
          trades={tradeOptions}
          recentTrades={tradeOptions.slice(0, 5)}
          initialHeading={existing?.heading || ''}
          initialDescription={existing?.description || ''}
          initialLabour={initialLabour}
          initialMaterials={initialMaterials}
          savedEvidenceCount={existing?.evidence.length || 0}
          title={existing ? 'Edit variation' : 'New variation'}
          onCancel={onClose}
          onCustomTrade={() => {
            /* persisted from the saved labour line if it is new */
          }}
          onSave={async (draft) => {
            const voNumber = trackerEnabled ? existing?.voNumber || suggested : draft.voNumber.trim()
            if (!trackerEnabled && voNumberTaken(siblings, voNumber, existing?.id)) {
              throw new Error(`${voNumber} is already used on this job.`)
            }
            const files = draft.evidence.map((item) => item.file)
            const problem = files.map((file) => evidenceFileAllowed(file)).find(Boolean)
            if (problem) throw new Error(problem)
            if ((existing?.evidence.length || 0) + files.length > EVIDENCE_MAX_FILES) {
              throw new Error('A variation can hold 10 files.')
            }
            const known = new Set(tradeOptions.map((trade) => trade.toLowerCase()))
            const customTrades = Array.from(
              new Set(
                draft.labour
                  .map((line) => line.trade.trim())
                  .filter((trade) => trade && !known.has(trade.toLowerCase()))
              )
            )
            await onSave(
              {
                voNumber,
                heading: draft.heading.trim(),
                description: draft.description.trim(),
                labour: draft.labour
                  .map((line) => ({
                    id: line.id || newUuid(),
                    trade: line.trade,
                    hours: Math.round(lineHours(line) * 100) / 100,
                  }))
                  .filter((line) => line.hours > 0),
                materials: draft.materials
                  .filter((line) => line.name.trim())
                  .map((line) => ({
                    id: line.id || newUuid(),
                    name: line.name.trim(),
                    quantity: materialQuantity(line),
                  })),
                customTrades,
              },
              files
            )
          }}
        />
      </div>
    </div>
  )
}

const MATERIAL_UNITS: Unit[] = ['m', 'box', 'kg', 'no']

function splitMaterialQuantity(line: VariationMaterialLine): MaterialLine {
  const raw = line.quantity.trim()
  const match = raw.match(/^(.*\d)\s*(m|box|kg)$/i)
  const unit = match?.[2]?.toLowerCase()
  if (!match || (unit !== 'm' && unit !== 'box' && unit !== 'kg')) {
    return { id: line.id, name: line.name, quantity: raw, unit: 'no' }
  }
  return { id: line.id, name: line.name, quantity: match[1].trim(), unit }
}

function materialQuantity(line: MaterialLine): string {
  const qty = line.quantity.trim()
  if (!qty || line.unit === 'no') return qty
  if (qty.toLowerCase().endsWith(line.unit)) return qty
  return `${qty}${line.unit}`
}

function VariationDrawer({
  row,
  canEdit,
  canStatus,
  viewerId,
  onClose,
  onEdit,
  onStatus,
  onDelete,
  onRemoveEvidence,
}: {
  row: Variation
  canEdit: boolean
  canStatus: boolean
  viewerId: string
  onClose: () => void
  onEdit: () => void
  onStatus: (status: VariationStatus) => Promise<void>
  onDelete: () => Promise<void>
  onRemoveEvidence: (evidenceId: string) => Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-md overflow-auto bg-[var(--card)] p-5 shadow-xl">
        <div className="row">
          <h2 className="h2 grow">{row.voNumber}</h2>
          <button type="button" className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <p className="mt-2 font-semibold">{row.heading}</p>
        <p className="muted">{row.description}</p>
        {canStatus ? (
          <label className="stack mt-3" style={{ gap: 4 }}>
            <span className="eyebrow">Status</span>
            <select className="input" value={row.status} onChange={(event) => void onStatus(event.target.value as VariationStatus)}>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        ) : (
          <p className="pill mt-3">{row.status}</p>
        )}
        <p className="mt-2">{VARIATION_STATUS_COPY[row.status]}</p>
        <h3 className="h2 mt-4">Labour</h3>
        {row.labour.map((line) => (
          <p key={line.id}>{line.trade} · {line.hours} hrs</p>
        ))}
        <h3 className="h2 mt-4">Materials</h3>
        {row.materials.map((line) => (
          <p key={line.id}>{line.name} · {line.quantity}</p>
        ))}
        <h3 className="h2 mt-4">Evidence</h3>
        {row.evidence.length === 0 ? <p style={{ color: 'var(--red, #D3453F)' }}>No evidence</p> : null}
        <div className="grid g2">
          {row.evidence.map((file) => (
            <div key={file.id} className="card pad">
              <a href={file.downloadURL} target="_blank" rel="noreferrer">{file.fileName}</a>
              {canEdit || file.uploadedByUid === viewerId ? (
                <button type="button" className="btn sm ghost" onClick={() => void onRemoveEvidence(file.id)}>
                  Remove file
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <h3 className="h2 mt-4">History</h3>
        <p>Raised by {row.createdByName} on {formatWhen(row.createdAt)}</p>
        {row.statusHistory.map((item, index) => (
          <p key={`${item.status}-${index}`}>{item.status} · {item.byName} · {formatWhen(item.at)}</p>
        ))}
        {row.numberHistory.map((item, index) => (
          <p key={`${item.from}-${index}`}>{item.from} → {item.to}</p>
        ))}
        <div className="row mt-4" style={{ gap: 8 }}>
          {canEdit ? <button type="button" className="btn sm primary" onClick={onEdit}>Edit</button> : null}
          {canEdit ? <button type="button" className="btn sm ghost" onClick={() => void onDelete()}>Remove</button> : null}
        </div>
      </aside>
    </div>
  )
}

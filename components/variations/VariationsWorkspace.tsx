'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useToast } from '@/components/ui/ToastProvider'
import { uploadFile } from '@/lib/firebase/storageUtils'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  CUSTOM_TRADE_OPTION,
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
            if (draft.customTrade) {
              const next = await saveCustomTrade(organization.id, draft.customTrade)
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
      customTrade?: string
    },
    files: File[]
  ) => Promise<void>
}) {
  const suggested = nextFreeVoNumber(siblings, prefix, padding)
  const [voNumber, setVoNumber] = useState(existing?.voNumber || suggested)
  const [heading, setHeading] = useState(existing?.heading || '')
  const [description, setDescription] = useState(existing?.description || '')
  const [labour, setLabour] = useState<VariationLabourLine[]>(existing?.labour || [])
  const [materials, setMaterials] = useState<VariationMaterialLine[]>(existing?.materials || [])
  const [files, setFiles] = useState<File[]>([])
  const [customTrade, setCustomTrade] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tradeOptions = [...VARIATION_TRADES, ...trades.filter((item) => !VARIATION_TRADES.includes(item as (typeof VARIATION_TRADES)[number]))]

  const addLabour = (trade = tradeOptions[0] || 'Electrician') => {
    setLabour((rows) => [...rows, { id: newUuid(), trade, hours: 0 }])
  }
  const addHours = (amount: number) => {
    setLabour((rows) => {
      if (rows.length === 0) return [{ id: newUuid(), trade: tradeOptions[0] || 'Electrician', hours: amount }]
      return rows.map((row, index) => (index === rows.length - 1 ? { ...row, hours: Math.round((row.hours + amount) * 100) / 100 } : row))
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form
        className="card stack max-h-[90vh] w-full max-w-3xl overflow-auto"
        style={{ gap: 14, padding: 18 }}
        onSubmit={async (event) => {
          event.preventDefault()
          if (!heading.trim()) {
            setError('Add a heading before saving.')
            return
          }
          if (!trackerEnabled && voNumberTaken(siblings, voNumber, existing?.id)) {
            setError(`${voNumber} is already used on this job.`)
            return
          }
          if ((existing?.evidence.length || 0) + files.length > EVIDENCE_MAX_FILES) {
            setError('A variation can hold 10 files.')
            return
          }
          setBusy(true)
          setError(null)
          try {
            await onSave(
              {
                voNumber: trackerEnabled ? existing?.voNumber || suggested : voNumber.trim(),
                heading: heading.trim(),
                description: description.trim(),
                labour,
                materials,
                customTrade: customTrade.trim() || undefined,
              },
              files
            )
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the variation.')
            setBusy(false)
          }
        }}
      >
        <div className="row">
          <h2 className="h2 grow">{existing ? 'Edit variation' : 'New variation'}</h2>
          <button type="button" className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <label className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">VO number</span>
          <input className="input" value={trackerEnabled ? existing?.voNumber || suggested : voNumber} readOnly={trackerEnabled || Boolean(existing)} onChange={(event) => setVoNumber(event.target.value)} />
          {trackerEnabled ? <span className="muted small">Numbered by the tracker · next free number is {suggested}</span> : null}
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Heading</span>
          <input className="input" value={heading} onChange={(event) => setHeading(event.target.value)} required />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Description</span>
          <textarea className="input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="grid g2">
          <section className="card pad stack" style={{ gap: 8 }}>
            <div className="row">
              <b className="grow">Labour · {labour.reduce((sum, line) => sum + line.hours, 0).toFixed(1)} hrs</b>
              <button type="button" className="btn sm ghost" onClick={() => addLabour()}>Add labour row</button>
            </div>
            {labour.map((line) => (
              <div key={line.id} className="row" style={{ gap: 8 }}>
                <select
                  className="input"
                  value={tradeOptions.includes(line.trade) ? line.trade : CUSTOM_TRADE_OPTION}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === CUSTOM_TRADE_OPTION) return
                    setLabour((rows) => rows.map((item) => (item.id === line.id ? { ...item, trade: value } : item)))
                  }}
                >
                  {tradeOptions.map((trade) => (
                    <option key={trade}>{trade}</option>
                  ))}
                  <option>{CUSTOM_TRADE_OPTION}</option>
                </select>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={line.hours}
                  onChange={(event) =>
                    setLabour((rows) => rows.map((item) => (item.id === line.id ? { ...item, hours: Number(event.target.value) } : item)))
                  }
                  style={{ width: 90 }}
                />
              </div>
            ))}
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted small">Custom trade…</span>
              <input className="input" value={customTrade} placeholder="Save a trade for the whole company" onChange={(event) => setCustomTrade(event.target.value)} />
            </label>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn sm ghost" onClick={() => addHours(0.5)}>+30 min</button>
              <button type="button" className="btn sm ghost" onClick={() => addHours(1)}>+1 hr</button>
              <button type="button" className="btn sm ghost" onClick={() => addHours(4)}>+4 hrs</button>
              <button type="button" className="btn sm ghost" onClick={() => addHours(8)}>+8 hrs</button>
            </div>
          </section>
          <section className="card pad stack" style={{ gap: 8 }}>
            <div className="row">
              <b className="grow">Materials · {materials.length}</b>
              <button type="button" className="btn sm ghost" onClick={() => setMaterials((rows) => [...rows, { id: newUuid(), name: '', quantity: '' }])}>
                Add material
              </button>
            </div>
            {materials.map((line) => (
              <div key={line.id} className="row" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="Material"
                  value={line.name}
                  onChange={(event) =>
                    setMaterials((rows) => rows.map((item) => (item.id === line.id ? { ...item, name: event.target.value } : item)))
                  }
                />
                <input
                  className="input"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(event) =>
                    setMaterials((rows) => rows.map((item) => (item.id === line.id ? { ...item, quantity: event.target.value } : item)))
                  }
                  style={{ width: 90 }}
                />
              </div>
            ))}
            <div className="row" style={{ gap: 6 }}>
              {['m', 'no', 'box', 'kg'].map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className="btn sm ghost"
                  onClick={() =>
                    setMaterials((rows) =>
                      rows.length === 0
                        ? [{ id: newUuid(), name: '', quantity: unit }]
                        : rows.map((item, index) => (index === rows.length - 1 ? { ...item, quantity: `${item.quantity}${unit}` } : item))
                    )
                  }
                >
                  {unit}
                </button>
              ))}
            </div>
          </section>
        </div>
        <EvidencePicker
          files={files}
          onFiles={(next) => {
            const problem = next.map((file) => evidenceFileAllowed(file)).find(Boolean)
            if (problem) {
              setError(problem)
              return
            }
            setFiles(next.slice(0, EVIDENCE_MAX_FILES))
          }}
        />
        {error ? <p style={{ color: 'var(--red, #D3453F)' }}>{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy || !heading.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <p className="muted small">Saves as Open and notifies every admin.</p>
      </form>
    </div>
  )
}

function EvidencePicker({ files, onFiles }: { files: File[]; onFiles: (files: File[]) => void }) {
  return (
    <section
      className="card pad"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        onFiles([...files, ...Array.from(event.dataTransfer.files)])
      }}
    >
      <p><b>Please upload any supporting evidence here</b></p>
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.heic,.pdf,image/jpeg,image/png,image/heic,application/pdf"
        multiple
        onChange={(event) => onFiles([...files, ...Array.from(event.target.files || [])])}
      />
      {files.map((file) => (
        <p key={file.name} className="muted small">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
      ))}
    </section>
  )
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

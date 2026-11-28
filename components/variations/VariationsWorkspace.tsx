'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { VariationStatusButtons } from './VariationStatusButtons'
import { variationUploadErrorText } from '@/lib/variations/variationUploadStall'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { useOrganizationCurrency, useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { useToast } from '@/components/ui/ToastProvider'
import { uploadVariationEvidenceFile, variationEvidencePath } from '@/lib/firebase/storageUtils'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import {
  EVIDENCE_MAX_FILES,
  VARIATION_HEADER_COPY,
  VARIATION_STATUS_COPY,
  mergedVariationTradeOptions,
  evidenceFileAllowed,
  parentDisplayName,
  VARIATION_LIST_FILTERS,
  variationMatchesListFilter,
  type Variation,
  type VariationCustomLine,
  type VariationEvidence,
  type VariationLabourLine,
  type VariationListFilter,
  type VariationMaterialLine,
  type VariationStatus,
  type VariationSubcontractorLine,
  type VariationTracker,
} from '@/lib/variations/variationModel'
import { newVariationNumberChoice, nextFreeVoNumber } from '@/lib/variations/variationNumbering'
import {
  lineHours,
  NewVariationSheet,
  type CustomLineDraft,
  type LabourLine,
  type MaterialLine,
  type SubcontractorLineDraft,
  type Unit,
} from '@/components/variations/NewVariationSheet'
import {
  canChangeVariationStatus,
  canEditVariationContent,
  canSeeJobVariations,
  canSeeVariationCostsFor,
  canUseVariationTracker,
} from '@/lib/variations/variationAccess'
import { downloadVariationsWorkbook } from '@/lib/variations/variationExport'
import {
  addVariationEvidence,
  createVariation,
  loadCustomTrades,
  loadVariationTracker,
  removeEvidenceObject,
  removeVariationEvidence,
  saveCustomTrade,
  setVariationStatus,
  softDeleteVariation,
  subscribeParentVariations,
  subscribeVariationTracker,
  updateVariation,
  variationCopyWarning,
} from '@/lib/variations/variationStorage'
import type { Project } from '@/types'
import { ReportFileLink } from '@/components/fileReports/ReportFileLink'
import {
  FILE_KEPT_ON_REMOVE_COPY,
  canViewRemovedEvidence,
  currencySymbol,
  fileDeletePermission,
  formatMoney,
  removedEvidenceHeading,
  variationDateText,
  variationLabourText,
  variationLineTotal,
  variationListTotals,
  compareVariationTrackerOrder,
  variationMaterialLineFields,
  variationMaterialQuantity,
  variationPreviousNumbers,
  variationTotals,
} from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import { safeExternalUrl } from '@/lib/canonical/uploadPolicy'

type Filter = VariationListFilter

const STATUS_HUE: Record<VariationStatus, string> = { open: 'warn', submitted: 'green', closed: 'lib' }
const STATUS_LABEL: Record<VariationStatus, string> = { open: 'Open', submitted: 'Submitted', closed: 'Closed' }

function displayUser(user: { firstName?: string; surname?: string; email?: string } | null): string {
  if (!user) return 'Someone'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Someone'
}

function hoursText(hours: number): string {
  return `${Math.round(hours * 100) / 100}h`
}

/** One evidence upload in progress (rulebook 1.52.0: progress and the real error are shown, never swallowed). */
type UploadItem = { id: string; name: string; progress: number; status: 'uploading' | 'done' | 'failed'; error?: string }
type UploadJob = { key: string; voNumber: string; items: UploadItem[]; status: 'uploading' | 'linking' | 'done' | 'failed'; message?: string }

export function VariationsWorkspace({
  project,
  parentType,
}: {
  project: Project
  parentType: 'project' | 'smallWork'
}) {
  const { user, organization } = useAuthStore()
  const { managers, loadManagers } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { subcontractors, loadSubcontractors } = useSubcontractorStore()
  const { data: orgDoc } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const currency = useOrganizationCurrency()
  const toast = useToast()
  const [rows, setRows] = useState<Variation[]>([])
  const [tracker, setTracker] = useState<VariationTracker | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const filters = VARIATION_LIST_FILTERS
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Variation | null | 'new'>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // Owner 25 Nov: a status picked on the summary and not saved there is saved with the next Edit's Save.
  const [editStatus, setEditStatus] = useState<VariationStatus | null>(null)
  const [trades, setTrades] = useState<string[]>([])
  const [uploads, setUploads] = useState<UploadJob[]>([])
  const [exporting, setExporting] = useState(false)

  const parentName = parentDisplayName(project.jobNumber, project.siteName)
  const canEdit = canEditVariationContent(user, project, managers)
  const canStatus = canChangeVariationStatus(user, project, managers)
  const canTrack = canUseVariationTracker(user, project, managers)
  const showCost = canSeeVariationCostsFor(user)
  const money = useCallback((amount: number) => formatMoney(amount, currency), [currency])
  const base = parentType === 'smallWork' ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`

  const allowed = canSeeJobVariations(user, project, managers)

  useEffect(() => {
    if (!allowed || !organization?.id) {
      setLoading(false)
      return
    }
    loadUsers(organization.id)
    loadManagers(organization.id)
    void loadSubcontractors(organization.id)
    // Trades are picker suggestions only; a failed read leaves the picker without them.
    loadCustomTrades(organization.id)
      .then(setTrades)
      .catch((err) => console.warn('[variations] trades did not load', err))
    // The tracker decides numbering: a failed read is shown, never treated as "no tracker".
    const trackerFailed = () =>
      setError('Variation numbering settings did not load. Check the connection and reload before adding variations.')
    loadVariationTracker(organization.id, project.id).then(setTracker).catch(trackerFailed)
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
    const unsubTracker = subscribeVariationTracker(organization.id, project.id, setTracker, trackerFailed)
    return () => {
      unsubRows()
      unsubTracker()
    }
  }, [allowed, organization?.id, project.id, loadUsers, loadManagers, loadSubcontractors])

  // Leaving the page while evidence is still uploading would lose it: ask first.
  const uploading = uploads.some((job) => job.status === 'uploading' || job.status === 'linking')
  useEffect(() => {
    if (!uploading) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  // Rulebook 1.79.0 §13: a variation notice opens this page with ?open={id}: open that variation once it has loaded.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get('open')?.trim().toLowerCase()
    if (!wanted) return
    const row = rows.find((item) => item.id.toLowerCase() === wanted && !item.isDeleted)
    if (row) setOpenId(row.id)
    params.delete('open')
    const rest = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
  }, [loading, rows])

  // The tracker's "Edit items" opens this page with ?edit={id}: open that variation's editor once it has loaded.
  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const id = params.get('edit')
    if (!id) return
    const row = rows.find((item) => item.id === id && !item.isDeleted)
    if (row && canEditVariationContent(user, project, managers)) setEditing(row)
    params.delete('edit')
    const rest = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`)
  }, [loading, rows, user, project, managers])

  const live = useMemo(() => rows.filter((row) => !row.isDeleted), [rows])
  // Rulebook 1.52.0: every figure is `variationListTotals` / `variationTotals`.
  const totals = useMemo(() => variationListTotals(live), [live])
  const counts = {
    all: live.length,
    open: live.filter((row) => row.status === 'open').length,
    submitted: live.filter((row) => row.status === 'submitted').length,
    closed: live.filter((row) => row.status === 'closed').length,
  }
  const sorted = useMemo(() => {
    const copy = [...live]
    if (tracker?.enabled) copy.sort(compareVariationTrackerOrder) // the tracker order (rulebook 1.63.0)
    else copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return copy
  }, [live, tracker?.enabled])
  const visible = sorted.filter((row) => {
    if (!variationMatchesListFilter(row.status, filter)) return false
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    const lines = [
      ...row.materials.map((line) => line.name),
      ...row.customLines.map((line) => line.name),
      ...row.subcontractorLines.map((line) => `${line.name} ${line.quoteNumber}`),
    ].join(' ')
    return `${row.voNumber} ${row.heading} ${row.description} ${lines}`.toLowerCase().includes(needle)
  })
  const selected = openId ? live.find((row) => row.id === openId) || null : null

  if (!allowed) {
    return (
      <div className="empty card pad">
        <h1>Variations</h1>
        <p>Variations are for admins and managers.</p>
      </div>
    )
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      // Every variation of the job (with or without lines), never only the filtered list.
      await downloadVariationsWorkbook({
        variations: rows,
        timeZone,
        currency,
        includeCost: showCost,
        companyName: organization?.name || '',
        jobNumber: project.jobNumber || '',
        jobName: project.siteName || '',
        generatedBy: displayUser(user),
        logoUrl: typeof orgDoc?.companyLogoURL === 'string' ? orgDoc.companyLogoURL : null,
      })
    } catch (err) {
      console.error('[variations] Excel export failed', err)
      toast(err instanceof Error ? `The Excel file could not be made: ${err.message}` : 'The Excel file could not be made.')
    } finally {
      setExporting(false)
    }
  }

  const patchJob = (key: string, update: (job: UploadJob) => UploadJob) =>
    setUploads((prev) => prev.map((job) => (job.key === key ? update(job) : job)))

  /**
   * Rulebook 1.52.0: evidence uploads after the variation is saved (the sheet closes straight away). Every file is a
   * resumable upload with progress that is cancelled on a stall; the uploaded files are then linked in one transaction
   * (`addVariationEvidence`, tried twice). A file that could not be linked is deleted again (its uploader, inside the
   * §24 undo window), so nothing is left unlinked in Storage.
   */
  const runUploads = async (variation: Variation, files: File[]) => {
    if (!organization?.id || !user || files.length === 0) return
    const key = newUuid()
    const items: UploadItem[] = files.map((file) => ({ id: newUuid(), name: file.name, progress: 0, status: 'uploading' }))
    setUploads((prev) => [...prev, { key, voNumber: variation.voNumber, items, status: 'uploading' }])
    const results = await Promise.all(
      files.map(async (file, index): Promise<VariationEvidence | null> => {
        const itemId = items[index].id
        const setItem = (patch: Partial<UploadItem>) =>
          patchJob(key, (job) => ({ ...job, items: job.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }))
        try {
          const prepared = await prepareClientUpload(file, 'variation')
          if (prepared.error) throw new Error(prepared.error)
          const storagePath = variationEvidencePath(organization.id, project.id, prepared.file.name)
          const uploaded = await uploadVariationEvidenceFile(storagePath, prepared.file, prepared.file.type, {
            onProgress: (fraction) => setItem({ progress: fraction }),
          })
          setItem({ progress: 1, status: 'done' })
          return {
            id: newUuid(),
            fileName: prepared.file.name,
            contentType: uploaded.contentType,
            sizeBytes: uploaded.sizeBytes,
            storagePath: uploaded.storagePath,
            downloadURL: uploaded.downloadURL,
            uploadedByUid: user.id,
            uploadedAt: new Date(),
          }
        } catch (err) {
          console.error(`[variations] evidence upload failed for ${file.name}`, err)
          setItem({ status: 'failed', error: readableUploadError(err) })
          return null
        }
      })
    )
    const uploaded = results.filter((item): item is VariationEvidence => Boolean(item))
    if (uploaded.length === 0) {
      patchJob(key, (job) => ({ ...job, status: 'failed', message: 'No evidence was added. Open the variation and add the files again.' }))
      return
    }
    patchJob(key, (job) => ({ ...job, status: 'linking' }))
    // Review of #330, HIGH 1: only files proven NOT on the variation (refused for the 10-file limit, or absent from a
    // fresh read after a failed link) are deleted again; a file already on the stored list is linked and kept.
    const linked = await addVariationEvidence({ organizationId: organization.id, variation, entries: uploaded, actorUid: user.id })
    await Promise.all(linked.notLinked.map((path) => removeEvidenceObject(path)))
    const missing = files.length - linked.linked.length
    const kept = uploaded.length - linked.linked.length - linked.notLinked.length
    if (linked.error) console.error('[variations] evidence could not be linked to the variation', linked.error)
    patchJob(key, (job) => ({
      ...job,
      status: missing > 0 ? 'failed' : 'done',
      message:
        missing === 0
          ? `${linked.linked.length} evidence file${linked.linked.length === 1 ? '' : 's'} added.`
          : linked.error
            ? `${linked.linked.length} of ${files.length} files added to ${variation.voNumber}: ${linked.error instanceof Error ? linked.error.message : 'the variation could not be updated'}.${kept > 0 ? ' Files whose link could not be checked are kept for an admin to restore.' : ' Add the others again.'}`
            : `${linked.linked.length} of ${files.length} files added.${linked.notLinked.length ? ' A variation holds 10 files.' : ''}`,
    }))
    if (linked.copiesFailed.length) toast(variationCopyWarning({ copiesFailed: linked.copiesFailed }) || '')
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="hero" data-hue={parentType === 'smallWork' ? 'sw' : 'proj'} style={{ padding: '22px 24px' }}>
        <div className="relative z-1">
          <p className="eb">{parentName}</p>
          <h1 className="big" style={{ fontSize: 32 }}>Variations</h1>
          <p style={{ opacity: 0.92, marginTop: 6, maxWidth: 640 }}>{VARIATION_HEADER_COPY}</p>
          <div className="stats" role="group" aria-label="Variation figures">
            {(['open', 'submitted', 'closed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                className="st"
                aria-pressed={filter === status}
                onClick={() => setFilter(filter === status ? 'all' : status)}
                style={filter === status ? { background: 'rgba(255,255,255,0.3)' } : undefined}
              >
                <b>{counts[status]}</b>
                <span>{STATUS_LABEL[status]}</span>
              </button>
            ))}
            <div className="st" aria-label={`${totals.labourHours} labour hours`}>
              <b>{hoursText(totals.labourHours)}</b>
              <span>Labour hours</span>
            </div>
            {showCost ? (
              <div className="st" aria-label={`Total cost ${money(totals.costTotal)}`}>
                <b>{money(totals.costTotal)}</b>
                <span>Total cost</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg" role="tablist" aria-label="Filter by status">
          {filters.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'on' : ''} onClick={() => setFilter(item.id)}>
              {item.label} <span className="tabular-nums" style={{ opacity: 0.7 }}>{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <input
          className="input"
          type="search"
          aria-label="Search variations"
          placeholder="Search number, heading, items"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ minWidth: 200, flex: 1 }}
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn sm ghost" onClick={() => void exportExcel()} disabled={exporting || live.length === 0}>
            {exporting ? 'Making Excel…' : 'Export Excel'}
          </button>
          {canTrack ? (
            <Link href={`${base}/variations/tracker`} className="btn sm tint">
              Open VO Tracker
            </Link>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn sm primary" onClick={() => setEditing('new')}>New variation</button>
          ) : null}
        </div>
      </div>

      {uploads.length > 0 ? (
        <div className="stack" style={{ gap: 8 }} aria-live="polite">
          {uploads.map((job) => (
            <UploadBanner key={job.key} job={job} onDismiss={() => setUploads((prev) => prev.filter((item) => item.key !== job.key))} />
          ))}
        </div>
      ) : null}

      {filter !== 'all' ? (
        <p className="muted small" style={{ margin: 0 }}>{VARIATION_STATUS_COPY[filter]}</p>
      ) : null}
      {error ? <p className="muted" role="alert">{error}</p> : null}
      {loading ? <p className="muted">Loading variations…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="empty card pad">
          <h3>{live.length === 0 ? 'No variations yet' : 'Nothing matches'}</h3>
          <p>{live.length === 0 ? VARIATION_HEADER_COPY : 'Try another status or search.'}</p>
        </div>
      ) : (
        <div className="rows">
          {visible.map((row) => (
            <VariationRow key={row.id} row={row} timeZone={timeZone} money={showCost ? money : null} onClick={() => setOpenId(row.id)} />
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
          subcontractors={subcontractors.map((row) => ({ id: row.id, name: row.name }))}
          currency={currency}
          onClose={() => {
            setEditing(null)
            setEditStatus(null)
          }}
          onSave={async (draft, files) => {
            if (!organization.id) return
            let saved: Variation
            let warning: string | null = null
            try {
              if (editing === 'new') {
                const created = await createVariation({
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
                  customLines: draft.customLines,
                  subcontractorLines: draft.subcontractorLines,
                  evidence: [],
                  actor: { uid: user.id, name: displayUser(user) },
                  users,
                  managerIds: [project.managerId || '', ...(project.managerIds || [])],
                  existingRows: rows,
                  tracker: tracker ?? undefined,
                })
                saved = created
                warning = variationCopyWarning(created.saveOutcome)
              } else {
                // Review of #330, HIGH 2: `editing` is the copy the sheet opened with; only the fields the user changed
                // from it are written, so a renumber, a status change or evidence linked meanwhile is never undone.
                saved = { ...editing, ...draft }
                warning = variationCopyWarning(
                  await updateVariation({ organizationId: organization.id, actorUid: user.id, variation: saved, base: editing })
                )
              }
            } catch (err) {
              console.error('[variations] save failed', err)
              throw new Error(readableVariationError(err))
            }
            // A status picked on the summary before Edit is saved now, after the edits (owner 25 Nov), from the copy
            // just saved, so only the status fields are written.
            if (editing !== 'new' && editStatus && editStatus !== saved.status) {
              try {
                saved = await setVariationStatus({
                  organizationId: organization.id,
                  variation: saved,
                  status: editStatus,
                  actor: { uid: user.id, name: displayUser(user) },
                })
              } catch (err) {
                console.error('[variations] status save failed', err)
                warning = `${saved.voNumber} updated, but its status was not changed: ${readableVariationError(err)}`
              }
            }
            // The sheet closes now; evidence carries on uploading with its progress on the list.
            setEditing(null)
            setEditStatus(null)
            toast(warning || (editing === 'new' ? `${saved.voNumber} saved as open` : `${saved.voNumber} updated`))
            if (files.length) void runUploads(saved, files)
            try {
              if (draft.customTrades?.length) {
                let next = trades
                for (const trade of draft.customTrades) {
                  next = await saveCustomTrade(organization.id, trade)
                }
                setTrades(next)
              }
            } catch {
              toast('Variation saved. The new trade was not added to the company list.')
            }
          }}
        />
      ) : null}
      {selected && user ? (
        <VariationDrawer
          row={selected}
          canEdit={canEdit}
          canStatus={canStatus}
          viewerId={user.id}
          timeZone={timeZone}
          money={showCost ? money : null}
          showRemovedEvidence={canViewRemovedEvidence(staffAccountRole(user))}
          personName={(id) => {
            const person = users.find((row) => row.id === id)
            return person ? displayUser(person) : id || 'Unknown'
          }}
          onClose={() => setOpenId(null)}
          onEdit={(status) => {
            setEditStatus(status !== selected.status ? status : null)
            setEditing(selected)
            setOpenId(null)
          }}
          onStatus={async (status) => {
            if (!organization?.id) return
            try {
              await setVariationStatus({
                organizationId: organization.id,
                variation: selected,
                status,
                actor: { uid: user.id, name: displayUser(user) },
              })
            } catch (err) {
              console.error('[variations] status save failed', err)
              throw new Error(readableVariationError(err))
            }
            toast(`${selected.voNumber} saved`)
            setOpenId(null)
          }}
          onDelete={async () => {
            if (!organization?.id || !window.confirm(`Remove ${selected.voNumber} from the list? Its number is retired and never reused.`)) return
            const outcome = await softDeleteVariation(organization.id, selected, user.id)
            const warning = variationCopyWarning(outcome)
            if (warning) toast(warning)
            setOpenId(null)
          }}
          onRemoveEvidence={async (evidenceId) => {
            if (!organization?.id) return
            const file = selected.evidence.find((item) => item.id === evidenceId)
            if (!file) return
            if (!canEdit && file.uploadedByUid !== user.id) return
            // Rulebook 1.25.0 §24: the Storage object is deleted only when fileDeletePermission allows it (the
            // uploader within the undo window, or an admin); otherwise the file is unlinked and kept for recovery.
            const deletion = fileDeletePermission({
              storagePath: file.storagePath,
              organizationId: organization.id,
              viewerUserId: user.id,
              viewerRole: staffAccountRole(user),
              nowMs: Date.now(),
              uploadedAtMs: file.uploadedAt instanceof Date ? file.uploadedAt.getTime() : null,
            })
            if (!window.confirm(deletion.allowed ? 'Remove this file?' : 'Remove this file from the variation? The file itself is kept.')) return
            // Rulebook 1.52.0: the removal is recorded first (`variationEvidenceRemovalWriteFields`: the link goes and
            // `{ path, name, removedBy, removedAt }` is added to `removedEvidence`), then the object is deleted — as
            // iOS does — so a failed delete never leaves a link to a missing file.
            await removeVariationEvidence({
              organizationId: organization.id,
              variation: selected,
              evidenceId,
              actorUid: user.id,
            })
            if (deletion.allowed) await removeEvidenceObject(file.storagePath)
            else toast(FILE_KEPT_ON_REMOVE_COPY)
          }}
        />
      ) : null}
    </div>
  )
}

function UploadBanner({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  const done = job.items.filter((item) => item.status === 'done').length
  const progress = job.items.reduce((sum, item) => sum + item.progress, 0) / Math.max(1, job.items.length)
  const hue = job.status === 'failed' ? 'red' : job.status === 'done' ? 'green' : 'blue'
  const title =
    job.status === 'uploading'
      ? `Uploading evidence for ${job.voNumber} — ${done} of ${job.items.length}`
      : job.status === 'linking'
        ? `Adding evidence to ${job.voNumber}…`
        : job.message || ''
  return (
    <div className="card pad" data-hue={hue} style={{ padding: '12px 16px', boxShadow: 'inset 4px 0 0 var(--h), var(--sh)' }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <b className="grow small">{title}</b>
        {job.status === 'done' || job.status === 'failed' ? (
          <button type="button" className="btn sm ghost" onClick={onDismiss}>Dismiss</button>
        ) : null}
      </div>
      {job.status === 'uploading' || job.status === 'linking' ? (
        <div
          role="progressbar"
          aria-label={`Evidence upload for ${job.voNumber}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          style={{ height: 6, borderRadius: 999, background: 'var(--soft2)', marginTop: 8, overflow: 'hidden' }}
        >
          <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--h)', transition: 'width 0.2s' }} />
        </div>
      ) : null}
      {job.items.some((item) => item.status === 'failed') ? (
        <ul className="xs" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {job.items
            .filter((item) => item.status === 'failed')
            .map((item) => (
              <li key={item.id}>
                <b>{item.name}</b>: {item.error}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  )
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function VariationRow({
  row,
  timeZone,
  money,
  onClick,
}: {
  row: Variation
  timeZone: string
  money: ((amount: number) => string) | null
  onClick: () => void
}) {
  const t = variationTotals(row)
  const previous = variationPreviousNumbers(row)
  const hue = STATUS_HUE[row.status]
  const counts = [
    t.labourHours > 0 ? hoursText(t.labourHours) : null,
    t.materialsCount ? `${t.materialsCount} material${t.materialsCount === 1 ? '' : 's'}` : null,
    t.customCount ? `${t.customCount} custom` : null,
    t.subcontractorCount ? `${t.subcontractorCount} subcontractor${t.subcontractorCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      className="ritem accent"
      data-hue={hue}
      onClick={onClick}
      aria-label={`${row.voNumber}, ${row.heading}, ${STATUS_LABEL[row.status]}`}
      style={{ textAlign: 'left', alignItems: 'flex-start' }}
    >
      <span
        className="tabular-nums"
        style={{ fontFamily: 'var(--head)', fontWeight: 800, fontSize: 15, color: 'var(--h)', background: 'var(--ht)', borderRadius: 12, padding: '8px 10px', minWidth: 74, textAlign: 'center', flexShrink: 0 }}
      >
        {row.voNumber || '—'}
      </span>
      <span className="grow" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="t" style={{ whiteSpace: 'normal' }}>
          {row.heading || 'Untitled'}
          {row.origin === 'tracker' ? <span className="pill" style={{ marginLeft: 8, height: 22 }}>From tracker</span> : null}
          {previous.length ? (
            <span className="pill" style={{ marginLeft: 8, height: 22 }} title="Earlier numbers">was {previous.join(', ')}</span>
          ) : null}
        </span>
        {row.description ? (
          <span className="s" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {row.description}
          </span>
        ) : null}
        <span className="s" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center', whiteSpace: 'normal' }}>
          {counts.length ? <span>{counts.join(' · ')}</span> : <span>No line items yet</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} aria-label={`${t.evidenceCount} evidence file${t.evidenceCount === 1 ? '' : 's'}`}>
            <PaperclipIcon /> {t.evidenceCount}
          </span>
          <span>
            {row.createdByName || 'Someone'} · {variationDateText(row.createdAt.getTime(), timeZone)}
          </span>
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span className="pill dot" data-hue={hue}>{STATUS_LABEL[row.status]}</span>
        {money ? <b className="tabular-nums" style={{ fontSize: 14 }}>{money(t.costTotal)}</b> : null}
      </span>
    </button>
  )
}

function readableVariationError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
  const message = error instanceof Error ? error.message : 'Could not save the variation.'
  if (code === 'permission-denied' || /insufficient permissions/i.test(message)) {
    return 'Missing or insufficient permissions. An organisation admin or manager needs to save variations.'
  }
  return message
}

function readableUploadError(error: unknown): string {
  return variationUploadErrorText(error)
}

type EditorDraft = {
  voNumber: string
  heading: string
  description: string
  labour: VariationLabourLine[]
  materials: VariationMaterialLine[]
  customLines: VariationCustomLine[]
  subcontractorLines: VariationSubcontractorLine[]
  customTrades?: string[]
}

function VariationEditor({
  existing,
  siblings,
  trackerEnabled,
  prefix,
  padding,
  trades,
  subcontractors,
  currency,
  onClose,
  onSave,
}: {
  existing: Variation | null
  siblings: Variation[]
  trackerEnabled: boolean
  prefix: string
  padding: number
  trades: string[]
  subcontractors: { id: string; name: string }[]
  currency: string
  onClose: () => void
  onSave: (draft: EditorDraft, files: File[]) => Promise<void>
}) {
  const suggested = nextFreeVoNumber(siblings, prefix, padding)
  const tradeOptions = mergedVariationTradeOptions(trades)
  // Rulebook 1.52.0: a labour line keeps its crew (2 × 4h), read back from the stored row.
  const initialLabour: LabourLine[] = (existing?.labour || []).map((line) => ({
    id: line.id,
    trade: line.trade,
    operatives: line.operatives ?? 1,
    hoursEach: line.hoursEach ?? line.hours,
  }))
  const initialMaterials: MaterialLine[] = (existing?.materials || []).map((line) => materialDraft(line))
  const initialCustomLines: CustomLineDraft[] = (existing?.customLines || []).map((line) => ({
    id: line.id,
    name: line.name,
    description: line.description,
    quantity: String(line.quantity),
    cost: String(line.cost),
  }))
  const initialSubcontractorLines: SubcontractorLineDraft[] = (existing?.subcontractorLines || []).map((line) => ({
    id: line.id,
    subcontractorId: line.subcontractorId,
    name: line.name,
    quoteNumber: line.quoteNumber,
    quantity: String(line.quantity),
    cost: String(line.cost),
  }))
  const storedMaterials = new Map((existing?.materials || []).map((line) => [line.id, line]))
  const storedLabour = new Map((existing?.labour || []).map((line) => [line.id, line]))

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" role="dialog" aria-modal="true" aria-label={existing ? 'Edit variation' : 'New variation'}>
      <div className="h-[min(100dvh,920px)] w-full max-w-lg overflow-hidden bg-(--bg) shadow-2xl sm:rounded-3xl">
        <NewVariationSheet
          parentName="this job"
          defaultVoNumber={existing?.voNumber || suggested}
          suggestedVoNumber={existing ? undefined : suggested}
          // Owner 26 Nov: a new variation's number is pre-filled with the next number and can be changed, tracker on
          // or off; an existing variation keeps its number (renumbering is the tracker's).
          voNumberLocked={Boolean(existing)}
          voNumberNote={existing ? 'fixed' : trackerEnabled ? 'next in tracker' : 'next number'}
          trades={tradeOptions}
          recentTrades={tradeOptions.slice(0, 5)}
          initialHeading={existing?.heading || ''}
          initialDescription={existing?.description || ''}
          initialLabour={initialLabour}
          initialMaterials={initialMaterials}
          initialCustomLines={initialCustomLines}
          initialSubcontractorLines={initialSubcontractorLines}
          subcontractors={subcontractors}
          currencySymbol={currencySymbol(currency)}
          formatCost={(amount) => formatMoney(amount, currency)}
          savedEvidenceCount={existing?.evidence.length || 0}
          title={existing ? `Edit ${existing.voNumber}` : 'New variation'}
          onCancel={onClose}
          onCustomTrade={() => {
            /* persisted from the saved labour line if it is new */
          }}
          onSave={async (draft) => {
            // What is saved is exactly what the field shows (owner 26 Nov), checked against every variation of the
            // job, deleted included (`variationNumberTaken`); an existing variation keeps its stored number.
            let voNumber = existing?.voNumber || ''
            if (!existing) {
              const choice = newVariationNumberChoice(draft.voNumber, siblings)
              if (choice.error) throw new Error(choice.error)
              voNumber = choice.voNumber
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
                  .filter((line) => lineHours(line) > 0)
                  .map((line): VariationLabourLine => {
                    const stored = storedLabour.get(line.id)
                    // An untouched line from an older build stays exactly as stored.
                    if (stored && stored.operatives == null && line.operatives === 1 && line.hoursEach === stored.hours && line.trade === stored.trade) return stored
                    return {
                      id: line.id || newUuid(),
                      trade: line.trade,
                      hours: Math.round(lineHours(line) * 100) / 100,
                      operatives: line.operatives || 1,
                      hoursEach: line.hoursEach,
                    }
                  }),
                materials: draft.materials
                  .filter((line) => line.name.trim())
                  .map((line): VariationMaterialLine => {
                    const stored = storedMaterials.get(line.id)
                    if (stored && line.legacyText != null && line.name.trim() === stored.name) return stored
                    if (stored && stored.quantityValue == null && line.name.trim() === stored.name && sameQuantity(stored, line)) return stored
                    // Rulebook 1.52.0 `variationMaterialLineFields`: the number and its unit, with the text older builds read.
                    const fields = variationMaterialLineFields({ id: line.id || newUuid(), name: line.name, quantity: line.quantity, unit: line.unit })
                    return fields
                  }),
                customLines: draft.customLines.map((line) => ({
                  id: line.id || newUuid(),
                  name: line.name.trim(),
                  description: line.description.trim(),
                  quantity: Number(line.quantity.replace(',', '.')) || 1,
                  cost: Number(line.cost.replace(',', '.')) || 0,
                })),
                subcontractorLines: draft.subcontractorLines.map((line) => ({
                  id: line.id || newUuid(),
                  subcontractorId: line.subcontractorId,
                  name: line.name.trim(),
                  quoteNumber: line.quoteNumber.trim(),
                  quantity: Number(line.quantity.replace(',', '.')) || 1,
                  cost: Number(line.cost.replace(',', '.')) || 0,
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

const MATERIAL_UNITS: Unit[] = ['no', 'm', 'box', 'kg']

/** A stored material line in the editor: the number and unit, or the stored text when it is not a quantity. */
function materialDraft(line: VariationMaterialLine): MaterialLine {
  const q = variationMaterialQuantity(line as unknown as Record<string, unknown>)
  if (q.quantityValue == null) return { id: line.id, name: line.name, quantity: '', unit: 'no', legacyText: line.quantity }
  const unit = (MATERIAL_UNITS as string[]).includes(q.unit) ? (q.unit as Unit) : 'no'
  return { id: line.id, name: line.name, quantity: String(q.quantityValue), unit }
}

function sameQuantity(stored: VariationMaterialLine, line: MaterialLine): boolean {
  const q = variationMaterialQuantity(stored as unknown as Record<string, unknown>)
  return q.quantityValue != null && String(q.quantityValue) === line.quantity && q.unit === line.unit
}

function VariationDrawer({
  row,
  canEdit,
  canStatus,
  viewerId,
  timeZone,
  money,
  onClose,
  onEdit,
  onStatus,
  onDelete,
  onRemoveEvidence,
  showRemovedEvidence,
  personName,
}: {
  row: Variation
  canEdit: boolean
  canStatus: boolean
  viewerId: string
  timeZone: string
  money: ((amount: number) => string) | null
  /** Rulebook 1.27.0 §24 `canViewRemovedEvidence`: admins only. */
  showRemovedEvidence: boolean
  personName: (userId: string) => string
  onClose: () => void
  /** Opens the editor; a status picked here and not saved is passed on and saved with the editor's Save. */
  onEdit: (status: VariationStatus) => void
  /** Saves the status picked here and closes the summary. */
  onStatus: (status: VariationStatus) => Promise<void>
  onDelete: () => Promise<void>
  onRemoveEvidence: (evidenceId: string) => Promise<void>
}) {
  const t = variationTotals(row)
  // Owner 25 Nov: the status buttons pick a status; Save (grey until it differs from the stored one) writes it.
  const [draftStatus, setDraftStatus] = useState<VariationStatus>(row.status)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => {
    setDraftStatus(row.status)
    setSaveError(null)
  }, [row.id, row.status])
  const statusChanged = draftStatus !== row.status
  const confirmSubmitted = () =>
    draftStatus !== 'submitted' || window.confirm('This variation has gone to the client. Its number will be locked.')
  const close = () => {
    if (statusChanged && !window.confirm('Discard the status change?')) return
    onClose()
  }
  const save = async () => {
    if (!statusChanged || saving || !confirmSubmitted()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onStatus(draftStatus)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'The status was not saved. Try again.')
    } finally {
      setSaving(false)
    }
  }
  const when = (date: Date | null | undefined) => (date ? variationDateText(date.getTime(), timeZone) : '')
  const section = (title: string, empty: boolean, children: React.ReactNode) => (
    <section className="mt-4">
      <h3 className="h2">{title}</h3>
      {empty ? <p className="muted small">None</p> : children}
    </section>
  )
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={`${row.voNumber} ${row.heading}`}>
      <aside className="h-full w-full max-w-md overflow-auto bg-(--card) p-5 shadow-xl">
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <h2 className="h2 grow">{row.voNumber}</h2>
          <span className="pill dot" data-hue={STATUS_HUE[row.status]}>{STATUS_LABEL[row.status]}</span>
          <button type="button" className="btn sm ghost" onClick={close}>Close</button>
        </div>
        <p className="mt-2 font-semibold">{row.heading}</p>
        {row.description ? <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{row.description}</p> : null}
        <div className="row mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">{hoursText(t.labourHours)} labour</span>
          <span className="pill">{t.evidenceCount} evidence</span>
          {money ? <span className="pill" data-hue="proj">{money(t.costTotal)}</span> : null}
        </div>
        {canStatus ? (
          <div className="stack mt-3" style={{ gap: 4 }}>
            <span className="eyebrow">Status</span>
            <VariationStatusButtons label={`Status of ${row.voNumber}`} value={draftStatus} onChange={setDraftStatus} disabled={saving} />
          </div>
        ) : null}
        <p className="mt-2 small">{VARIATION_STATUS_COPY[draftStatus]}</p>
        {saveError ? <p className="mt-2 small" role="alert" style={{ color: 'var(--red, #b42318)' }}>{saveError}</p> : null}
        {section(
          'Labour',
          row.labour.length === 0,
          row.labour.map((line) => (
            <p key={line.id}>
              {line.trade} · {variationLabourText(line)}
            </p>
          ))
        )}
        {section(
          'Materials',
          row.materials.length === 0,
          row.materials.map((line) => (
            <p key={line.id}>
              {line.name} · {line.quantity}
            </p>
          ))
        )}
        {section(
          'Custom items',
          row.customLines.length === 0,
          row.customLines.map((line) => (
            <p key={line.id}>
              <b>{line.name}</b> · {line.quantity} × {money ? money(line.cost) : '—'}
              {money ? ` = ${money(variationLineTotal(line))}` : ''}
              {line.description ? <span className="muted small" style={{ display: 'block' }}>{line.description}</span> : null}
            </p>
          ))
        )}
        {section(
          'Subcontractors',
          row.subcontractorLines.length === 0,
          row.subcontractorLines.map((line) => (
            <p key={line.id}>
              <b>{line.name}</b>
              {line.quoteNumber ? ` · Quote ${line.quoteNumber}` : ''} · {line.quantity} × {money ? money(line.cost) : '—'}
              {money ? ` = ${money(variationLineTotal(line))}` : ''}
            </p>
          ))
        )}
        <section className="mt-4">
          <h3 className="h2">Evidence</h3>
          {row.evidence.length === 0 ? <p className="muted small">No evidence yet</p> : null}
          <div className="grid g2">
            {row.evidence.map((file) => (
              <div key={file.id} className="card pad">
                <a href={safeExternalUrl(file.downloadURL) ?? undefined} target="_blank" rel="noreferrer">
                  {file.contentType.startsWith('image/') && safeExternalUrl(file.downloadURL) ? (
                    <img src={safeExternalUrl(file.downloadURL) ?? undefined} alt={file.fileName} style={{ width: '100%', borderRadius: 8 }} />
                  ) : null}
                  {file.fileName}
                </a>
                {file.uploadedByUid !== viewerId ? (
                  <div>
                    <ReportFileLink fileRef={file.storagePath || file.downloadURL} surface="variation_evidence" parentId={row.id} fileName={file.fileName} />
                  </div>
                ) : null}
                {canEdit || file.uploadedByUid === viewerId ? (
                  <button type="button" className="btn sm ghost" onClick={() => void onRemoveEvidence(file.id)}>
                    Remove file
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        {showRemovedEvidence && (row.removedEvidence?.length ?? 0) > 0 ? (
          <>
            {/* Rulebook 1.27.0 §24: evidence unlinked from this variation, for an admin to find and restore. */}
            <h3 className="h2 mt-4">{removedEvidenceHeading(row.removedEvidence?.length ?? 0)}</h3>
            {(row.removedEvidence ?? []).map((item, index) => (
              <div key={`${item.path}-${index}`} className="card pad mt-2">
                <b>{item.name}</b>
                <p className="xs muted" style={{ wordBreak: 'break-all' }}>{item.path}</p>
                <p className="xs">
                  Removed by {personName(item.removedBy)}
                  {item.removedAt ? ` on ${when(item.removedAt)}` : ''}
                </p>
              </div>
            ))}
          </>
        ) : null}
        <h3 className="h2 mt-4">History</h3>
        <p>Raised by {row.createdByName} on {when(row.createdAt)}</p>
        {row.statusHistory.map((item, index) => (
          <p key={`${item.status}-${index}`}>{STATUS_LABEL[item.status as VariationStatus] ?? item.status} · {item.byName} · {when(item.at)}</p>
        ))}
        {row.numberHistory.map((item, index) => (
          <p key={`${item.from}-${index}`}>Renumbered {item.from} → {item.to} · {when(item.at)}</p>
        ))}
        <div className="row mt-4" style={{ gap: 8 }}>
          {canStatus ? (
            <button
              type="button"
              className="btn sm primary"
              disabled={!statusChanged || saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                if (statusChanged && !confirmSubmitted()) return
                onEdit(draftStatus)
              }}
            >
              Edit
            </button>
          ) : null}
          {canEdit ? <button type="button" className="btn sm ghost" onClick={() => void onDelete()}>Remove</button> : null}
        </div>
      </aside>
    </div>
  )
}

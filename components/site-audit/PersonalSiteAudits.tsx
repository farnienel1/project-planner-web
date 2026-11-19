'use client'

/**
 * Rulebook 1.30.0 §26: Site audits → Personal. The signed-in person's own audits only (owner-only security rules); job
 * number and job name are free text, not linked to any job, and print on the audit. Rules and shapes are
 * `personalSiteAudits.ts`; this file only shows them.
 */
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  PERSONAL_SITE_AUDIT_CREATE_LABEL,
  PERSONAL_SITE_AUDIT_PRIVATE_NOTE,
  PERSONAL_SITE_AUDIT_SECTION_LABEL,
  personalSiteAuditTitle,
  personalSiteAuditValidationError,
  personalSiteAuditsFor,
  type PersonalSiteAudit,
} from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import { uploadLimitError, uploadPickError } from '@/lib/security/uploadLimits'
import { SITE_AUDIT_TYPES } from '@/components/projects/features/featureUi'
import { listenPersonalSiteAudits, storedFileBytes, storedFileUrl } from '@/lib/payeClaims/payeClaimsData'
import { sendSiteAudit, useSiteAuditOutbox } from '@/lib/siteAudit/siteAuditSender'
import { outboxSummary, type SiteAuditOutboxRecord } from '@/lib/siteAudit/siteAuditOutbox'
import { UnsentSiteAudits } from '@/components/site-audit/UnsentSiteAudits'
import { SiteAuditFieldCounter } from '@/components/site-audit/SiteAuditFieldCounter'
import { siteAuditFieldLimitError } from '@/lib/canonical'

import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { loadExportModule } from '@/lib/pdf/loadExportModule'

// The PDF builders (pdf-lib) load only when a PDF is made.
const buildPersonalSiteAuditPdf: typeof import('@/lib/payeClaims/payeClaimReportPdf').buildPersonalSiteAuditPdf = (...args) =>
  loadExportModule(() => import('@/lib/payeClaims/payeClaimReportPdf')).then((module) => module.buildPersonalSiteAuditPdf(...args))

/** Live list of the signed-in person's personal audits (never anyone else's). */
export function usePersonalSiteAudits(): { audits: PersonalSiteAudit[]; loaded: boolean; error: string | null } {
  const { organization, user } = useAuthStore()
  const timeZone = useOrganizationTimeZone()
  const [audits, setAudits] = useState<PersonalSiteAudit[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const orgId = organization?.id
  const uid = user?.id
  useEffect(() => {
    if (!orgId || !uid) return
    return listenPersonalSiteAudits(
      orgId,
      uid,
      timeZone,
      (rows) => {
        setAudits(personalSiteAuditsFor(rows, uid))
        setLoaded(true)
      },
      (e) => setError(e.message)
    )
  }, [orgId, uid, timeZone])
  return { audits, loaded, error }
}

function AuditPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    storedFileUrl(path)
      .then((value) => live && setUrl(value))
      .catch(() => live && setUrl(null))
    return () => {
      live = false
    }
  }, [path])
  return url ? <img src={url} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 240 }} /> : null
}

function PersonalAuditDetail({ audit, onClose }: { audit: PersonalSiteAudit; onClose: () => void }) {
  const timeZone = useOrganizationTimeZone()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label="Personal site audit">
      <div className="card pad stack w-full max-w-2xl" style={{ gap: 10, maxHeight: '92vh', overflowY: 'auto' }}>
        <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
          Done
        </button>
        <b>{personalSiteAuditTitle(audit)}</b>
        <p className="muted small">
          Job number {audit.jobNumber || '—'} · Job name {audit.jobName} · {audit.authorName} · {audit.items.length} item(s)
        </p>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            buildPersonalSiteAuditPdf(audit, { timeZone, readFile: storedFileBytes })
              .then((bytes) => downloadPdf(bytes, `personal-site-audit-${audit.date || 'audit'}.pdf`))
              .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The PDF could not be made.'))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? 'Making PDF…' : 'Download PDF'}
        </button>
        {error ? <p className="small" style={{ color: 'var(--red)' }}>{error}</p> : null}
        {audit.items.map((item, index) => (
          <div key={item.id} className="card pad stack" style={{ gap: 4 }}>
            <b className="small">
              {index + 1}. {item.title}
            </b>
            {item.location ? <span className="muted small">{item.location}</span> : null}
            {item.comments ? <span className="small">{item.comments}</span> : null}
            {item.imagePath ? <AuditPhoto path={item.imagePath} /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The Personal list: Create Personal Site Audit, then the person's audits, newest first. */
export function PersonalSiteAuditsView({ onBack }: { onBack: () => void }) {
  const { audits, loaded, error } = usePersonalSiteAudits()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<PersonalSiteAudit | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="btn sm ghost" aria-label="Back">
          Back
        </button>
        <h2 className="text-lg font-bold">{PERSONAL_SITE_AUDIT_SECTION_LABEL}</h2>
      </div>
      <p className="muted small">{PERSONAL_SITE_AUDIT_PRIVATE_NOTE}</p>
      <button type="button" className="btn primary w-full" onClick={() => setCreating(true)}>
        {PERSONAL_SITE_AUDIT_CREATE_LABEL}
      </button>
      <UnsentSiteAudits kind="personal" />
      {error ? <p className="muted">{error}</p> : null}
      {!loaded && !error ? <p className="muted">Loading…</p> : null}
      {loaded && audits.length === 0 ? <p className="muted">No personal site audits yet.</p> : null}
      <div className="space-y-2">
        {audits.map((audit) => (
          <button key={audit.id} type="button" className="w-full card px-4 py-3.5 text-left" onClick={() => setOpen(audit)}>
            <b className="text-sm">{personalSiteAuditTitle(audit)}</b>
            <p className="muted small">
              {audit.items.length} item{audit.items.length === 1 ? '' : 's'}
            </p>
          </button>
        ))}
      </div>
      {creating ? <PersonalSiteAuditCreateFlow onClose={() => setCreating(false)} /> : null}
      {open ? <PersonalAuditDetail audit={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

type DraftItem = { id: string; title: string; location: string; comments: string; photo: File; previewUrl: string; takenAt: Date }

/** Create Personal Site Audit: free-text job number and job name, type, date, then photos with a title each. */
export function PersonalSiteAuditCreateFlow({ onClose }: { onClose: () => void }) {
  const { organization, user } = useAuthStore()
  const timeZone = useOrganizationTimeZone()
  const [jobNumber, setJobNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [type, setType] = useState('General')
  const [customTitle, setCustomTitle] = useState('')
  const [date, setDate] = useState(() => dayKeyInZone(new Date(), timeZone))
  const [items, setItems] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [auditId] = useState(() => newUuid())
  const outbox = useSiteAuditOutbox(organization?.id, user?.id, { kind: 'personal' })
  const sending = outbox.find((record) => record.id === auditId)
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), [])
  const authorName = user ? `${user.firstName} ${user.surname}`.trim() || user.email : ''

  const addPhotos = async (list: FileList | null) => {
    if (!list?.length) return
    setError(null)
    const next: DraftItem[] = []
    for (const file of Array.from(list)) {
      const limit = uploadPickError(file, 'siteAudit')
      if (limit) {
        setError(limit)
        return
      }
      let prepared: Awaited<ReturnType<typeof prepareAuditPhoto>>
      try {
        prepared = await prepareAuditPhoto(file)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'This photo could not be added.')
        return
      }
      const afterLimit = uploadLimitError(prepared.file, 'siteAudit')
      if (afterLimit) {
        setError(afterLimit)
        return
      }
      next.push({ id: newUuid(), title: '', location: '', comments: '', photo: prepared.file, previewUrl: prepared.previewUrl, takenAt: prepared.takenAt })
    }
    setItems((current) => [...current, ...next])
  }

  const patch = (id: string, partial: Partial<DraftItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))

  const submit = async () => {
    if (!organization?.id || !user) return
    const shapeError = personalSiteAuditValidationError({
      jobNumber,
      jobName,
      date,
      items: items.map((item) => ({ id: item.id, title: item.title })),
    })
    if (shapeError) {
      setError(shapeError)
      return
    }
    const limitError =
      siteAuditFieldLimitError({ customTitle }) ?? items.map((item) => siteAuditFieldLimitError({ title: item.title, location: item.location, comments: item.comments })).find((m) => m) ?? null
    if (limitError) {
      setError(limitError)
      return
    }
    setError(null)
    // Owner bug 17 Nov: kept in this browser before any upload; listed as "Not sent" with Retry until saved.
    const record: SiteAuditOutboxRecord = {
      id: auditId,
      kind: 'personal',
      organizationId: organization.id,
      userId: user.id,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      meta: { type, customTitle, date, authorName, jobNumber, jobName },
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        location: item.location,
        comments: item.comments,
        assignee: '',
        annotations: '',
        takenAtMs: item.takenAt.getTime(),
        photo: item.photo,
        fileName: item.photo.name,
        upload: { itemId: item.id, status: 'pending', progress: 0, attempts: 0 },
      })),
    }
    setSaving('Uploading photos')
    const result = await sendSiteAudit(record)
    setSaving(null)
    if (result.saved) {
      onClose()
      return
    }
    setError(`${result.error ?? 'The audit was not sent.'} It is kept on this device as "Not sent" — you can close this and retry from the list.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-label={PERSONAL_SITE_AUDIT_CREATE_LABEL}>
      <div className="card pad stack w-full max-w-lg" style={{ gap: 10, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Cancel
          </button>
          <b>{PERSONAL_SITE_AUDIT_CREATE_LABEL}</b>
          <span style={{ width: 60 }} />
        </div>
        <p className="muted small">{PERSONAL_SITE_AUDIT_PRIVATE_NOTE} Not linked to any job.</p>
        {error ? <p className="small" style={{ color: 'var(--red)' }}>{error}</p> : null}
        <label className="small">
          Job number
          <input className="input" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
          <SiteAuditFieldCounter field="jobNumber" value={jobNumber} />
        </label>
        <label className="small">
          Job name
          <input className="input" value={jobName} onChange={(e) => setJobName(e.target.value)} />
          <SiteAuditFieldCounter field="jobName" value={jobName} />
        </label>
        <label className="small">
          Audit type
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {SITE_AUDIT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="small">
          Title (optional)
          <input className="input" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
          <SiteAuditFieldCounter field="customTitle" value={customTitle} />
        </label>
        <label className="small">
          Date
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {items.map((item, index) => (
          <div key={item.id} className="card pad stack" style={{ gap: 6 }}>
            <span className="small muted">PHOTO {index + 1} · Taken {format(item.takenAt, 'd MMM yyyy, HH:mm')}</span>
            <img src={item.previewUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
            <input className="input" placeholder="Title" aria-label="Title" value={item.title} onChange={(e) => patch(item.id, { title: e.target.value })} />
            <SiteAuditFieldCounter field="title" value={item.title} />
            <input className="input" placeholder="Location" aria-label="Location" value={item.location} onChange={(e) => patch(item.id, { location: e.target.value })} />
            <SiteAuditFieldCounter field="location" value={item.location} />
            <textarea className="input" placeholder="Comments" aria-label="Comments" rows={2} value={item.comments} onChange={(e) => patch(item.id, { comments: e.target.value })} />
            <SiteAuditFieldCounter field="comments" value={item.comments} />
            <button type="button" className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>
              Remove
            </button>
          </div>
        ))}
        <label className="btn">
          + Add photos
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />
        </label>
        <button type="button" className="btn primary" disabled={Boolean(saving)} onClick={() => void submit()}>
          {saving ? (sending ? outboxSummary(sending).label : saving) : 'Save audit'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { FormInput, FormLabel, FormTextarea } from '@/components/forms/FormShell'
import { SITE_AUDIT_TYPES } from '@/components/projects/features/featureUi'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import type { Project } from '@/types'
import { isPlausibleDayKey } from '@/lib/security/boundedValue'
import { uploadLimitError, uploadPickError } from '@/lib/security/uploadLimits'
import { sendSiteAudit, useSiteAuditOutbox } from '@/lib/siteAudit/siteAuditSender'
import { SITE_AUDIT_FIELD_LABELS, siteAuditFieldLimitError } from '@/lib/canonical'
import { SiteAuditFieldCounter } from '@/components/site-audit/SiteAuditFieldCounter'
import type { SiteAuditOutboxRecord } from '@/lib/siteAudit/siteAuditOutbox'
import { uploadSummary, type PhotoUpload } from '@/lib/siteAudit/auditPhotoUploads'

type DraftItem = {
  id: string
  title: string
  location: string
  comments: string
  assignee: string
  annotations: string
  photo: File
  previewUrl: string
  takenAt: Date
  detailsAdded: boolean
}

type Props = {
  project: Project
  onClose: () => void
  onCreated: () => void
}

export function SiteAuditCreateFlow({ project, onClose, onCreated }: Props) {
  const { organization, user } = useAuthStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [auditType, setAuditType] = useState('General')
  const [customTitle, setCustomTitle] = useState('')
  const [auditDate, setAuditDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [visibleToOperatives, setVisibleToOperatives] = useState(true)
  const [items, setItems] = useState<DraftItem[]>([])
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  /** One id per audit, kept across Retry so photos already uploaded are not sent again. */
  const [auditId] = useState(() => newUuid())
  const [uploads, setUploads] = useState<Record<string, PhotoUpload>>({})
  const outbox = useSiteAuditOutbox(organization?.id, user?.id)
  const sending = outbox.find((record) => record.id === auditId)
  const livePhotos = sending ? sending.items.map((item) => item.upload) : Object.values(uploads)
  const liveSummary = uploadSummary(livePhotos)
  const photoState = (id: string): PhotoUpload | undefined => sending?.items.find((item) => item.id === id)?.upload ?? uploads[id]
  const [error, setError] = useState<string | null>(null)

  const authorName = user ? `${user.firstName} ${user.surname}`.trim() || user.email : 'Unknown'
  const itemsRef = useRef(items)
  itemsRef.current = items
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl)
    }
  }, [])

  const addPhotos = async (list: FileList | null) => {
    if (!list?.length) return
    setPreparing(true)
    setError(null)
    try {
      const next: DraftItem[] = []
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/')) {
          setError('Choose a photo. PDF and other documents cannot be added as an audit image.')
          return
        }
        const sizeError = uploadPickError(file, 'siteAudit')
        if (sizeError) {
          setError(sizeError)
          return
        }
        const prepared = await prepareAuditPhoto(file)
        const afterError = uploadLimitError(prepared.file, 'siteAudit')
        if (afterError) {
          setError(afterError)
          return
        }
        next.push({
          id: newUuid(),
          title: '',
          location: '',
          comments: '',
          assignee: '',
          annotations: '',
          photo: prepared.file,
          previewUrl: prepared.previewUrl,
          takenAt: prepared.takenAt,
          detailsAdded: false,
        })
      }
      setItems((current) => [...current, ...next])
      const firstId = next[0]?.id
      if (firstId) {
        window.setTimeout(() => {
          cardRefs.current[firstId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 60)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not prepare those photos.')
    } finally {
      setPreparing(false)
    }
  }

  const patch = (id: string, partial: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))
  }

  const confirmDetails = (id: string) => {
    const item = items.find((row) => row.id === id)
    if (!item) return
    if (!item.title.trim()) {
      setError('Add a title for this photo before moving on.')
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setError(null)
    const index = items.findIndex((row) => row.id === id)
    setItems((current) => current.map((row) => (row.id === id ? { ...row, detailsAdded: true } : row)))
    const following = items[index + 1]
    if (following) {
      window.setTimeout(() => {
        cardRefs.current[following.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 40)
      return
    }
    window.setTimeout(() => {
      document.getElementById('audit-submit')?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 40)
  }

  const removeItem = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  const submit = async () => {
    if (!organization?.id || !user) return
    if (items.length === 0) {
      setError('Add at least one photo.')
      return
    }
    const missing = items.find((item) => !item.title.trim())
    if (missing) {
      cardRefs.current[missing.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setError('Each photo needs a title before the audit can be saved.')
      return
    }
    const limitError =
      siteAuditFieldLimitError({ customTitle }) ??
      items.map((item) => siteAuditFieldLimitError(item)).find((message) => message) ??
      null
    if (limitError) {
      setError(limitError)
      return
    }
    if (!isPlausibleDayKey(auditDate)) {
      setError('Enter a valid audit date.')
      return
    }

    setSaving(true)
    setError(null)
    // Owner bug 17 Nov: the audit (text, items, photos) is kept in this browser BEFORE any upload, so a stuck or
    // failed photo never loses it. It stays listed as "Not sent" with Retry until the save succeeds.
    const record: SiteAuditOutboxRecord = {
      id: auditId,
      kind: 'project',
      organizationId: organization.id,
      userId: user.id,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      project: { id: project.id, jobNumber: project.jobNumber, siteName: project.siteName },
      meta: { type: auditType, customTitle: customTitle.trim(), date: auditDate, authorName, visibleToOperatives },
      items: items.map((item) => ({
        id: item.id,
        title: item.title.trim(),
        location: item.location.trim(),
        comments: item.comments.trim(),
        assignee: item.assignee.trim(),
        annotations: item.annotations.trim(),
        takenAtMs: item.takenAt.getTime(),
        photo: item.photo,
        fileName: item.photo.name,
        upload: uploads[item.id] ?? { itemId: item.id, status: 'pending', progress: 0, attempts: 0 },
      })),
    }
    const result = await sendSiteAudit(record)
    setSaving(false)
    if (result.saved) {
      onCreated()
      onClose()
      return
    }
    setUploads(Object.fromEntries(result.record.items.map((item) => [item.id, item.upload])))
    setError(`${result.error ?? 'The audit was not sent.'} It is kept on this device as "Not sent" — you can close this and retry from the audit list.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--card)] p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-[var(--ink)]">New site audit</p>
            <p className="text-xs text-[var(--ink3)]">Step {step} of 2 · {project.siteName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--ink3)]" aria-label="Close">
            ✕
          </button>
        </div>

        {saving ? (
          <p className="mb-3 rounded-lg bg-[var(--blue-t)] px-3 py-2 text-xs font-medium text-[var(--blue)]">
            {liveSummary.label}. You can close this — the audit keeps uploading and stays listed until it is saved.
          </p>
        ) : null}
        {error ? <p className="mb-3 rounded-lg bg-[var(--red-t)] px-3 py-2 text-xs font-medium text-[var(--red)]">{error}</p> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <FormLabel>Audit type</FormLabel>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {SITE_AUDIT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAuditType(type)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      auditType === type
                        ? 'border-[var(--blue)] bg-[var(--blue-t)] text-[var(--blue)]'
                        : 'border-[var(--line)] bg-[var(--card)] text-[var(--ink2)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <FormInput value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Plant room snags" />
            <SiteAuditFieldCounter field="customTitle" value={customTitle} />
            <div>
              <FormLabel>Author</FormLabel>
              <p className="rounded-xl border border-[var(--line)] bg-[var(--soft)] px-3 py-2 text-sm text-[var(--ink)]">{authorName}</p>
            </div>
            <div>
              <FormLabel>Date</FormLabel>
              <FormInput type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--ink2)]">
              <input
                type="checkbox"
                checked={visibleToOperatives}
                onChange={(e) => setVisibleToOperatives(e.target.checked)}
              />
              Visible to operatives
            </label>
            <p className="text-xs text-[var(--ink3)]">Ops working on this job can view it.</p>
            <button type="button" onClick={() => setStep(2)} className="w-full rounded-xl bg-[var(--blue)] py-2.5 text-sm font-bold text-white">
              Next: add items and photos
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--ink)]">Items · {items.length}</h3>
            </div>
            <p className="text-xs text-[var(--ink3)]">
              Photos get auto-timestamped so the report shows when each was taken.
            </p>
            {preparing ? <p className="text-sm font-semibold text-[var(--ink2)]">Preparing photos — this may take a moment for large batches.</p> : null}

            {items.length === 0 && !preparing ? (
              <div className="rounded-2xl border border-dashed border-[var(--line2)] px-4 py-8 text-center">
                <p className="font-semibold text-[var(--ink)]">No items yet</p>
                <p className="mt-1 text-sm text-[var(--ink3)]">
                  Tap Add item for one photo, then its details. Multi-add stacks several photos so you can scroll down through each one.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <article
                    key={item.id}
                    ref={(node) => {
                      cardRefs.current[item.id] = node
                    }}
                    className={`scroll-mt-4 space-y-2 rounded-2xl border p-3 ${
                      item.detailsAdded ? 'border-[var(--proj)] bg-[var(--card)]' : 'border-[var(--line)] bg-[var(--soft)]'
                    }`}
                  >
                    <p className="text-xs font-bold tracking-wide text-[var(--ink3)]">PHOTO {index + 1}</p>
                    <img src={item.previewUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />
                    <p className="text-xs font-semibold text-[var(--ink2)]">Taken {format(item.takenAt, 'd MMM yyyy, HH:mm')}</p>
                    <PhotoUploadLine upload={photoState(item.id)} />
                    <FormLabel>{SITE_AUDIT_FIELD_LABELS.title}</FormLabel>
                    <FormInput value={item.title} onChange={(e) => patch(item.id, { title: e.target.value, detailsAdded: false })} placeholder="e.g. Front courtyard" />
                    <SiteAuditFieldCounter field="title" value={item.title} />
                    <FormLabel>{SITE_AUDIT_FIELD_LABELS.location}</FormLabel>
                    <FormInput value={item.location} onChange={(e) => patch(item.id, { location: e.target.value })} placeholder="e.g. Front entrance courtyard" />
                    <SiteAuditFieldCounter field="location" value={item.location} />
                    <FormLabel>{SITE_AUDIT_FIELD_LABELS.comments}</FormLabel>
                    <FormTextarea value={item.comments} onChange={(e) => patch(item.id, { comments: e.target.value })} rows={3} />
                    <SiteAuditFieldCounter field="comments" value={item.comments} />
                    <FormLabel>{SITE_AUDIT_FIELD_LABELS.assignee}</FormLabel>
                    <FormInput value={item.assignee} onChange={(e) => patch(item.id, { assignee: e.target.value })} placeholder="Assignee name" />
                    <SiteAuditFieldCounter field="assignee" value={item.assignee} />
                    <FormLabel>{SITE_AUDIT_FIELD_LABELS.annotations}</FormLabel>
                    <FormTextarea value={item.annotations} onChange={(e) => patch(item.id, { annotations: e.target.value })} rows={2} />
                    <SiteAuditFieldCounter field="annotations" value={item.annotations} />
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="text-sm font-semibold text-[var(--red)]" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDetails(item.id)}
                        className="rounded-xl bg-[var(--blue)] px-3 py-2 text-sm font-bold text-white"
                      >
                        {item.detailsAdded ? 'Details added' : 'Add these details'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="cursor-pointer rounded-xl border border-[var(--blue)] py-2.5 text-center text-sm font-bold text-[var(--blue)]">
                + Add item
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    void addPhotos(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
              <label className="cursor-pointer rounded-xl border border-[var(--blue)] py-2.5 text-center text-sm font-bold text-[var(--blue)]">
                Multi-add
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    void addPhotos(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
            </div>

            <div className="flex gap-2" id="audit-submit">
              <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink2)]">
                Back
              </button>
              <button
                type="button"
                disabled={saving || preparing}
                onClick={() => void submit()}
                className="flex-1 rounded-xl bg-[var(--blue)] py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? liveSummary.label : Object.keys(uploads).length ? 'Retry' : 'Submit audit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PhotoUploadLine({ upload }: { upload: PhotoUpload | undefined }) {
  if (!upload) return null
  if (upload.status === 'done') return <p className="text-xs font-semibold text-[var(--proj)]">Uploaded</p>
  if (upload.status === 'failed') return <p className="text-xs font-semibold text-[var(--red)]">Not uploaded — {upload.error}</p>
  if (upload.status === 'uploading') {
    return (
      <p className="text-xs font-semibold text-[var(--ink2)]">
        Uploading {Math.round(upload.progress * 100)}%{upload.attempts > 1 ? ` (try ${upload.attempts})` : ''}
      </p>
    )
  }
  return <p className="text-xs text-[var(--ink3)]">Waiting to upload</p>
}

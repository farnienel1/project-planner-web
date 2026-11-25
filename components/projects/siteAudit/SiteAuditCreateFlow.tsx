'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { FormInput, FormLabel, FormTextarea } from '@/components/forms/FormShell'
import { SITE_AUDIT_TYPES } from '@/components/projects/features/featureUi'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import type { Project } from '@/types'
import { uploadLimitError, uploadPickError } from '@/lib/security/uploadLimits'
import { sendSiteAudit, useSiteAuditOutbox } from '@/lib/siteAudit/siteAuditSender'
import { SITE_AUDIT_FIELD_LABELS } from '@/lib/canonical'
import { SiteAuditFieldCounter } from '@/components/site-audit/SiteAuditFieldCounter'
import { uploadSummary, type PhotoUpload } from '@/lib/siteAudit/auditPhotoUploads'
import {
  SITE_AUDIT_LEAVE_CONFIRM_MESSAGE,
  siteAuditAfterSend,
  siteAuditDateText,
  siteAuditDefaultDate,
  siteAuditDraftProblem,
  siteAuditHasUnsavedWork,
  siteAuditOutboxRecord,
  personalSiteAuditDraftProblem,
  personalSiteAuditOutboxRecord,
  type SiteAuditDraftItem,
} from '@/lib/siteAudit/siteAuditCreateDraft'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { SiteAuditSteps } from '@/components/site-audit/SiteAuditSteps'
import { useUnsavedChangesGuard } from '@/lib/navigation/useUnsavedChangesGuard'

type DraftItem = SiteAuditDraftItem

type Props = {
  /** A project or small works audit: the job picked on step 1. */
  project?: Project
  /** A personal audit (rulebook §26): the free-text job number and name typed on step 1, not linked to any job. */
  personal?: { jobNumber: string; jobName: string }
  /** Leave the page (Cancel, or after the audit is saved). */
  onClose: () => void
  onCreated: () => void
  /** The page let the person pick the job (step 1): Back from Details returns to it. */
  onChangeJob?: () => void
  /** Told whenever leaving would lose photos or details (so the page's own back link can ask first). */
  onUnsavedChange?: (unsaved: boolean) => void
}

/**
 * New site audit, steps 2–4 of the page (owner request 23 Nov): Details, Photos, Review & save. Step 1 (the job) is
 * the page's. Fields, checks, the record and the save are exactly the former dialog's (`siteAuditDraftProblem`,
 * `siteAuditOutboxRecord`, `sendSiteAudit`).
 */
export function SiteAuditCreateFlow({ project, personal, onClose, onCreated, onChangeJob, onUnsavedChange }: Props) {
  const { organization, user } = useAuthStore()

  const [step, setStep] = useState<2 | 3 | 4>(2)
  const [auditType, setAuditType] = useState('General')
  const [customTitle, setCustomTitle] = useState('')
  const timeZone = useOrganizationTimeZone()
  // Today in the organisation zone (guardrail 2), stored as yyyy-MM-dd as before.
  const [auditDate, setAuditDate] = useState(() => siteAuditDefaultDate(Date.now(), timeZone))
  const [visibleToOperatives, setVisibleToOperatives] = useState(true)
  const [items, setItems] = useState<DraftItem[]>([])
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  /** One id per audit, kept across Retry so photos already uploaded are not sent again. */
  const [auditId] = useState(() => newUuid())
  const [uploads, setUploads] = useState<Record<string, PhotoUpload>>({})
  const outbox = useSiteAuditOutbox(organization?.id, user?.id, personal ? { kind: 'personal' } : undefined)
  const sending = outbox.find((record) => record.id === auditId)
  const livePhotos = sending ? sending.items.map((item) => item.upload) : Object.values(uploads)
  const liveSummary = uploadSummary(livePhotos)
  const photoState = (id: string): PhotoUpload | undefined => sending?.items.find((item) => item.id === id)?.upload ?? uploads[id]
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  // Photos or a typed title not yet saving or kept on this device would be lost by leaving: ask first.
  const unsaved = siteAuditHasUnsavedWork({
    itemCount: items.length,
    customTitle,
    saving,
    keptOnDevice: Boolean(sending) || Object.keys(uploads).length > 0,
  })
  useEffect(() => {
    onUnsavedChange?.(unsaved)
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, onUnsavedChange])
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange])
  // Owner decision 23 Nov: every in-app link (sidebar, job tabs, header) and the command palette ask the same
  // question while photos or details would be lost; never once the save has started.
  useUnsavedChangesGuard(unsaved, SITE_AUDIT_LEAVE_CONFIRM_MESSAGE)
  const leaveIfConfirmed = (go: () => void) => {
    if (unsaved && !window.confirm(SITE_AUDIT_LEAVE_CONFIRM_MESSAGE)) return
    go()
  }
  const cancel = () => leaveIfConfirmed(onClose)

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

  /** The save's own checks; a photo without a title takes the person back to it. */
  const blockingProblem = () => {
    const problem = siteAuditDraftProblem({ items, customTitle, auditDate })
    if (!problem) {
      // A personal audit also passes the rulebook's own check (job name, date, photo titles, field limits).
      const personalProblem = personal
        ? personalSiteAuditDraftProblem({ jobNumber: personal.jobNumber, jobName: personal.jobName, customTitle, auditDate, items })
        : null
      if (!personalProblem) return false
      setStep(2)
      setError(personalProblem)
      return true
    }
    // Back to the step holding the field: Details for the audit title and date, Photos for the photos.
    setStep(problem.step)
    if (problem.itemId) {
      const itemId = problem.itemId
      window.setTimeout(() => cardRefs.current[itemId]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
    }
    setError(problem.message)
    return true
  }

  const goToReview = () => {
    if (blockingProblem()) return
    setError(null)
    setStep(4)
  }

  const submit = async () => {
    if (!organization?.id || !user) return
    if (blockingProblem()) return

    setSaving(true)
    setError(null)
    // Owner bug 17 Nov: the audit (text, items, photos) is kept in this browser BEFORE any upload, so a stuck or
    // failed photo never loses it. It stays listed as "Not sent" with Retry until the save succeeds.
    const base = { auditId, organizationId: organization.id, userId: user.id, nowMs: Date.now(), auditType, customTitle, auditDate, authorName, items, uploads }
    let record
    if (personal) {
      record = personalSiteAuditOutboxRecord({ ...base, jobNumber: personal.jobNumber, jobName: personal.jobName })
    } else if (project) {
      record = siteAuditOutboxRecord({ ...base, project, visibleToOperatives })
    } else {
      setSaving(false)
      return
    }
    const result = await sendSiteAudit(record)
    setSaving(false)
    if (result.saved) {
      // The person may have left the page while it uploaded: reload the list, but never pull them back.
      const after = siteAuditAfterSend({ saved: true, stillOnPage: mountedRef.current })
      if (after.reload) onCreated()
      if (after.leave) onClose()
      return
    }
    setUploads(Object.fromEntries(result.record.items.map((item) => [item.id, item.upload])))
    setError(`${result.error ?? 'The audit was not sent.'} It is kept on this device as "Not sent" — you can close this and retry from the audit list.`)
  }

  return (
    <div className="space-y-4">
      <SiteAuditSteps current={step} />
      <div className="pu-card sa-new-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-(--ink3)">Job</p>
            <p className="truncate text-sm font-bold text-(--ink)">
              {personal
                ? `${personal.jobNumber.trim() ? `${personal.jobNumber.trim()} · ` : ''}${personal.jobName.trim()}`
                : `${project?.jobNumber ? `${project.jobNumber} · ` : ''}${project?.siteName ?? ''}`}
            </p>
          </div>
          {onChangeJob && step === 2 ? (
            <button type="button" onClick={() => leaveIfConfirmed(() => onChangeJob())} className="pu-btn sm">
              Change job
            </button>
          ) : null}
        </div>

        {saving ? (
          <p className="mb-3 rounded-lg bg-(--blue-t) px-3 py-2 text-xs font-medium text-(--blue)">
            {liveSummary.label}. You can leave this page — the audit keeps uploading and stays listed until it is saved.
          </p>
        ) : null}
        {error ? <p className="mb-3 rounded-lg bg-(--red-t) px-3 py-2 text-xs font-medium text-(--red)">{error}</p> : null}

        {step === 2 ? (
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
                        ? 'border-(--blue) bg-(--blue-t) text-(--blue)'
                        : 'border-(--line) bg-(--card) text-(--ink2)'
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
              <p className="rounded-xl border border-(--line) bg-(--soft) px-3 py-2 text-sm text-(--ink)">{authorName}</p>
            </div>
            <div>
              <FormLabel>Date</FormLabel>
              <FormInput type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
            </div>
            {personal ? null : (
              <>
                <label className="flex items-center gap-2 text-sm text-(--ink2)">
                  <input
                    type="checkbox"
                    checked={visibleToOperatives}
                    onChange={(e) => setVisibleToOperatives(e.target.checked)}
                  />
                  Visible to operatives
                </label>
                <p className="text-xs text-(--ink3)">Ops working on this job can view it.</p>
              </>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={cancel} className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2)">
                Cancel
              </button>
              <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-xl bg-(--blue) py-2.5 text-sm font-bold text-white">
                Next: add items and photos
              </button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-(--ink)">Items · {items.length}</h3>
            </div>
            <p className="text-xs text-(--ink3)">
              Photos get auto-timestamped so the report shows when each was taken.
            </p>
            {preparing ? <p className="text-sm font-semibold text-(--ink2)">Preparing photos — this may take a moment for large batches.</p> : null}

            {items.length === 0 && !preparing ? (
              <div className="rounded-2xl border border-dashed border-(--line2) px-4 py-8 text-center">
                <p className="font-semibold text-(--ink)">No items yet</p>
                <p className="mt-1 text-sm text-(--ink3)">
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
                      item.detailsAdded ? 'border-(--proj) bg-(--card)' : 'border-(--line) bg-(--soft)'
                    }`}
                  >
                    <p className="text-xs font-bold tracking-wide text-(--ink3)">PHOTO {index + 1}</p>
                    <img src={item.previewUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />
                    <p className="text-xs font-semibold text-(--ink2)">Taken {format(item.takenAt, 'd MMM yyyy, HH:mm')}</p>
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
                    {/* A personal audit stores no assignee or annotations (rulebook §26), so they are not asked. */}
                    {personal ? null : (
                      <>
                        <FormLabel>{SITE_AUDIT_FIELD_LABELS.assignee}</FormLabel>
                        <FormInput value={item.assignee} onChange={(e) => patch(item.id, { assignee: e.target.value })} placeholder="Assignee name" />
                        <SiteAuditFieldCounter field="assignee" value={item.assignee} />
                        <FormLabel>{SITE_AUDIT_FIELD_LABELS.annotations}</FormLabel>
                        <FormTextarea value={item.annotations} onChange={(e) => patch(item.id, { annotations: e.target.value })} rows={2} />
                        <SiteAuditFieldCounter field="annotations" value={item.annotations} />
                      </>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="text-sm font-semibold text-(--red)" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDetails(item.id)}
                        className="rounded-xl bg-(--blue) px-3 py-2 text-sm font-bold text-white"
                      >
                        {item.detailsAdded ? 'Details added' : 'Add these details'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="cursor-pointer rounded-xl border border-(--blue) py-2.5 text-center text-sm font-bold text-(--blue)">
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
              <label className="cursor-pointer rounded-xl border border-(--blue) py-2.5 text-center text-sm font-bold text-(--blue)">
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
              <button type="button" onClick={cancel} className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2)">
                Cancel
              </button>
              <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2)">
                Back
              </button>
              <button
                type="button"
                disabled={saving || preparing}
                onClick={goToReview}
                className="flex-1 rounded-xl bg-(--blue) py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Next: review
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-(--ink)">Review</h3>
            <dl className="sa-review-list">
              <div>
                <dt>Audit type</dt>
                <dd>{auditType}</dd>
              </div>
              {customTitle.trim() ? (
                <div>
                  <dt>Title</dt>
                  <dd>{customTitle.trim()}</dd>
                </div>
              ) : null}
              <div>
                <dt>Author</dt>
                <dd>{authorName}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{siteAuditDateText(auditDate, timeZone)}</dd>
              </div>
              {personal ? null : (
                <div>
                  <dt>Visible to operatives</dt>
                  <dd>{visibleToOperatives ? 'Yes' : 'No'}</dd>
                </div>
              )}
            </dl>
            <h3 className="text-sm font-bold text-(--ink)">Items · {items.length}</h3>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-(--line) p-2">
                  <img src={item.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold tracking-wide text-(--ink3)">PHOTO {index + 1}</p>
                    <p className="truncate text-sm font-semibold text-(--ink)">{item.title.trim()}</p>
                    {item.location.trim() ? <p className="truncate text-xs text-(--ink3)">{item.location.trim()}</p> : null}
                    <PhotoUploadLine upload={photoState(item.id)} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={cancel} className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2)">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setStep(3)}
                className="rounded-xl border border-(--line) px-4 py-2.5 text-sm text-(--ink2) disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving || preparing}
                onClick={() => void submit()}
                className="flex-1 rounded-xl bg-(--blue) py-2.5 text-sm font-bold text-white disabled:opacity-50"
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
  if (upload.status === 'done') return <p className="text-xs font-semibold text-(--proj)">Uploaded</p>
  if (upload.status === 'failed') return <p className="text-xs font-semibold text-(--red)">Not uploaded — {upload.error}</p>
  if (upload.status === 'uploading') {
    return (
      <p className="text-xs font-semibold text-(--ink2)">
        Uploading {Math.round(upload.progress * 100)}%{upload.attempts > 1 ? ` (try ${upload.attempts})` : ''}
      </p>
    )
  }
  return <p className="text-xs text-(--ink3)">Waiting to upload</p>
}

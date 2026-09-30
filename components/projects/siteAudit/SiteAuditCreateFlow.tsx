'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { uploadFile, siteAuditImagePath } from '@/lib/firebase/storageUtils'
import { FormInput, FormLabel, FormTextarea } from '@/components/forms/FormShell'
import { SITE_AUDIT_TYPES } from '@/components/projects/features/featureUi'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { prepareAuditPhoto } from '@/lib/siteAudit/prepareAuditPhoto'
import type { Project } from '@/types'

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
  const { saveAudit } = useSiteAuditStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [auditType, setAuditType] = useState('General')
  const [customTitle, setCustomTitle] = useState('')
  const [auditDate, setAuditDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [visibleToOperatives, setVisibleToOperatives] = useState(true)
  const [items, setItems] = useState<DraftItem[]>([])
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)
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
        const prepared = await prepareAuditPhoto(file)
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

    setSaving(true)
    setError(null)
    try {
      const auditId = newUuid()
      const expanded = []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        setUploadLabel(`Uploading photo ${index + 1} of ${items.length}`)
        const path = siteAuditImagePath(organization.id, auditId, item.photo.name)
        const imageURL = await uploadFile(path, item.photo, item.photo.type || 'image/jpeg')
        expanded.push({
          title: item.title.trim(),
          location: item.location.trim(),
          assignee: item.assignee.trim(),
          comments: item.comments.trim(),
          annotations: item.annotations.trim(),
          imageURL,
          createdAt: item.takenAt,
        })
      }
      setUploadLabel('Saving audit')
      await saveAudit(organization.id, {
        id: auditId,
        projectId: project.id,
        projectJobNumber: project.jobNumber,
        projectName: project.siteName,
        type: auditType,
        customTitle: customTitle.trim() || undefined,
        authorName,
        date: new Date(auditDate),
        createdByUserId: user.id,
        visibleToOperatives,
        items: expanded,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save site audit')
    } finally {
      setSaving(false)
      setUploadLabel(null)
    }
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
                    <FormInput value={item.title} onChange={(e) => patch(item.id, { title: e.target.value, detailsAdded: false })} placeholder="Title, e.g. Front courtyard" />
                    <FormInput value={item.location} onChange={(e) => patch(item.id, { location: e.target.value })} placeholder="Location, e.g. Front entrance courtyard" />
                    <FormTextarea value={item.comments} onChange={(e) => patch(item.id, { comments: e.target.value })} placeholder="Notes…" rows={2} />
                    <FormInput value={item.assignee} onChange={(e) => patch(item.id, { assignee: e.target.value })} placeholder="Assignee name" />
                    <FormInput value={item.annotations} onChange={(e) => patch(item.id, { annotations: e.target.value })} placeholder="Notes on the photo" />
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
                {saving ? uploadLabel || 'Uploading…' : 'Submit audit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const authorName = user ? `${user.firstName} ${user.surname}`.trim() || user.email : 'Unknown'
  const editing = items.find((item) => item.id === editingId) || null
  const itemsRef = useRef(items)
  itemsRef.current = items

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
        })
      }
      setItems((current) => [...current, ...next])
      if (next.length === 1) setEditingId(next[0].id)
      else setEditingId(next[0]?.id || null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not prepare those photos.')
    } finally {
      setPreparing(false)
    }
  }

  const patch = (id: string, partial: Partial<DraftItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))
  }

  const removeItem = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
    setEditingId((current) => (current === id ? null : current))
  }

  const submit = async () => {
    if (!organization?.id || !user) return
    if (items.length === 0) {
      setError('Add at least one photo.')
      return
    }
    const missing = items.find((item) => !item.title.trim())
    if (missing) {
      setEditingId(missing.id)
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
                  Tap Add item for one entry, or Multi-add to pick several photos at once.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className={`overflow-hidden rounded-xl border text-left ${
                      editingId === item.id ? 'border-[var(--blue)]' : 'border-[var(--line)]'
                    }`}
                  >
                    <img src={item.previewUrl} alt="" className="h-28 w-full object-cover" />
                    <span className="block px-2 py-1.5 text-[11px] font-semibold text-[var(--ink)]">
                      {format(item.takenAt, 'd MMM yyyy, HH:mm')}
                    </span>
                    <span className="block truncate px-2 pb-2 text-xs text-[var(--ink3)]">{item.title || 'Add details'}</span>
                  </button>
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

            {editing ? (
              <div className="space-y-2 rounded-2xl bg-[var(--soft)] p-3">
                <img src={editing.previewUrl} alt="" className="max-h-48 w-full rounded-xl object-cover" />
                <p className="text-xs font-semibold text-[var(--ink2)]">Taken {format(editing.takenAt, 'd MMM yyyy, HH:mm')}</p>
                <FormInput value={editing.title} onChange={(e) => patch(editing.id, { title: e.target.value })} placeholder="Front courtyard" />
                <FormInput value={editing.location} onChange={(e) => patch(editing.id, { location: e.target.value })} placeholder="e.g. Front entrance courtyard" />
                <FormTextarea value={editing.comments} onChange={(e) => patch(editing.id, { comments: e.target.value })} placeholder="Notes…" rows={2} />
                <FormInput value={editing.assignee} onChange={(e) => patch(editing.id, { assignee: e.target.value })} placeholder="Assignee name" />
                <FormInput value={editing.annotations} onChange={(e) => patch(editing.id, { annotations: e.target.value })} placeholder="Notes on photo" />
                <button type="button" className="text-sm font-semibold text-[var(--red)]" onClick={() => removeItem(editing.id)}>
                  Remove this item
                </button>
              </div>
            ) : null}

            <div className="flex gap-2">
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

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { uploadFile, siteAuditImagePath } from '@/lib/firebase/storageUtils'
import { FormInput, FormLabel, FormTextarea } from '@/components/forms/FormShell'
import { SITE_AUDIT_TYPES } from '@/components/projects/features/featureUi'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { Project } from '@/types'

type DraftItem = {
  title: string
  location: string
  comments: string
  photos: File[]
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
  const [draft, setDraft] = useState<DraftItem>({ title: '', location: '', comments: '', photos: [] })
  const [items, setItems] = useState<DraftItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorName = user
    ? `${user.firstName} ${user.surname}`.trim() || user.email
    : 'Unknown'

  const addItemFromDraft = () => {
    if (!draft.title.trim()) {
      setError('Item title is required')
      return
    }
    setItems((prev) => [...prev, { ...draft, photos: [...draft.photos] }])
    setDraft({ title: '', location: '', comments: '', photos: [] })
    setError(null)
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const onPhotosSelected = (files: FileList | null) => {
    if (!files?.length) return
    const next = Array.from(files).slice(0, 20)
    setDraft((d) => ({
      ...d,
      photos: [...d.photos, ...next].slice(0, 20),
    }))
  }

  const submit = async () => {
    if (!organization?.id || !user) return
    if (items.length === 0 && !draft.title.trim()) {
      setError('Add at least one audit item with photos')
      return
    }
    const finalItems = items.length > 0 ? items : [{ ...draft }]
    if (finalItems.every((i) => i.photos.length === 0)) {
      setError('Add at least one photo per item (iOS requires photo evidence)')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const auditId = newUuid()
      const expanded: {
        title: string
        location: string
        assignee: string
        comments: string
        annotations: string
        imageURL?: string
      }[] = []

      for (const item of finalItems) {
        if (item.photos.length === 0) {
          expanded.push({
            title: item.title.trim(),
            location: item.location.trim(),
            assignee: '',
            comments: item.comments.trim(),
            annotations: '',
          })
          continue
        }
        for (const photo of item.photos) {
          const path = siteAuditImagePath(organization.id, auditId, photo.name)
          const imageURL = await uploadFile(path, photo, photo.type || 'image/jpeg')
          expanded.push({
            title: item.title.trim(),
            location: item.location.trim(),
            assignee: '',
            comments: item.comments.trim(),
            annotations: '',
            imageURL,
          })
        }
      }

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
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-slate-900">New site audit</p>
            <p className="text-xs text-slate-500">Step {step} of 2</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <FormLabel>Audit type</FormLabel>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {SITE_AUDIT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAuditType(t)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      auditType === t
                        ? 'border-[#185FA5] bg-[#E6F1FB] text-[#185FA5]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <FormInput
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Custom title (optional)"
            />
            <div>
              <FormLabel>Author</FormLabel>
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {authorName}
              </p>
            </div>
            <div>
              <FormLabel>Date</FormLabel>
              <FormInput type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={visibleToOperatives}
                onChange={(e) => setVisibleToOperatives(e.target.checked)}
                className="rounded border-slate-300"
              />
              Visible to operatives
            </label>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-[#185FA5] py-2.5 text-sm font-bold text-white"
            >
              Next: add items &amp; photos
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Add one or more items. Select multiple photos at once (up to 20 per item), matching the iOS app.
            </p>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <FormInput
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Item title"
              />
              <FormInput
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="Location"
              />
              <FormTextarea
                value={draft.comments}
                onChange={(e) => setDraft((d) => ({ ...d, comments: e.target.value }))}
                placeholder="Comments"
                rows={2}
              />
              <div>
                <FormLabel>Photos</FormLabel>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    onPhotosSelected(e.target.files)
                    e.target.value = ''
                  }}
                  className="text-sm text-slate-600"
                />
                {draft.photos.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">{draft.photos.length} photo(s) selected</p>
                )}
              </div>
              <button
                type="button"
                onClick={addItemFromDraft}
                className="w-full rounded-lg border border-dashed border-[#185FA5] py-2 text-sm font-semibold text-[#185FA5]"
              >
                + Add item to audit
              </button>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Items ({items.length})</p>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-xs text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="flex-1 rounded-xl bg-[#185FA5] py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Uploading…' : 'Submit audit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

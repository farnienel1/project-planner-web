'use client'

import { useEffect, useState } from 'react'
import type { Qualification } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { IosFormModal } from '@/components/ios/primitives'
import { Button } from '@/components/ui'
import { qualificationCertificatePath, uploadFile } from '@/lib/firebase/storageUtils'
import {
  QUALIFICATION_CERT_ACCEPT,
  QUALIFICATION_CERT_HINT,
  certificateUrlForQualification,
  dateFromLocalInputValue,
  formatCertificateSaveError,
  localDateInputValue,
  qualificationCertificateContentType,
  qualificationCertificateFileError,
  uploadPendingCertificates,
} from '@/lib/qualifications/certificateUpload'
import { QualificationLibraryBrowser } from './QualificationLibraryBrowser'

type LinkedOperative = NonNullable<ReturnType<typeof findOperativeForUser>>

export function OperativeQualificationsEditor({
  linked,
  templates,
  saving,
  onSave,
  organizationId,
  canManageOrg,
}: {
  linked?: LinkedOperative
  templates: Qualification[]
  saving: boolean
  onSave: (next: LinkedOperative) => Promise<void>
  organizationId: string
  canManageOrg: boolean
}) {
  const [draft, setDraft] = useState(linked)
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState<string[]>([])

  useEffect(() => {
    if (dirty) return
    setDraft(linked)
    setPendingFiles({})
    setLocalError(null)
  }, [linked, dirty])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [qualificationId, file] of Object.entries(pendingFiles)) {
      next[qualificationId] = URL.createObjectURL(file)
    }
    setPreviewUrls(next)
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url)
    }
  }, [pendingFiles])

  const openPicker = () => {
    setPickerSelected([])
    setLocalError(null)
    setPickerOpen(true)
  }

  const availableTemplates = templates.filter(
    (row) => !draft?.qualifications.some((assigned) => assigned.id === row.id)
  )

  const handlePickerSave = async () => {
    if (!draft) return
    const added = availableTemplates.filter((row) => pickerSelected.includes(row.id))
    if (added.length === 0) {
      setPickerOpen(false)
      return
    }
    const next = { ...draft, qualifications: [...draft.qualifications, ...added] }
    setDraft(next)
    setDirty(true)
    setPickerOpen(false)
    setPickerSelected([])
    setLocalError(null)
    try {
      await onSave(next)
      setDirty(false)
    } catch (err: unknown) {
      setLocalError(formatCertificateSaveError(err))
    }
  }

  const picker = pickerOpen ? (
    <IosFormModal
      title="Add qualifications"
      width="md"
      onCancel={() => {
        setPickerOpen(false)
        setPickerSelected([])
      }}
      footer={
        availableTemplates.length === 0 || pickerSelected.length === 0 ? null : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handlePickerSave()}
            className="w-full rounded-xl bg-[var(--blue)] py-3 text-[16px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : pickerSelected.length > 1 ? `Save (${pickerSelected.length})` : 'Save'}
          </button>
        )
      }
    >
      {availableTemplates.length === 0 ? (
        <p className="text-[15px] text-[var(--ink3)]">
          {templates.length === 0
            ? canManageOrg
              ? 'No qualification templates yet. Click Add to create one for the organisation.'
              : 'No qualification templates yet. Ask someone who can manage qualifications to add them.'
            : 'Every organisation qualification is already on this profile.'}
        </p>
      ) : (
        <QualificationLibraryBrowser
          items={availableTemplates}
          selectedIds={pickerSelected}
          onToggle={(id) =>
            setPickerSelected((current) =>
              current.includes(id) ? current.filter((row) => row !== id) : [...current, id]
            )
          }
          hint={
            <p className="text-[13px] text-[var(--ink3)]">
              Search or filter, click + to choose a qualification, then Save. Set expiry dates and
              certificates on the cards after saving.
            </p>
          }
        />
      )}
    </IosFormModal>
  ) : null

  if (!linked || !draft) {
    return (
      <div className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
        <p className="text-[18px] font-semibold">Profile not linked</p>
        <p className="mt-2 text-[15px] text-[var(--ink3)]">
          No operative record matches this email. Ask an admin to check the account email matches the
          operative profile.
        </p>
      </div>
    )
  }

  if (draft.qualifications.length === 0) {
    return (
      <>
        <div className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
          <p className="text-[15px] text-[var(--ink3)]">
            {templates.length === 0
              ? 'No qualifications have been set up for your organisation yet. Ask a manager or admin to add qualification templates.'
              : 'No qualifications on this profile yet. Click Add qualifications to pick from the organisation library, then set expiry dates and certificates below.'}
          </p>
          <Button variant="primary" className="mt-4" onClick={openPicker}>
            Add qualifications
          </Button>
        </div>
        {picker}
      </>
    )
  }

  const patch = (updater: (current: LinkedOperative) => LinkedOperative) => {
    setDraft((current) => (current ? updater(current) : current))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!draft) return
    if (!organizationId) {
      setLocalError('Could not save qualifications. Organisation is missing.')
      return
    }
    setLocalError(null)
    setUploading(true)
    try {
      const uploadedUrls = await uploadPendingCertificates({
        pending: pendingFiles,
        existingUrls: draft.qualificationCertificateURLs,
        uploadOne: async (qualificationId, file) => {
          const path = qualificationCertificatePath(organizationId, draft.id, qualificationId, file.name)
          return uploadFile(path, file, qualificationCertificateContentType(file))
        },
      })
      const next = { ...draft, qualificationCertificateURLs: uploadedUrls }
      await onSave(next)
      setDraft(next)
      setPendingFiles({})
      setDirty(false)
    } catch (err: unknown) {
      setLocalError(formatCertificateSaveError(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] p-3 shadow-[var(--sh)] backdrop-blur lg:bottom-4">
        <Button variant="ghost" onClick={openPicker}>
          Add qualifications
        </Button>
        <Button variant="primary" disabled={saving || uploading || !dirty} onClick={() => void handleSave()}>
          {uploading || saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
      {localError ? <p className="text-sm font-medium text-red-600">{localError}</p> : null}
      {dirty ? (
        <p className="text-right text-[13px] text-amber-700">
          Unsaved changes — click Save to keep expiry dates and certificates.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {draft.qualifications.map((qual) => {
          const expiry = draft.qualificationExpiryDates?.[qual.id]
          const cert = certificateUrlForQualification(draft.qualificationCertificateURLs, qual.id)
          const pending = pendingFiles[qual.id]
          const preview = previewUrls[qual.id]
          return (
            <div key={qual.id} className="rounded-[18px] bg-[var(--card)] p-5 shadow-[var(--sh)]">
              <p className="text-[17px] font-semibold">{qual.name}</p>
              <label className="mt-3 block text-[13px] font-medium text-[var(--ink3)]">
                Expiry date
                <input
                  type="date"
                  value={localDateInputValue(expiry)}
                  onChange={(e) => {
                    const value = e.target.value
                    patch((current) => {
                      const nextDates = { ...(current.qualificationExpiryDates || {}) }
                      const parsed = dateFromLocalInputValue(value)
                      if (parsed) nextDates[qual.id] = parsed
                      else delete nextDates[qual.id]
                      return { ...current, qualificationExpiryDates: nextDates }
                    })
                  }}
                  className="mt-1 w-full rounded-[13px] border-[1.5px] border-[var(--line2)] bg-[var(--card)] px-3.5 py-2.5"
                />
              </label>
              <p className="mt-3 text-[12px] text-[var(--ink3)]">{QUALIFICATION_CERT_HINT}</p>
              <input
                type="file"
                accept={QUALIFICATION_CERT_ACCEPT}
                disabled={saving || uploading}
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  event.target.value = ''
                  if (!picked) return
                  const invalid = qualificationCertificateFileError(picked)
                  if (invalid) {
                    setLocalError(invalid)
                    return
                  }
                  setLocalError(null)
                  setPendingFiles((current) => ({ ...current, [qual.id]: picked }))
                  setDirty(true)
                }}
                className="mt-2 text-sm"
              />
              {pending ? (
                <div className="mt-2 rounded-xl bg-[#E6EBFF] px-3 py-2 text-[13px] text-[#3D56D1]">
                  <p className="font-semibold">Ready to upload: {pending.name}</p>
                  <p>Save to store this certificate.</p>
                  {preview ? (
                    <a href={preview} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-[var(--blue)]">
                      View new certificate
                    </a>
                  ) : null}
                </div>
              ) : cert ? (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <a href={cert} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue)]">
                    View certificate
                  </a>
                  <button
                    type="button"
                    className="font-semibold text-red-600"
                    onClick={() => {
                      setPendingFiles((current) => {
                        const next = { ...current }
                        delete next[qual.id]
                        return next
                      })
                      patch((current) => {
                        const next = { ...(current.qualificationCertificateURLs || {}) }
                        delete next[qual.id]
                        return { ...current, qualificationCertificateURLs: next }
                      })
                    }}
                  >
                    Remove Certificate
                  </button>
                  <span className="text-emerald-700">Certificate uploaded</span>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--ink3)]">No certificate uploaded</p>
              )}
              {pending && cert ? (
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <a href={cert} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue)]">
                    View current certificate
                  </a>
                  <button
                    type="button"
                    className="font-semibold text-red-600"
                    onClick={() => {
                      setPendingFiles((current) => {
                        const next = { ...current }
                        delete next[qual.id]
                        return next
                      })
                    }}
                  >
                    Cancel upload
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {picker}
    </div>
  )
}

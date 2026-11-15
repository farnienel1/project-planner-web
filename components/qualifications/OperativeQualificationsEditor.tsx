'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Operative, Qualification } from '@/types'
import { IosFormModal } from '@/components/ios/primitives'
import { Button } from '@/components/ui'
import { qualificationCertificatePath, uploadFile } from '@/lib/firebase/storageUtils'
import { prepareClientUpload } from '@/lib/security/stripPhotoLocation'
import {
  QUALIFICATION_CERT_ACCEPT,
  QUALIFICATION_CERT_HINT,
  certificateUrlForQualification,
  dateFromLocalInputValue,
  formatCertificateSaveError,
  localDateInputValue,
  persistQualificationsThenCertificates,
  qualificationCertificateContentType,
  qualificationCertificateFileError,
} from '@/lib/qualifications/certificateUpload'
import { QualificationLibraryBrowser } from './QualificationLibraryBrowser'
import { ReportFileLink } from '@/components/fileReports/ReportFileLink'
import { settingsDraftIsDirty } from '@/lib/settings/settingsDirty'
import { Chip } from '@/components/ui/page'
import { ProfileIcon } from '@/components/users/profile-ui'

type LinkedOperative = Operative

/**
 * Profile look only: the existing file input inside a dashed "Choose file" area (a label, so a click opens the same
 * picker). The input itself, its accept list, limits and onChange are unchanged. Default look: the input as before.
 */
function wrapFile(pv: boolean, disabled: boolean, input: ReactNode) {
  if (!pv) return input
  return (
    <label className={disabled ? 'up-drop disabled' : 'up-drop'}>
      <ProfileIcon name="upload" />
      <span>
        <b>Choose file</b>
        <small>{QUALIFICATION_CERT_HINT}</small>
      </span>
      {input}
    </label>
  )
}

export function OperativeQualificationsEditor({
  linked,
  templates,
  saving,
  onSave,
  organizationId,
  canManageOrg,
  showReportLink = false,
  variant,
}: {
  linked?: LinkedOperative
  templates: Qualification[]
  saving: boolean
  onSave: (next: LinkedOperative) => Promise<void>
  organizationId: string
  canManageOrg: boolean
  /** Someone else's certificates (Edit User). Off on My Qualifications. */
  showReportLink?: boolean
  /**
   * `profile`: the Edit user look (docs/design/user-profile-ui/). Same controls, handlers, limits and text; only the
   * styling and the layout of each card change. My Qualifications keeps the default look.
   */
  variant?: 'profile'
}) {
  const pv = variant === 'profile'
  const [draft, setDraft] = useState(linked)
  // `editing` stops a live update replacing the draft; `dirty` (below) is whether it differs from what is saved.
  const [editing, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState<string[]>([])

  useEffect(() => {
    if (editing) return
    setDraft(linked)
    setPendingFiles({})
    setLocalError(null)
  }, [linked, editing])

  const dirty = editing && (Object.keys(pendingFiles).length > 0 || settingsDraftIsDirty(linked, draft))

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
      <div className={pv ? 'up-qempty' : 'rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]'}>
        <p className={pv ? undefined : 'text-[18px] font-semibold'}>{pv ? <b>Profile not linked</b> : 'Profile not linked'}</p>
        <p className={pv ? undefined : 'mt-2 text-[15px] text-[var(--ink3)]'}>
          No operative record matches this email. Ask an admin to check the account email matches the
          operative profile.
        </p>
      </div>
    )
  }

  if (draft.qualifications.length === 0) {
    return (
      <>
        <div className={pv ? 'up-qempty' : 'rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]'}>
          <p className={pv ? undefined : 'text-[15px] text-[var(--ink3)]'}>
            {templates.length === 0
              ? 'No qualifications have been set up for your organisation yet. Ask a manager or admin to add qualification templates.'
              : 'No qualifications on this profile yet. Click Add qualifications to pick from the organisation library, then set expiry dates and certificates below.'}
          </p>
          <Button variant="primary" className={pv ? undefined : 'mt-4'} onClick={openPicker}>
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
      const { certificateUrls } = await persistQualificationsThenCertificates({
        pending: pendingFiles,
        existingUrls: draft.qualificationCertificateURLs,
        saveAssignment: () => onSave(draft),
        uploadOne: async (qualificationId, file) => {
          const prepared = await prepareClientUpload(file, 'certificate')
          if (prepared.error) throw new Error(prepared.error)
          const path = qualificationCertificatePath(organizationId, draft.id, qualificationId, prepared.file.name)
          return uploadFile(path, prepared.file, qualificationCertificateContentType(prepared.file))
        },
        saveCertificateUrls: (urls) => onSave({ ...draft, qualificationCertificateURLs: urls }),
      })
      const next = { ...draft, qualificationCertificateURLs: certificateUrls }
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
      <div
        className={
          pv
            ? 'up-qbar'
            : 'sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] p-3 shadow-[var(--sh)] backdrop-blur lg:bottom-4'
        }
      >
        <Button variant="ghost" onClick={openPicker}>
          Add qualifications
        </Button>
        <Button variant="primary" disabled={saving || uploading || !dirty} onClick={() => void handleSave()}>
          {uploading || saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
      {localError ? <p className={pv ? 'up-err' : 'text-sm font-medium text-red-600'}>{localError}</p> : null}
      {dirty ? (
        <p className={pv ? 'up-f-hint' : 'text-right text-[13px] text-amber-700'} style={pv ? { textAlign: 'right', color: 'var(--pu-c-amber-ink)' } : undefined}>
          Unsaved changes — click Save to keep expiry dates and certificates.
        </p>
      ) : null}
      <div className={pv ? 'up-qgrid' : 'grid gap-4 md:grid-cols-2'}>
        {draft.qualifications.map((qual) => {
          const expiry = draft.qualificationExpiryDates?.[qual.id]
          const cert = certificateUrlForQualification(draft.qualificationCertificateURLs, qual.id)
          const pending = pendingFiles[qual.id]
          const preview = previewUrls[qual.id]
          return (
            <div key={qual.id} className={pv ? 'up-qcard' : 'rounded-[18px] bg-[var(--card)] p-5 shadow-[var(--sh)]'}>
              {pv ? <b>{qual.name}</b> : <p className="text-[17px] font-semibold">{qual.name}</p>}
              <label className={pv ? 'up-f up-f-label' : 'mt-3 block text-[13px] font-medium text-[var(--ink3)]'}>
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
                  className={pv ? 'pp-in' : 'mt-1 w-full rounded-[13px] border-[1.5px] border-[var(--line2)] bg-[var(--card)] px-3.5 py-2.5'}
                />
              </label>
              {pv ? null : <p className="mt-3 text-[12px] text-[var(--ink3)]">{QUALIFICATION_CERT_HINT}</p>}
              {wrapFile(
                pv,
                saving || uploading,
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
                className={pv ? undefined : 'mt-2 text-sm'}
              />
              )}
              {pending ? (
                <div className={pv ? 'up-qpending' : 'mt-2 rounded-xl bg-[#E6EBFF] px-3 py-2 text-[13px] text-[#3D56D1]'}>
                  <p className="font-semibold">Ready to upload: {pending.name}</p>
                  <p>Save to store this certificate.</p>
                  {preview ? (
                    <a href={preview} target="_blank" rel="noreferrer" className={pv ? 'up-lk' : 'mt-1 inline-block font-semibold text-[var(--blue)]'}>
                      View new certificate
                    </a>
                  ) : null}
                </div>
              ) : cert ? (
                <div className={pv ? 'up-qlinks' : 'mt-3 flex flex-wrap gap-3 text-sm'}>
                  {pv ? (
                    <Chip tone="green">
                      <span aria-hidden="true">✓</span> Certificate uploaded
                    </Chip>
                  ) : null}
                  <a href={cert} target="_blank" rel="noreferrer" className={pv ? 'up-lk' : 'font-semibold text-[var(--blue)]'}>
                    View certificate
                  </a>
                  {showReportLink && draft?.id ? (
                    <ReportFileLink fileRef={cert} surface="qualification_certificate" parentId={draft.id} fileName={qual.name} />
                  ) : null}
                  <button
                    type="button"
                    className={pv ? 'up-lk rd' : 'font-semibold text-red-600'}
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
                  {pv ? null : <span className="text-emerald-700">Certificate uploaded</span>}
                </div>
              ) : (
                pv ? (
                  <span style={{ alignSelf: 'flex-start' }}>
                    <Chip tone="slate">No certificate uploaded</Chip>
                  </span>
                ) : (
                  <p className="mt-2 text-[13px] text-[var(--ink3)]">No certificate uploaded</p>
                )
              )}
              {pending && cert ? (
                <div className={pv ? 'up-qlinks' : 'mt-2 flex flex-wrap gap-3 text-sm'}>
                  <a href={cert} target="_blank" rel="noreferrer" className={pv ? 'up-lk' : 'font-semibold text-[var(--blue)]'}>
                    View current certificate
                  </a>
                  <button
                    type="button"
                    className={pv ? 'up-lk rd' : 'font-semibold text-red-600'}
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

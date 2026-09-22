/**
 * iOS parity source: Views/QualificationsManagementView.swift, OperativeQualificationsEditorView.swift,
 * AssignQualificationsPickerView.swift, HomeView.swift OperativeQualificationsReadOnlyView
 * Spec: docs/ios-parity/sections/05-qualifications.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AcademicCapIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/solid'
import type { Qualification } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import {
  canAccessQualificationsHub,
  canManageOrganisationQualifications,
  canViewMyQualifications,
} from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { IosFormModal } from '@/components/ios/primitives'
import { PageHeader, EmptyState, Button, IconChip } from '@/components/ui'
import { SegmentedControl, Field, Input } from '@/components/ui/controls'
import {
  deleteOrganisationQualification,
  loadOrganisationQualifications,
  mergeQualificationTemplates,
  assignedQualificationTemplates,
  qualificationNameTaken,
  restoreOrganisationQualificationsFromAssignments,
  saveOrganisationQualification,
} from '@/lib/qualifications/orgQualificationStorage'
import { qualificationCertificatePath, uploadFile } from '@/lib/firebase/storageUtils'
import {
  QUALIFICATION_CERT_ACCEPT,
  QUALIFICATION_CERT_HINT,
  formatCertificateSaveError,
  localDateInputValue,
  dateFromLocalInputValue,
  qualificationCertificateContentType,
  qualificationCertificateFileError,
  uploadPendingCertificates,
} from '@/lib/qualifications/certificateUpload'

type Tab = 'organisation' | 'mine'

export function QualificationsScreen({ initialTab }: { initialTab?: Tab } = {}) {
  const { user, organization } = useAuthStore()
  const { operatives, loadOperatives, saveOperative } = useOperativeStore()
  const canManageOrg = canManageOrganisationQualifications(user)
  const canOpenHub = canAccessQualificationsHub(user) || canViewMyQualifications(user)
  const [tab, setTab] = useState<Tab>(initialTab || (canManageOrg ? 'organisation' : 'mine'))
  const [templates, setTemplates] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canManageOrg) return
    if (consumeCreateQuery()) {
      setTab('organisation')
      setName('')
      setError(null)
      setAddOpen(true)
    }
  }, [canManageOrg])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    const orgId = organization.id
    const showSpinner = useOperativeStore.getState().operatives.length === 0
    if (showSpinner) setLoading(true)

    const refresh = async () => {
      await loadOperatives(orgId, { force: true })
      if (cancelled) return
      const existing = await loadOrganisationQualifications(orgId, { fromServer: true })
      const assigned = assignedQualificationTemplates(useOperativeStore.getState().operatives)
      const merged = mergeQualificationTemplates(existing, assigned)
      if (cancelled) return
      setTemplates(merged)
      setLoading(false)
      try {
        const rows = await restoreOrganisationQualificationsFromAssignments(
          orgId,
          useOperativeStore.getState().operatives
        )
        if (!cancelled) setTemplates(rows)
      } catch {
        // Display already uses merged templates; background restore can fail for read-only accounts.
      }
    }

    void refresh().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load qualifications')
        setLoading(false)
      }
    })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [organization?.id, loadOperatives])

  const linked = useMemo(() => (user ? findOperativeForUser(user, operatives) : undefined), [user, operatives])
  const editing = templates.find((row) => row.id === editId) || null

  if (!user || !canOpenHub) return null

  const reloadTemplates = async () => {
    if (!organization?.id) return
    setTemplates(await loadOrganisationQualifications(organization.id))
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id) return
    if (qualificationNameTaken(name, templates)) {
      setError('A qualification with this name already exists.')
      return
    }
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveOrganisationQualification(organization.id, { name })
      setName('')
      setAddOpen(false)
      await reloadTemplates()
    } catch (err: unknown) {
      setError(formatCertificateSaveError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !editing) return
    if (qualificationNameTaken(name, templates, editing.id)) {
      setError('A qualification with this name already exists.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveOrganisationQualification(organization.id, {
        id: editing.id,
        name,
        createdAt: editing.createdAt,
      })
      setEditId(null)
      await reloadTemplates()
    } catch (err: unknown) {
      setError(formatCertificateSaveError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!organization?.id || !editing) return
    if (!window.confirm(`Delete "${editing.name}"?\nThis cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteOrganisationQualification(organization.id, editing.id)
      setEditId(null)
      await reloadTemplates()
    } catch (err: unknown) {
      setError(formatCertificateSaveError(err))
    } finally {
      setSaving(false)
    }
  }

  const updateMine = async (next: typeof linked) => {
    if (!organization?.id || !next) return
    await saveOperative(organization.id, next)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Qualifications"
        subtitle="Organisation templates and the certificates on your profile"
        hue="rep"
        icon={<AcademicCapIcon className="h-7 w-7" />}
        actions={
          canManageOrg && tab === 'organisation' ? (
            <Button variant="primary" onClick={() => { setName(''); setError(null); setAddOpen(true) }}>
              Add
            </Button>
          ) : null
        }
      />

      {canManageOrg ? (
        <SegmentedControl
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          options={[
            { value: 'organisation', label: 'Organisation Qualifications' },
            { value: 'mine', label: 'My Qualifications' },
          ]}
        />
      ) : (
        <h2 className="text-[22px] font-bold">My Qualifications</h2>
      )}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {tab === 'organisation' && canManageOrg ? (
        <div className="xl:grid xl:grid-cols-[400px_1fr] xl:gap-8">
          <div>
            {templates.length === 0 ? (
              <div className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
                <EmptyState
                  hue="rep"
                  icon={<IconChip hue="rep" size="lg"><AcademicCapIcon className="h-7 w-7" /></IconChip>}
                  title="No Qualifications Added Yet"
                  subtitle="Add organisation qualification templates. Staff can then assign them on My Qualifications, with their own expiry dates and certificates."
                  action={
                    <Button variant="primary" onClick={() => setAddOpen(true)}>
                      Create New Qualification
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[18px] bg-[var(--card)] shadow-[var(--sh)]">
                {templates.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => { setEditId(row.id); setName(row.name); setError(null) }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--soft)] ${
                      editId === row.id ? 'bg-[var(--rep-t)]' : ''
                    }`}
                  >
                    <IconChip hue="rep" size="sm">
                      <AcademicCapIcon className="h-4 w-4" />
                    </IconChip>
                    <span className="text-[16px] font-medium">{row.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleEdit} className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
              <h2 className="text-[22px] font-bold">Edit Qualification</h2>
              <Field label="Name" className="mt-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="primary" disabled={saving || !name.trim()} type="submit">
                  Save
                </Button>
                <Button variant="danger" onClick={handleDelete}>
                  Delete Qualification
                </Button>
              </div>
              <p className="mt-3 text-[13px] text-[var(--ink3)]">
                Deleting removes this template from the organisation list. Existing assignments on staff profiles are
                not automatically removed.
              </p>
            </form>
          ) : (
            <div className="empty card pad hidden xl:block">
              <h3>Select a qualification</h3>
              <p>Choose one from the list to view or edit it.</p>
            </div>
          )}
        </div>
      ) : (
        <MyQualificationsPanel
          linked={linked}
          templates={templates}
          saving={saving}
          onSave={async (next) => {
            setSaving(true)
            setError(null)
            try {
              await updateMine(next)
            } catch (err: unknown) {
              const message = formatCertificateSaveError(err)
              setError(message)
              throw err instanceof Error ? err : new Error(message)
            } finally {
              setSaving(false)
            }
          }}
          organizationId={organization?.id || ''}
          canManageOrg={canManageOrg}
        />
      )}

      {addOpen ? (
        <IosFormModal title="Add Qualification" onCancel={() => setAddOpen(false)} footer={
          <button type="submit" form="add-qual" disabled={saving || !name.trim()} className="w-full rounded-xl bg-[var(--blue)] py-3 text-[16px] font-semibold text-white disabled:opacity-50">
            Save
          </button>
        }>
          <form id="add-qual" onSubmit={handleCreate} className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink3)]">Qualification Details</p>
            <label className="block text-[15px] font-medium">
              Qualification Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--line2)] px-3 py-2.5" />
            </label>
            <p className="text-[13px] text-[var(--ink3)]">
              Expiration dates and certificates are set when someone assigns this qualification on My Qualifications.
            </p>
          </form>
        </IosFormModal>
      ) : null}
    </div>
  )
}

function MyQualificationsPanel({
  linked,
  templates,
  saving,
  onSave,
  organizationId,
  canManageOrg,
}: {
  linked?: ReturnType<typeof findOperativeForUser>
  templates: Qualification[]
  saving: boolean
  onSave: (next: NonNullable<ReturnType<typeof findOperativeForUser>>) => Promise<void>
  organizationId: string
  canManageOrg: boolean
}) {
  const [draft, setDraft] = useState(linked)
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState<string[]>([])

  useEffect(() => {
    if (dirty) return
    setDraft(linked)
    setPendingFiles({})
    setLocalError(null)
  }, [linked, dirty])

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
        <div className="space-y-2">
          <p className="text-[13px] text-[var(--ink3)]">
            Click + to choose a qualification, then Save. Set expiry dates and certificates on the cards after saving.
          </p>
          {availableTemplates.map((row) => {
            const selected = pickerSelected.includes(row.id)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  setPickerSelected((current) =>
                    current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
                  )
                }
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left ${
                  selected ? 'bg-[var(--rep-t)] ring-1 ring-[var(--blue)]' : 'bg-[var(--soft)]'
                }`}
              >
                <span className="font-medium">{row.name}</span>
                {selected ? (
                  <CheckIcon className="h-5 w-5 text-[var(--blue)]" />
                ) : (
                  <PlusIcon className="h-5 w-5 text-[var(--blue)]" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </IosFormModal>
  ) : null

  if (!linked || !draft) {
    return (
      <div className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
        <p className="text-[18px] font-semibold">Profile not linked</p>
        <p className="mt-2 text-[15px] text-[var(--ink3)]">
          No operative record matches your email. Ask an admin to check your account email matches your operative
          profile.
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
              : 'You have not added any qualifications yet. Click Add qualifications to pick from your organisation list, then set expiry dates and certificates below.'}
          </p>
          <Button variant="primary" className="mt-4" onClick={openPicker}>
            Add qualifications
          </Button>
        </div>
        {picker}
      </>
    )
  }

  const patch = (updater: (current: NonNullable<typeof draft>) => NonNullable<typeof draft>) => {
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
          const path = qualificationCertificatePath(
            organizationId,
            draft.id,
            qualificationId,
            file.name
          )
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
          const cert = draft.qualificationCertificateURLs?.[qual.id]
          const pending = pendingFiles[qual.id]
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
                  <p>Save to store this certificate</p>
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

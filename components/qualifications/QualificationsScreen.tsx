/**
 * iOS parity source: Views/QualificationsManagementView.swift, OperativeQualificationsEditorView.swift,
 * AssignQualificationsPickerView.swift, HomeView.swift OperativeQualificationsReadOnlyView
 * Spec: docs/ios-parity/sections/05-qualifications.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AcademicCapIcon, PlusIcon } from '@heroicons/react/24/solid'
import type { Qualification } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import {
  canAccessQualificationsHub,
  canManageOrganisationQualifications,
  isOperativeMode,
} from '@/lib/permissions'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'
import {
  deleteOrganisationQualification,
  loadOrganisationQualifications,
  qualificationNameTaken,
  saveOrganisationQualification,
} from '@/lib/qualifications/orgQualificationStorage'
import { qualificationCertificatePath, uploadFile } from '@/lib/firebase/storageUtils'

type Tab = 'organisation' | 'mine'

export function QualificationsScreen() {
  const { user, organization } = useAuthStore()
  const { operatives, loadOperatives, saveOperative } = useOperativeStore()
  const canManageOrg = canManageOrganisationQualifications(user)
  const canOpenHub = canAccessQualificationsHub(user) || isOperativeMode(user)
  const [tab, setTab] = useState<Tab>(canManageOrg ? 'organisation' : 'mine')
  const [templates, setTemplates] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    setLoading(true)
    Promise.all([loadOrganisationQualifications(organization.id), loadOperatives(organization.id)])
      .then(([rows]) => {
        if (!cancelled) setTemplates(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load qualifications')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
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
    try {
      await saveOrganisationQualification(organization.id, {
        id: editing.id,
        name,
        createdAt: editing.createdAt,
      })
      setEditId(null)
      await reloadTemplates()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!organization?.id || !editing) return
    if (!window.confirm(`Delete "${editing.name}"?\nThis cannot be undone.`)) return
    setSaving(true)
    try {
      await deleteOrganisationQualification(organization.id, editing.id)
      setEditId(null)
      await reloadTemplates()
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (template: Qualification) => {
    if (!organization?.id || !linked) return
    if (linked.qualifications.some((row) => row.id === template.id)) return
    setSaving(true)
    try {
      await saveOperative(organization.id, {
        ...linked,
        qualifications: [...linked.qualifications, template],
      })
      setPickerOpen(false)
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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#185FA5]" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Qualifications"
        actions={
          canManageOrg && tab === 'organisation' ? (
            <button type="button" onClick={() => { setName(''); setError(null); setAddOpen(true) }} className="text-[15px] font-semibold text-[#185FA5]">
              Add
            </button>
          ) : null
        }
      />

      {canManageOrg ? (
        <div className="inline-flex rounded-xl bg-[#E5E5EA] p-1">
          {(['organisation', 'mine'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${
                tab === value ? 'bg-white text-ios-ink shadow-sm' : 'text-ios-muted'
              }`}
            >
              {value === 'organisation' ? 'Organisation Qualifications' : 'My Qualifications'}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="text-[22px] font-semibold">My Qualifications</h2>
      )}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {tab === 'organisation' && canManageOrg ? (
        <div className="xl:grid xl:grid-cols-[400px_1fr] xl:gap-8">
          <div>
            {templates.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
                <EmptyState
                  icon={<AcademicCapIcon className="h-[60px] w-[60px] text-gray-400" />}
                  title="No Qualifications Added Yet"
                  subtitle="Add organisation qualification templates. Staff can then assign them on My Qualifications, with their own expiry dates and certificates."
                />
                <div className="flex justify-center">
                  <button type="button" onClick={() => setAddOpen(true)} className="rounded-xl bg-[#185FA5] px-5 py-2.5 text-[15px] font-semibold text-white">
                    Create New Qualification
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10)] divide-y divide-[#E5E5EA]">
                {templates.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => { setEditId(row.id); setName(row.name); setError(null) }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 ${
                      editId === row.id ? 'bg-[#E6F1FB]' : ''
                    }`}
                  >
                    <AcademicCapIcon className="h-5 w-5 text-[#185FA5]" />
                    <span className="text-[16px] font-medium">{row.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {editing ? (
            <form onSubmit={handleEdit} className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <h2 className="text-[22px] font-semibold">Edit Qualification</h2>
              <label className="mt-4 block text-[15px] font-medium">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-ios-search-border px-3 py-2.5 text-[15px]"
                />
              </label>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Save
                </button>
                <button type="button" onClick={handleDelete} className="text-sm font-semibold text-red-600">
                  Delete Qualification
                </button>
              </div>
              <p className="mt-3 text-[13px] text-ios-muted">
                Deleting removes this template from the organisation list. Existing assignments on staff profiles are
                not automatically removed.
              </p>
            </form>
          ) : (
            <div className="hidden rounded-2xl bg-[#F2F2F7] p-6 text-sm text-ios-muted xl:block">
              Select a qualification to edit.
            </div>
          )}
        </div>
      ) : (
        <MyQualificationsPanel
          linked={linked}
          templates={templates}
          saving={saving}
          onAdd={() => setPickerOpen(true)}
          onChange={(next) => void updateMine(next)}
          organizationId={organization?.id || ''}
        />
      )}

      {addOpen ? (
        <IosFormModal title="Add Qualification" onCancel={() => setAddOpen(false)} footer={
          <button type="submit" form="add-qual" disabled={saving || !name.trim()} className="w-full rounded-xl bg-[#185FA5] py-3 text-[16px] font-semibold text-white disabled:opacity-50">
            Save
          </button>
        }>
          <form id="add-qual" onSubmit={handleCreate} className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-muted">Qualification Details</p>
            <label className="block text-[15px] font-medium">
              Qualification Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-lg border border-ios-search-border px-3 py-2.5" />
            </label>
            <p className="text-[13px] text-ios-muted">
              Expiration dates and certificates are set when someone assigns this qualification on My Qualifications.
            </p>
          </form>
        </IosFormModal>
      ) : null}

      {pickerOpen ? (
        <IosFormModal title="Add qualifications" onCancel={() => setPickerOpen(false)}>
          {templates.filter((row) => !linked?.qualifications.some((assigned) => assigned.id === row.id)).length === 0 ? (
            <p className="text-[15px] text-ios-muted">
              {templates.length === 0
                ? canManageOrg
                  ? 'No qualification templates yet. Tap Add to create one for the organisation.'
                  : 'No qualification templates yet. Ask someone who can manage qualifications to add them.'
                : 'Every organisation qualification is already on this profile.'}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] text-ios-muted">Tap + to add a qualification. Set expiry dates and certificates when you return.</p>
              {templates
                .filter((row) => !linked?.qualifications.some((assigned) => assigned.id === row.id))
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => void handleAssign(row)}
                    className="flex w-full items-center justify-between rounded-xl bg-[#F2F2F7] px-4 py-3 text-left"
                  >
                    <span className="font-medium">{row.name}</span>
                    <PlusIcon className="h-5 w-5 text-[#185FA5]" />
                  </button>
                ))}
            </div>
          )}
        </IosFormModal>
      ) : null}
    </div>
  )
}

function MyQualificationsPanel({
  linked,
  templates,
  saving,
  onAdd,
  onChange,
  organizationId,
}: {
  linked?: ReturnType<typeof findOperativeForUser>
  templates: Qualification[]
  saving: boolean
  onAdd: () => void
  onChange: (next: NonNullable<ReturnType<typeof findOperativeForUser>>) => void
  organizationId: string
}) {
  if (!linked) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        <p className="text-[18px] font-semibold">Profile not linked</p>
        <p className="mt-2 text-[15px] text-ios-muted">
          No operative record matches your email. Ask an admin to check your account email matches your operative
          profile.
        </p>
      </div>
    )
  }

  if (linked.qualifications.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
        <p className="text-[15px] text-ios-muted">
          {templates.length === 0
            ? 'No qualifications have been set up for your organisation yet. Ask a manager or admin to add qualification templates.'
            : 'You have not added any qualifications yet. Tap Add qualifications to pick from your organisation list, then set expiry dates and certificates below.'}
        </p>
        <button type="button" onClick={onAdd} className="mt-4 rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white">
          Add qualifications
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={onAdd} className="text-[15px] font-semibold text-[#185FA5]">
          Add qualifications
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {linked.qualifications.map((qual) => {
          const expiry = linked.qualificationExpiryDates?.[qual.id]
          const cert = linked.qualificationCertificateURLs?.[qual.id]
          return (
            <div key={qual.id} className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <p className="text-[17px] font-semibold">{qual.name}</p>
              <label className="mt-3 block text-[13px] font-medium text-ios-muted">
                Expiry date
                <input
                  type="date"
                  value={expiry ? expiry.toISOString().slice(0, 10) : ''}
                  onChange={(e) => {
                    const nextDates = { ...(linked.qualificationExpiryDates || {}) }
                    if (e.target.value) nextDates[qual.id] = new Date(`${e.target.value}T00:00:00`)
                    else delete nextDates[qual.id]
                    onChange({ ...linked, qualificationExpiryDates: nextDates })
                  }}
                  className="mt-1 w-full rounded-lg border border-ios-search-border px-3 py-2"
                />
              </label>
              <p className="mt-3 text-[12px] text-ios-muted">PDF or JPEG only · max 10MB</p>
              <input
                type="file"
                accept="application/pdf,image/jpeg"
                disabled={saving}
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file || !organizationId) return
                  if (file.size > 10 * 1024 * 1024) {
                    window.alert('PDF or JPEG only · max 10MB')
                    return
                  }
                  const path = qualificationCertificatePath(organizationId, linked.id, qual.id, file.name)
                  const url = await uploadFile(path, file, file.type || 'application/pdf')
                  onChange({
                    ...linked,
                    qualificationCertificateURLs: { ...(linked.qualificationCertificateURLs || {}), [qual.id]: url },
                  })
                }}
                className="mt-2 text-sm"
              />
              {cert ? (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <a href={cert} target="_blank" rel="noreferrer" className="font-semibold text-[#185FA5]">
                    View certificate
                  </a>
                  <button
                    type="button"
                    className="font-semibold text-red-600"
                    onClick={() => {
                      const next = { ...(linked.qualificationCertificateURLs || {}) }
                      delete next[qual.id]
                      onChange({ ...linked, qualificationCertificateURLs: next })
                    }}
                  >
                    Remove Certificate
                  </button>
                  <span className="text-emerald-700">Certificate uploaded</span>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ios-muted">No certificate uploaded</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

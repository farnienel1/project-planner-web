/**
 * iOS parity source: Views/QualificationsManagementView.swift, OperativeQualificationsEditorView.swift,
 * AssignQualificationsPickerView.swift, HomeView.swift OperativeQualificationsReadOnlyView
 * Spec: docs/ios-parity/sections/05-qualifications.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AcademicCapIcon } from '@heroicons/react/24/solid'
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
import { QualificationLibraryBrowser } from './QualificationLibraryBrowser'
import { OperativeQualificationsEditor } from './OperativeQualificationsEditor'
import {
  deleteOrganisationQualification,
  loadOrganisationQualifications,
  mergeQualificationTemplates,
  assignedQualificationTemplates,
  qualificationEditCanSave,
  qualificationNameTaken,
  restoreOrganisationQualificationsFromAssignments,
  saveOrganisationQualification,
} from '@/lib/qualifications/orgQualificationStorage'
import { loadOrganisationQualificationsEnsuringStarter } from '@/lib/qualifications/starterLibrary'
import { canonicalCertificateUrls, formatCertificateSaveError } from '@/lib/qualifications/certificateUpload'

type Tab = 'organisation' | 'mine'

export function QualificationsScreen({ initialTab }: { initialTab?: Tab } = {}) {
  const { user, organization } = useAuthStore()
  const { operatives, loadOperatives, patchOperativeQualifications } = useOperativeStore()
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
      const [, existing] = await Promise.all([
        loadOperatives(orgId, { force: true }),
        loadOrganisationQualificationsEnsuringStarter(orgId, { fromServer: true }),
      ])
      if (cancelled) return
      const assigned = assignedQualificationTemplates(useOperativeStore.getState().operatives)
      const merged = mergeQualificationTemplates(existing, assigned)
      if (cancelled) return
      setTemplates(merged)
      setLoading(false)
      try {
        const rows = await restoreOrganisationQualificationsFromAssignments(
          orgId,
          useOperativeStore.getState().operatives,
          existing
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
        hasEndDate: editing.hasEndDate === true,
        code: editing.code,
        section: editing.section,
        subsection: editing.subsection,
        awardingBody: editing.awardingBody,
        level: editing.level,
        renewYears: editing.renewYears,
        renewalType: editing.renewalType,
        status: editing.status,
        notes: editing.notes,
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
    if (!organization?.id || !next?.id) return
    const urls = canonicalCertificateUrls(next.qualifications, next.qualificationCertificateURLs)
    await patchOperativeQualifications(organization.id, { ...next, qualificationCertificateURLs: urls })
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
              <QualificationLibraryBrowser
                items={templates}
                activeId={editId}
                onSelect={(row) => {
                  setEditId(row.id)
                  setName(row.name)
                  setError(null)
                }}
              />
            )}
          </div>
          {editing ? (
            <form onSubmit={handleEdit} className="rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--sh)]">
              <h2 className="text-[22px] font-bold">Edit Qualification</h2>
              <Field label="Name" className="mt-4">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {editing.section || editing.awardingBody || editing.code ? (
                <p className="mt-3 text-[13px] text-[var(--ink3)]">
                  {[editing.section, editing.awardingBody, editing.code].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="primary" disabled={!qualificationEditCanSave(name, editing.name, saving)} type="submit">
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
        <OperativeQualificationsEditor
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

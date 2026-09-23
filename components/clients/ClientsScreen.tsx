/**
 * iOS parity source: Views/ClientsView.swift, CreateClientView.swift, EditClientView.swift
 * Spec: docs/ios-parity/sections/09-clients.md
 */

'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'
import type { Client } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { canViewClients, hasAdminAccess, isOperativeMode } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { visibleWorks } from '@/lib/access/workAccess'
import { useDeadlineAssignedProjectIds } from '@/lib/deadlines/useDeadlineAssignedProjectIds'
import { notifyClientCreated } from '@/lib/firebase/notifyInbox'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'
import { WorkCard } from '@/components/projects/WorkCard'

function creatorName(): string {
  const { user } = useAuthStore.getState()
  if (!user) return 'Someone'
  const full = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return full || user.email.split('@')[0] || user.email
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoCapitalize,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoCapitalize?: string
  inputMode?: 'email' | 'tel' | 'text'
}) {
  return (
    <label className="f">
      {label}
      <input
        type={type}
        value={value}
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="pp-in"
      />
    </label>
  )
}

function ClientCard({ client, onClick, selected }: { client: Client; onClick: () => void; selected?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`ritem ${selected ? 'sel' : ''}`} data-hue="blue">
      <span className="ico-chip">
        <UserGroupIcon className="h-5 w-5" />
      </span>
      <span className="grow">
        <span className="t">{client.name}</span>
        <span className="s">{client.email || client.phone || client.address || 'No contact details'}</span>
      </span>
    </button>
  )
}

function ClientInfo({ client }: { client: Client }) {
  return (
    <div className="card pad">
      <h2 className="h2" style={{ fontSize: 28 }}>{client.name}</h2>
      <div className="stack" style={{ gap: 10, marginTop: 16 }}>
        {client.email ? (
          <p className="row">
            <EnvelopeIcon className="h-4 w-4 text-[var(--blue)]" />
            {client.email}
          </p>
        ) : null}
        {client.phone ? (
          <p className="row">
            <PhoneIcon className="h-4 w-4 text-[var(--ops)]" />
            {client.phone}
          </p>
        ) : null}
        {client.address ? (
          <p className="row" style={{ alignItems: 'flex-start' }}>
            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sw)]" />
            {client.address}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ClientsScreen({ selectedId }: { selectedId?: string }) {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { clients, projects, loading, loadClients, loadProjects, createClient, updateClient, deleteClient } =
    useProjectStore()
  const { bookings, loadBookings } = useBookingStore()
  const { managerSiteBookings, loadManagerSiteBookings } = useManagerScheduleStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { tasks, loadTasks } = useTaskStore()
  const deadlineAssignedProjectIds = useDeadlineAssignedProjectIds()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createdAlert, setCreatedAlert] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (user && !canViewClients(user)) router.replace('/dashboard')
  }, [user, router])

  useEffect(() => {
    if (!organization?.id) return
    loadClients(organization.id)
    loadProjects(organization.id)
    loadBookings(organization.id)
    loadManagerSiteBookings(organization.id)
    loadOperatives(organization.id)
    loadTasks(organization.id)
  }, [
    organization?.id,
    loadClients,
    loadProjects,
    loadBookings,
    loadManagerSiteBookings,
    loadOperatives,
    loadTasks,
  ])

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) || null,
    [clients, selectedId]
  )

  const clientProjects = useMemo(() => {
    if (!selected || !user) return []
    return visibleWorks({
      projects: projects.filter((p) => p.client?.id === selected.id),
      catalogue: 'all',
      user,
      operatives,
      bookings,
      managerBookings: managerSiteBookings,
      tasks,
      deadlineAssignedProjectIds,
    })
  }, [selected, user, projects, operatives, bookings, managerSiteBookings, tasks, deadlineAssignedProjectIds])

  const canDelete = hasAdminAccess(user)
  const formValid = name.trim().length > 0

  const openCreate = () => {
    setName('')
    setEmail('')
    setPhone('')
    setAddress('')
    setError(null)
    setCreateOpen(true)
  }

  useEffect(() => {
    if (consumeCreateQuery()) openCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (client: Client) => {
    setName(client.name)
    setEmail(client.email || '')
    setPhone(client.phone || '')
    setAddress(client.address || '')
    setError(null)
    setEditOpen(true)
  }

  const selectClient = (client: Client) => {
    router.push(`/dashboard/clients/${client.id}`)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !formValid) return
    setSaving(true)
    setError(null)
    try {
      const created = await createClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        organizationId: organization.id,
      })
      await notifyClientCreated({
        organizationId: organization.id,
        clientId: created.id,
        clientName: created.name,
        createdBy: creatorName(),
      })
      setCreateOpen(false)
      setCreatedAlert(`Client '${created.name}' has been created successfully!`)
      router.push(`/dashboard/clients/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !selected || !formValid) return
    setSaving(true)
    setError(null)
    try {
      await updateClient(organization.id, selected.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      })
      setEditOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!organization?.id || !selected || !canDelete) return
    setSaving(true)
    try {
      await deleteClient(organization.id, selected.id)
      setDeleteOpen(false)
      setEditOpen(false)
      router.push('/dashboard/clients')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete client')
    } finally {
      setSaving(false)
    }
  }

  if (!user || isOperativeMode(user)) return null

  if (loading && clients.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  const list = (
    <div className="rows">
      {clients.length === 0 ? (
        <EmptyState
          icon={<UserGroupIcon className="h-12 w-12" />}
          title="No clients added yet"
          subtitle="Add clients to your organisation. Clients are the companies or individuals you work for."
          hue="blue"
          action={
            <button type="button" onClick={openCreate} className="btn primary">
              Create client
            </button>
          }
        />
      ) : (
        clients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            selected={selected?.id === client.id}
            onClick={() => selectClient(client)}
          />
        ))
      )}
    </div>
  )

  const detail = selected ? (
    <div className="stack">
      <div className="row">
        <h2 className="h2">Client details</h2>
        <span className="grow" />
        <button type="button" onClick={() => openEdit(selected)} className="btn sm">
          Edit
        </button>
      </div>
      <ClientInfo client={selected} />
      {clientProjects.length > 0 ? (
        <div>
          <h3 className="h2 mb-3">Projects ({clientProjects.length})</h3>
          <div className="grid g2">
            {clientProjects.map((project) => (
              <WorkCard
                key={project.id}
                project={project}
                href={
                  /small works/i.test(project.jobType || '')
                    ? `/dashboard/small-works/${project.id}`
                    : `/dashboard/projects/${project.id}`
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="empty card pad hidden xl:block">
      <h3>Select a client</h3>
      <p>Choose someone from the list to see contact details and their jobs.</p>
    </div>
  )

  const formFields = (
    <div className="form" style={{ gridTemplateColumns: '1fr' }}>
      {error ? <p className="banner" data-hue="red">{error}</p> : null}
      <Field label="Client name" value={name} onChange={setName} />
      <Field label="Email" value={email} onChange={setEmail} type="email" autoCapitalize="none" inputMode="email" />
      <Field label="Phone" value={phone} onChange={setPhone} type="tel" inputMode="tel" />
      <Field label="Address" value={address} onChange={setAddress} />
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        subtitle="Who you work for, and how to reach them"
        hue="blue"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="btn primary"
          >
            New client
          </button>
        }
      />

      <div className="grid gmain">
        <div className={selectedId ? 'hidden xl:block' : ''}>{list}</div>
        <div className={!selectedId ? 'hidden xl:block' : ''}>
          {selectedId && !selected && !loading ? <p className="muted">Client not found.</p> : detail}
        </div>
      </div>

      {createOpen ? (
        <IosFormModal
          title="New Client"
          onCancel={() => setCreateOpen(false)}
          footer={
            <button
              type="submit"
              form="create-client-form"
              disabled={!formValid || saving}
              className="btn primary block"
            >
              {saving ? 'Creating…' : 'Create Client'}
            </button>
          }
        >
          <form id="create-client-form" onSubmit={handleCreate}>
            {formFields}
          </form>
        </IosFormModal>
      ) : null}

      {editOpen && selected ? (
        <IosFormModal
          title="Edit Client"
          onCancel={() => setEditOpen(false)}
          footer={
            <div className="space-y-3">
              <button
                type="submit"
                form="edit-client-form"
                disabled={!formValid || saving}
                className="btn primary block"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="btn danger block"
                >
                  Delete Client
                </button>
              ) : null}
            </div>
          }
        >
          <form id="edit-client-form" onSubmit={handleSave}>
            {formFields}
          </form>
        </IosFormModal>
      ) : null}

      {deleteOpen && selected ? (
        <IosFormModal
          title="Delete Client"
          onCancel={() => setDeleteOpen(false)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="btn flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn hue flex-1"
                data-hue="red"
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-[15px]">
            Are you sure you want to delete {selected.name}? This action cannot be undone.
          </p>
        </IosFormModal>
      ) : null}

      {createdAlert ? (
        <IosFormModal
          title="Client Created"
          onCancel={() => setCreatedAlert(null)}
          footer={
            <button
              type="button"
              onClick={() => setCreatedAlert(null)}
              className="btn primary block"
            >
              OK
            </button>
          }
        >
          <p className="text-[15px]">{createdAlert}</p>
        </IosFormModal>
      ) : null}
    </div>
  )
}

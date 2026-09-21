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
    <label className="block text-[13px] font-medium text-ios-ink">
      {label}
      <input
        type={type}
        value={value}
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-ios-search-border bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
      />
    </label>
  )
}

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-transparent bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] transition hover:border-ios-search-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-ios-ink">{client.name}</p>
          {client.email ? (
            <p className="mt-1 flex items-center gap-1 text-[14px] text-ios-muted">
              <EnvelopeIcon className="h-3.5 w-3.5 text-[#2563eb]" />
              {client.email}
            </p>
          ) : null}
        </div>
        {client.phone ? (
          <p className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#0F6E56]">
            <PhoneIcon className="h-3.5 w-3.5" />
            {client.phone}
          </p>
        ) : null}
      </div>
      {client.address ? (
        <p className="mt-3 line-clamp-2 flex items-start gap-1 text-[12px] text-ios-muted">
          <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
          {client.address}
        </p>
      ) : null}
    </button>
  )
}

function ClientInfo({ client }: { client: Client }) {
  return (
    <div className="rounded-xl bg-[#F2F2F7] p-5">
      <h2 className="text-[32px] font-bold leading-tight tracking-tight text-ios-ink">{client.name}</h2>
      <div className="mt-4 space-y-2 text-[16px]">
        {client.email ? (
          <p className="flex items-center gap-2">
            <EnvelopeIcon className="h-4 w-4 text-[#2563eb]" />
            {client.email}
          </p>
        ) : null}
        {client.phone ? (
          <p className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4 text-[#0F6E56]" />
            {client.phone}
          </p>
        ) : null}
        {client.address ? (
          <p className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
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
    })
  }, [selected, user, projects, operatives, bookings, managerSiteBookings, tasks])

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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#185FA5]" />
      </div>
    )
  }

  const list = (
    <div className="space-y-4">
      {clients.length === 0 ? (
        <EmptyState
          icon={<UserGroupIcon className="h-[60px] w-[60px] text-gray-400" />}
          title="No Clients Added Yet"
          subtitle="Add clients to your organisation. Clients are the companies or individuals you work for."
        />
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className={selected?.id === client.id ? 'rounded-xl ring-2 ring-[#185FA5]/30' : ''}
            >
              <ClientCard client={client} onClick={() => selectClient(client)} />
            </div>
          ))}
        </div>
      )}
      {clients.length === 0 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#185FA5] px-5 py-2.5 text-[15px] font-semibold text-white"
          >
            Create Client
          </button>
        </div>
      ) : null}
    </div>
  )

  const detail = selected ? (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Client Details</h2>
        <button type="button" onClick={() => openEdit(selected)} className="text-[15px] font-medium text-[#185FA5]">
          Edit
        </button>
      </div>
      <ClientInfo client={selected} />
      {clientProjects.length > 0 ? (
        <div>
          <h3 className="mb-3 text-[17px] font-semibold">Projects ({clientProjects.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
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
    <div className="hidden min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-ios-border text-sm text-ios-muted xl:flex">
      Select a client
    </div>
  )

  const formFields = (
    <div className="space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ios-muted">Client Information</p>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Field label="Client Name" value={name} onChange={setName} />
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

      <div className="xl:grid xl:grid-cols-[400px_minmax(0,1fr)] xl:gap-8">
        <div className={selectedId ? 'hidden xl:block' : ''}>{list}</div>
        <div className={!selectedId ? 'hidden xl:block' : ''}>
          {selectedId && !selected && !loading ? <p className="text-ios-muted">Client not found.</p> : detail}
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
              className="h-12 w-full rounded-lg bg-[#185FA5] text-[16px] font-semibold text-white disabled:bg-gray-400"
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
                className="h-12 w-full rounded-lg bg-[#185FA5] text-[16px] font-semibold text-white disabled:bg-gray-400"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="h-12 w-full rounded-lg bg-red-50 text-[16px] font-semibold text-red-600"
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
                className="h-12 flex-1 rounded-lg border border-ios-search-border text-[15px] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-12 flex-1 rounded-lg bg-red-600 text-[15px] font-semibold text-white"
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-[15px] text-ios-ink">
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
              className="h-12 w-full rounded-lg bg-[#185FA5] text-[16px] font-semibold text-white"
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

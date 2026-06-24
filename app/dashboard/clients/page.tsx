'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import type { Client } from '@/types'
import { ErrorBanner } from '@/components/dashboard/PageShell'

export default function ClientsPage() {
  const { organization, user } = useAuthStore()
  const { clients, loading, loadClients, createClient, updateClient, deleteClient } = useProjectStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const canManage = user?.permissions?.projects || user?.isSuperAdmin

  useEffect(() => {
    if (organization?.id) {
      loadClients(organization.id)
    }
  }, [organization, loadClients])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        organizationId: organization.id,
      })
      setName('')
      setEmail('')
      setPhone('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add client')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setEditName(client.name)
    setEditEmail(client.email || '')
    setEditPhone(client.phone || '')
    setError(null)
  }

  const closeEdit = () => {
    setEditingClient(null)
    setEditName('')
    setEditEmail('')
    setEditPhone('')
  }

  const handleEditSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !editingClient || !editName.trim()) return
    setEditSaving(true)
    setError(null)
    try {
      await updateClient(organization.id, editingClient.id, {
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
      })
      closeEdit()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update client')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!organization?.id || !canManage) return
    const confirmed = window.confirm(`Delete client "${client.name}"? This cannot be undone.`)
    if (!confirmed) return
    setError(null)
    try {
      await deleteClient(organization.id, client.id)
      if (editingClient?.id === client.id) closeEdit()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete client')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
        <p className="mt-1 text-slate-600">Manage clients used on projects and small works</p>
        <p className="mt-2 text-xs text-slate-500">{clients.length} clients · synced with iOS via Firebase</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {canManage && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name"
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-1"
            required
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-1"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-1"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add client'}
          </button>
        </form>
      )}

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-600">No clients yet. Add one above or create clients in the iOS app.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Phone</th>
                {canManage && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => openEdit(client)}
                        className="text-left font-medium text-blue-700 hover:underline"
                      >
                        {client.name}
                      </button>
                    ) : (
                      client.name
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{client.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{client.phone || '—'}</td>
                  {canManage && (
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => openEdit(client)}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <span className="mx-2 text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(client)}
                        className="font-medium text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Edit client</h2>
            <p className="mt-1 text-sm text-slate-500">Changes sync to Firebase and the iOS app.</p>
            <form onSubmit={handleEditSave} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'

export default function ClientsPage() {
  const { organization, user } = useAuthStore()
  const { clients, loading, loadClients, createClient } = useProjectStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
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
    } finally {
      setSaving(false)
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{client.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{client.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

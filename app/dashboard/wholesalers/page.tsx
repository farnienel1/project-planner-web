'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { newWholesalerId, useWholesalerStore } from '@/lib/stores/wholesalerStore'
import { canAccessWholesalers } from '@/lib/navigation/menuPermissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { Wholesaler, WholesalerContact } from '@/types'
import { EmptyState, ErrorBanner, LoadingSpinner, PageHeader, SearchField } from '@/components/dashboard/PageShell'

export default function WholesalersPage() {
  const { organization, user } = useAuthStore()
  const { wholesalers, loading, error, loadWholesalers, saveWholesaler, deleteWholesaler } = useWholesalerStore()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', trade: '', address: '', accountNumber: '', contactName: '', contactEmail: '' })

  const canManage = canAccessWholesalers(user)

  useEffect(() => {
    if (organization?.id) loadWholesalers(organization.id)
  }, [organization, loadWholesalers])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return wholesalers
    return wholesalers.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        (w.trade || '').toLowerCase().includes(query) ||
        (w.address || '').toLowerCase().includes(query) ||
        w.contacts.some((c) => c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query))
    )
  }, [wholesalers, search])

  const totalContacts = wholesalers.reduce((sum, w) => sum + w.contacts.length, 0)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !canManage || !form.name.trim() || !form.contactName.trim() || !form.contactEmail.trim()) return
    setSaving(true)
    try {
      const contactId = newUuid()
      const contacts: WholesalerContact[] = [
        { id: contactId, name: form.contactName.trim(), email: form.contactEmail.trim(), isPrimary: true, createdAt: new Date() },
      ]
      const wholesaler: Wholesaler = {
        id: newWholesalerId(),
        name: form.name.trim(),
        trade: form.trade.trim() || undefined,
        address: form.address.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        primaryContactId: contactId,
        contacts,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await saveWholesaler(organization.id, wholesaler)
      setForm({ name: '', trade: '', address: '', accountNumber: '', contactName: '', contactEmail: '' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesalers"
        description="Supplier directory with contacts — matches iOS WholesalersView."
        meta={`${wholesalers.length} wholesalers · ${totalContacts} contacts · organizations/{orgId}/wholesalers`}
      />

      {error && <ErrorBanner message={error} />}

      <SearchField value={search} onChange={setSearch} placeholder="Search wholesalers, trade, contacts…" />

      {canManage && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Add wholesaler</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Wholesaler name" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Trade / category" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="Account number" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Primary contact name" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="Primary contact email" className="rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add wholesaler'}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No wholesalers yet" description="Add wholesalers on web or iOS — data syncs via Firebase." />
      ) : (
        <div className="space-y-3">
          {filtered.map((wholesaler) => (
            <div key={wholesaler.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === wholesaler.id ? null : wholesaler.id)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left"
              >
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{wholesaler.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                    {wholesaler.trade && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{wholesaler.trade}</span>}
                    {wholesaler.address && <span>{wholesaler.address}</span>}
                    <span>{wholesaler.contacts.length} contact{wholesaler.contacts.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <span className="text-slate-400">{expandedId === wholesaler.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === wholesaler.id && (
                <div className="border-t border-slate-100 px-5 pb-5">
                  {wholesaler.accountNumber && <p className="mt-3 text-sm text-slate-600">Account: {wholesaler.accountNumber}</p>}
                  <div className="mt-3 space-y-2">
                    {wholesaler.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">
                          {contact.name} {contact.isPrimary && <span className="text-xs text-blue-600">Primary</span>}
                        </p>
                        <p className="text-slate-600">{contact.email}</p>
                      </div>
                    ))}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!organization?.id) return
                        if (window.confirm(`Delete ${wholesaler.name}?`)) deleteWholesaler(organization.id, wholesaler.id)
                      }}
                      className="mt-4 text-sm text-red-600 hover:text-red-800"
                    >
                      Delete wholesaler
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSubcontractorStore } from '@/lib/stores/subcontractorStore'
import { canManageSubcontractors } from '@/lib/navigation/menuPermissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { Subcontractor } from '@/types'
import { EmptyState, ErrorBanner, LoadingSpinner, PageHeader, SearchField } from '@/components/dashboard/PageShell'

export default function SubContractorsPage() {
  const { organization, user } = useAuthStore()
  const { subcontractors, loading, error, loadSubcontractors, saveSubcontractor, deleteSubcontractor } = useSubcontractorStore()
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    subcontractorType: '',
    website: '',
    address: '',
    contactName: '',
    contactEmail: '',
    contactNumber: '',
  })

  const canManage = canManageSubcontractors(user)

  useEffect(() => {
    if (organization?.id) loadSubcontractors(organization.id)
  }, [organization, loadSubcontractors])

  const tradeTypes = useMemo(() => {
    const set = new Set(subcontractors.map((s) => s.subcontractorType).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [subcontractors])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return subcontractors.filter((sub) => {
      if (tradeFilter !== 'All' && sub.subcontractorType !== tradeFilter) return false
      if (!query) return true
      return (
        sub.name.toLowerCase().includes(query) ||
        sub.subcontractorType.toLowerCase().includes(query) ||
        (sub.website || '').toLowerCase().includes(query) ||
        sub.contacts.some((c) => c.name.toLowerCase().includes(query))
      )
    })
  }, [subcontractors, search, tradeFilter])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !canManage || !form.name.trim() || !form.subcontractorType.trim()) return
    setSaving(true)
    try {
      const subcontractor: Subcontractor = {
        id: newUuid(),
        name: form.name.trim(),
        subcontractorType: form.subcontractorType.trim(),
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        contacts: form.contactName.trim()
          ? [{
              id: newUuid(),
              name: form.contactName.trim(),
              email: form.contactEmail.trim(),
              contactNumber: form.contactNumber.trim(),
              position: 'Installer',
              createdAt: new Date(),
            }]
          : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await saveSubcontractor(organization.id, subcontractor)
      setForm({ name: '', subcontractorType: '', website: '', address: '', contactName: '', contactEmail: '', contactNumber: '' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub contractors"
        description="Subcontractor firms and operatives — matches iOS SubcontractorsView."
        meta={`${subcontractors.length} firms · organizations/${organization?.id || '…'}/subcontractors`}
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <SearchField value={search} onChange={setSearch} placeholder="Search firms, trades, contacts…" />
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm">
          {tradeTypes.map((trade) => (
            <option key={trade} value={trade}>{trade}</option>
          ))}
        </select>
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Add subcontractor firm</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Firm name" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input required value={form.subcontractorType} onChange={(e) => setForm({ ...form, subcontractorType: e.target.value })} placeholder="Trade type" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Contact name" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="Contact email" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} placeholder="Contact number" className="rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add subcontractor'}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No subcontractors yet" description="Add subcontractor firms on web or iOS." />
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div key={sub.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)} className="flex w-full items-start justify-between gap-4 p-5 text-left">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{sub.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">{sub.subcontractorType}</span>
                    {' · '}{sub.contacts.length} operative{sub.contacts.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-slate-400">{expandedId === sub.id ? '▲' : '▼'}</span>
              </button>
              {expandedId === sub.id && (
                <div className="border-t border-slate-100 px-5 pb-5">
                  {sub.website && <p className="mt-3 text-sm text-slate-600">{sub.website}</p>}
                  {sub.address && <p className="text-sm text-slate-600">{sub.address}</p>}
                  <div className="mt-3 space-y-2">
                    {sub.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">{contact.name} · {contact.position}</p>
                        <p className="text-slate-600">{contact.email} {contact.contactNumber && `· ${contact.contactNumber}`}</p>
                      </div>
                    ))}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!organization?.id) return
                        if (window.confirm(`Delete ${sub.name}?`)) deleteSubcontractor(organization.id, sub.id)
                      }}
                      className="mt-4 text-sm text-red-600 hover:text-red-800"
                    >
                      Delete firm
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

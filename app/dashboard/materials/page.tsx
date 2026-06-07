'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { MATERIAL_UNITS, useMaterialCatalogStore } from '@/lib/stores/materialCatalogStore'
import { canManageMaterialCatalogue } from '@/lib/navigation/menuPermissions'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import type { MaterialCatalogItem, MaterialLengthUnit, MaterialUnit } from '@/types'
import { EmptyState, ErrorBanner, LoadingSpinner, PageHeader, SearchField } from '@/components/dashboard/PageShell'

const LENGTH_UNITS: MaterialLengthUnit[] = ['M', 'MM']

export default function MaterialsPage() {
  const { organization, user } = useAuthStore()
  const { items, loading, error, loadItems, saveItem, deleteItem } = useMaterialCatalogStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    brand: '',
    productCode: '',
    defaultUnit: 'Number' as MaterialUnit,
    size: '',
    length: '',
    lengthUnit: '' as MaterialLengthUnit | '',
    category: 'Other',
  })

  const canManage = canManageMaterialCatalogue(user)

  useEffect(() => {
    if (organization?.id) loadItems(organization.id)
  }, [organization, loadItems])

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category || 'Other'))
    return ['All', ...Array.from(set).sort()]
  }, [items])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query) ||
        (item.productCode || '').toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    })
  }, [items, search, categoryFilter])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !user || !canManage || !form.name.trim() || !form.brand.trim()) return
    setSaving(true)
    try {
      const item: Omit<MaterialCatalogItem, 'createdAt'> = {
        id: newUuid(),
        name: form.name.trim(),
        brand: form.brand.trim(),
        productCode: form.productCode.trim() || undefined,
        defaultUnit: form.defaultUnit,
        size: form.size.trim() || undefined,
        length: form.length.trim() || undefined,
        lengthUnit: form.lengthUnit || undefined,
        category: form.category.trim() || 'Other',
        createdByUserId: user.id,
        createdByName: `${user.firstName} ${user.surname}`.trim() || user.email,
      }
      await saveItem(organization.id, item)
      setForm({
        name: '',
        brand: '',
        productCode: '',
        defaultUnit: 'Number',
        size: '',
        length: '',
        lengthUnit: '',
        category: 'Other',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material catalogue"
        description="Organisation materials library — synced with iOS via Firebase."
        meta={`${items.length} materials · organizations/{orgId}/materialCatalogue`}
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <SearchField value={search} onChange={setSearch} placeholder="Search name, brand, code, category…" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Add material</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Material name" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} placeholder="Product code" className="rounded-lg border border-slate-300 px-3 py-2" />
            <select value={form.defaultUnit} onChange={(e) => setForm({ ...form, defaultUnit: e.target.value as MaterialUnit })} className="rounded-lg border border-slate-300 px-3 py-2">
              {MATERIAL_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Size" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} placeholder="Length" className="rounded-lg border border-slate-300 px-3 py-2" />
            <select value={form.lengthUnit} onChange={(e) => setForm({ ...form, lengthUnit: e.target.value as MaterialLengthUnit | '' })} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Length unit</option>
              {LENGTH_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className="rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add to catalogue'}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No materials yet" description="Add materials here or in the iOS app — they share the same Firebase catalogue." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Material</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Brand / Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Size / Length</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">Added by</th>
                {canManage && <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.brand}
                    {item.productCode ? ` · ${item.productCode}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.defaultUnit}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {[item.size, item.length ? `${item.length}${item.lengthUnit || ''}` : ''].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{item.createdByName}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (!organization?.id) return
                          if (window.confirm(`Delete "${item.name}"?`)) deleteItem(organization.id, item.id)
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
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
    </div>
  )
}

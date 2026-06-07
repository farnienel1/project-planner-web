'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import type { OrgCollectionKey } from '@/lib/firebase/orgCollections'
import { useCatalogStore } from '@/lib/stores/catalogStore'

type FirestoreCatalogPageProps = {
  collectionKey: OrgCollectionKey
  title: string
  description: string
  emptyHint: string
  nameFieldLabel?: string
  canManage?: boolean
}

export function FirestoreCatalogPage({
  collectionKey,
  title,
  description,
  emptyHint,
  nameFieldLabel = 'Name',
  canManage = true,
}: FirestoreCatalogPageProps) {
  const { organization } = useAuthStore()
  const { records, loading, error, loadCatalog, addRecord, deleteRecord } = useCatalogStore()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (organization?.id) {
      loadCatalog(organization.id, collectionKey)
    }
  }, [organization, collectionKey, loadCatalog])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !name.trim() || !canManage) return
    setSaving(true)
    try {
      await addRecord(organization.id, collectionKey, { name: name.trim() })
      setName('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!organization?.id || !canManage) return
    if (!window.confirm('Delete this item? This will sync to all devices.')) return
    await deleteRecord(organization.id, collectionKey, id)
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
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-slate-600">{description}</p>
        <p className="mt-2 text-xs text-slate-500">
          Synced with Firebase — changes appear in the iOS app immediately.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">{nameFieldLabel}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder={`Add ${nameFieldLabel.toLowerCase()}…`}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-medium text-slate-900">No records yet</h3>
          <p className="mt-2 text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  {nameFieldLabel}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Details
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{record.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{record.subtitle || '—'}</td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
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

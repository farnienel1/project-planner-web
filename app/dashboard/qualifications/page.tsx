'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export default function QualificationsPage() {
  const { organization, user } = useAuthStore()
  const { qualifications, loading, loadQualifications } = useOperativeStore()
  const [name, setName] = useState('')
  const [hasEndDate, setHasEndDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const canManage = user?.permissions?.qualifications || user?.isSuperAdmin

  useEffect(() => {
    if (organization?.id) {
      loadQualifications(organization.id)
    }
  }, [organization, loadQualifications])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !name.trim() || !canManage) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'organizations', organization.id, 'qualifications'), {
        name: name.trim(),
        hasEndDate,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      setName('')
      await loadQualifications(organization.id)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!organization?.id || !canManage) return
    if (!window.confirm('Delete this qualification?')) return
    await deleteDoc(doc(db, 'organizations', organization.id, 'qualifications', id))
    await loadQualifications(organization.id)
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
        <h1 className="text-3xl font-bold text-slate-900">Qualifications</h1>
        <p className="mt-1 text-slate-600">Qualification types used on operative profiles</p>
      </div>

      {canManage && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Qualification name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} />
            Has expiry date
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Add
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Expiry tracking</th>
              {canManage && <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {qualifications.map((qual) => (
              <tr key={qual.id}>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{qual.name}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{qual.hasEndDate ? 'Yes' : 'No'}</td>
                {canManage && (
                  <td className="px-6 py-4 text-right">
                    <button type="button" onClick={() => handleDelete(qual.id)} className="text-sm text-red-600">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

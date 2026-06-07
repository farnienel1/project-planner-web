'use client'

import { FormEvent, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { ORG_SETTINGS_JOB_TYPES_DOC } from '@/lib/firebase/orgCollections'
import { useAuthStore } from '@/lib/stores/authStore'

export default function JobTypesPage() {
  const { organization, user } = useAuthStore()
  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [newType, setNewType] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canManage = user?.permissions?.adminAccess || user?.isSuperAdmin

  const docRef = organization?.id
    ? doc(db, 'organizations', organization.id, 'settings', ORG_SETTINGS_JOB_TYPES_DOC)
    : null

  const load = async () => {
    if (!docRef) return
    setLoading(true)
    setError(null)
    try {
      const snap = await getDoc(docRef)
      const list = snap.data()?.jobTypes
      setJobTypes(Array.isArray(list) ? list.filter((t): t is string => typeof t === 'string') : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load job types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id])

  const persist = async (next: string[]) => {
    if (!docRef || !organization?.id || !canManage) return
    setSaving(true)
    try {
      await setDoc(
        docRef,
        {
          jobTypes: next,
          organizationId: organization.id,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
      setJobTypes(next)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = newType.trim()
    if (!trimmed || jobTypes.includes(trimmed)) return
    await persist([...jobTypes, trimmed].sort((a, b) => a.localeCompare(b)))
    setNewType('')
  }

  const handleRemove = async (name: string) => {
    await persist(jobTypes.filter((t) => t !== name))
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
        <h1 className="text-3xl font-bold text-slate-900">Job types</h1>
        <p className="mt-1 text-slate-600">
          Same document as iOS: <code className="text-xs">organizations/…/settings/jobTypes</code>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {canManage && (
        <form onSubmit={handleAdd} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="New job type"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
        {jobTypes.length === 0 ? (
          <li className="p-6 text-center text-slate-500">No job types yet.</li>
        ) : (
          jobTypes.map((type) => (
            <li key={type} className="flex items-center justify-between px-6 py-3">
              <span className="text-sm font-medium text-slate-900">{type}</span>
              {canManage && (
                <button type="button" onClick={() => handleRemove(type)} className="text-sm text-red-600">
                  Remove
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

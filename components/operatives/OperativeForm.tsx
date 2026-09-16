'use client'

import { FormEvent, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Operative } from '@/types'
import { FormActions, FormInput, FormLabel } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'

export function OperativeForm({
  initial,
  backHref,
  onSaved,
}: {
  initial?: Operative | null
  backHref: string
  onSaved: (id: string) => void
}) {
  const { organization } = useAuthStore()
  const { saveOperative } = useOperativeStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    hourlyRate: initial?.hourlyRate?.toString() || '',
    startDate: initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    isActive: initial?.isActive !== false,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const operative: Operative = {
        id: initial?.id || '',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        startDate: new Date(form.startDate),
        hourlyRate: Number(form.hourlyRate) || 0,
        skills: initial?.skills || [],
        qualifications: initial?.qualifications || [],
        isActive: form.isActive,
        organizationId: organization.id,
        createdAt: initial?.createdAt || new Date(),
        updatedAt: new Date(),
      }
      const id = await saveOperative(organization.id, operative)
      onSaved(id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save operative')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && <ErrorBanner message={error} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div><FormLabel required>First name</FormLabel><FormInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
        <div><FormLabel required>Last name</FormLabel><FormInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
        <div><FormLabel required>Email</FormLabel><FormInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div><FormLabel>Phone</FormLabel><FormInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><FormLabel>Day rate</FormLabel><FormInput type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
        <div><FormLabel>Start date</FormLabel><FormInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
      </div>
      <FormActions saving={saving} submitLabel={initial ? 'Save operative' : 'Add operative'} cancelHref={backHref} />
    </form>
  )
}

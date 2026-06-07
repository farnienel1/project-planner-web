'use client'

import { FormEvent, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Manager } from '@/types'
import { FormActions, FormInput, FormLabel } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'

export function ManagerForm({
  initial,
  backHref,
  onSaved,
}: {
  initial?: Manager | null
  backHref: string
  onSaved: (id: string) => void
}) {
  const { organization } = useAuthStore()
  const { saveManager } = useOperativeStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    mobile: initial?.mobile || initial?.phone || '',
    department: initial?.department || '',
    isActive: initial?.isActive !== false,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const manager: Manager = {
        id: initial?.id || '',
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || undefined,
        department: form.department.trim() || undefined,
        isActive: form.isActive,
        organizationId: organization.id,
        createdAt: initial?.createdAt || new Date(),
        updatedAt: new Date(),
      }
      const id = await saveManager(organization.id, manager)
      onSaved(id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save manager')
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
        <div><FormLabel>Mobile</FormLabel><FormInput value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
        <div><FormLabel>Department</FormLabel><FormInput value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
      </div>
      <FormActions saving={saving} submitLabel={initial ? 'Save manager' : 'Add manager'} cancelHref={backHref} />
    </form>
  )
}

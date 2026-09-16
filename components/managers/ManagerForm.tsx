'use client'

import { FormEvent, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Manager } from '@/types'
import { STAFF_TRADE_TYPES } from '@/lib/ios-parity/enums'
import { FormActions, FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
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
    notes: initial?.notes || '',
    tradeTypePreset: initial?.tradeTypePreset || '',
    tradeTypeCustom: initial?.tradeTypeCustom || '',
    isActive: initial?.isActive !== false,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    if (!form.tradeTypePreset.trim() && !form.tradeTypeCustom.trim()) {
      setError('Trade type is required.')
      return
    }
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
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
        tradeTypePreset: form.tradeTypePreset.trim() || undefined,
        tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || undefined : undefined,
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ios-border bg-ios-card p-6">
      {error && <ErrorBanner message={error} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel required>First Name</FormLabel>
          <FormInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Last Name</FormLabel>
          <FormInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Email</FormLabel>
          <FormInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Mobile</FormLabel>
          <FormInput value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Trade type</FormLabel>
          <FormSelect
            value={form.tradeTypePreset}
            onChange={(e) => setForm({ ...form, tradeTypePreset: e.target.value })}
            required
          >
            <option value="">Select trade type</option>
            {STAFF_TRADE_TYPES.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </FormSelect>
        </div>
        {form.tradeTypePreset === 'Other' ? (
          <div>
            <FormLabel required>Custom trade</FormLabel>
            <FormInput
              value={form.tradeTypeCustom}
              onChange={(e) => setForm({ ...form, tradeTypeCustom: e.target.value })}
              required
            />
          </div>
        ) : null}
        <div>
          <FormLabel>Department</FormLabel>
          <FormInput value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <FormLabel>Notes</FormLabel>
          <FormTextarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <FormActions saving={saving} submitLabel={initial ? 'Save manager' : 'Create manager'} cancelHref={backHref} />
    </form>
  )
}

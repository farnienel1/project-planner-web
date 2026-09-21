'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Operative } from '@/types'
import { STAFF_TRADE_TYPES } from '@/lib/ios-parity/enums'
import { FormActions, FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
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
  const { saveOperative, operatives, loadOperatives } = useOperativeStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    dayRate: initial?.dayRate?.toString() || initial?.hourlyRate?.toString() || '',
    startDate: initial?.startDate
      ? new Date(initial.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    tradeTypePreset: initial?.tradeTypePreset || '',
    tradeTypeCustom: initial?.tradeTypeCustom || '',
    isActive: initial?.isActive !== false,
  })

  useEffect(() => {
    if (organization?.id) loadOperatives(organization.id)
  }, [organization?.id, loadOperatives])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    const first = form.firstName.trim()
    const last = form.lastName.trim()
    const duplicate = operatives.some(
      (row) =>
        row.id !== initial?.id &&
        row.firstName.trim().toLowerCase() === first.toLowerCase() &&
        row.lastName.trim().toLowerCase() === last.toLowerCase()
    )
    if (duplicate) {
      setError('An operative with this first and last name already exists.')
      return
    }
    if (!form.tradeTypePreset.trim() && !form.tradeTypeCustom.trim()) {
      setError('Trade type is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rate = Number(form.dayRate) || 0
      const operative: Operative = {
        id: initial?.id || '',
        firstName: first,
        lastName: last,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        startDate: new Date(`${form.startDate}T12:00:00`),
        hourlyRate: rate,
        dayRate: rate,
        skills: initial?.skills || [],
        qualifications: initial?.qualifications || [],
        isActive: form.isActive,
        tradeTypePreset: form.tradeTypePreset.trim() || undefined,
        tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || undefined : undefined,
        organizationId: organization.id,
        createdAt: initial?.createdAt || new Date(),
        updatedAt: new Date(),
      }
      const id = await saveOperative(organization.id, operative)
      try {
        const previous = initial?.dayRate ?? initial?.hourlyRate
        const next = rate
        if (previous !== next) {
          const { loadOperativeDayRateHistory, recordDayRateChangeIfNeeded } = await import(
            '@/lib/timesheets/dayRateHistoryStorage'
          )
          const history = await loadOperativeDayRateHistory(organization.id)
          await recordDayRateChangeIfNeeded({
            organizationId: organization.id,
            operativeId: id,
            previousDayRate: previous,
            nextDayRate: next,
            createdAt: operative.createdAt,
            history,
          })
        }
      } catch {
        // Best-effort history so roster saves still succeed.
      }
      onSaved(id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save operative')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card pad stack">
      {error && <ErrorBanner message={error} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel required>First Name</FormLabel>
          <FormInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Surname</FormLabel>
          <FormInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Email</FormLabel>
          <FormInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Phone</FormLabel>
          <FormInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
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
          <FormLabel>Day Rate (Optional)</FormLabel>
          <FormInput
            type="number"
            step="0.01"
            value={form.dayRate}
            onChange={(e) => setForm({ ...form, dayRate: e.target.value })}
          />
        </div>
        <div>
          <FormLabel>Start date</FormLabel>
          <FormInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
      </div>
      <FormActions saving={saving} submitLabel={initial ? 'Save operative' : 'Create New Operative'} cancelHref={backHref} />
    </form>
  )
}

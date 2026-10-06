'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import type { Operative } from '@/types'
import { STAFF_TRADE_TYPES } from '@/lib/ios-parity/enums'
import { FormActions, FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import { PayBasisFields, payChoiceFromProfile, payChoiceToRates } from '@/components/users/PayBasisFields'
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
  const { users, loadUsers } = useOrgUserStore()
  const { saveUser } = useUserStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    payBasis: payChoiceFromProfile(initial).payBasis,
    rateAmount: payChoiceFromProfile(initial).amount,
    startDate: initial?.startDate
      ? new Date(initial.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    tradeTypePreset: initial?.tradeTypePreset || '',
    tradeTypeCustom: initial?.tradeTypeCustom || '',
    isActive: initial?.isActive !== false,
  })

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadUsers(organization.id)
    }
  }, [organization?.id, loadOperatives, loadUsers])

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
      const rates = payChoiceToRates(form.payBasis, form.rateAmount)
      const operative: Operative = {
        id: initial?.id || '',
        firstName: first,
        lastName: last,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        startDate: new Date(`${form.startDate}T12:00:00`),
        payBasis: rates.payBasis,
        hourlyRate: rates.payBasis === 'hourly' ? rates.hourlyRate ?? 0 : 0,
        dayRate: rates.payBasis === 'day' ? rates.dayRate : undefined,
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
      const linked = users.find((row) => row.email.trim().toLowerCase() === operative.email.trim().toLowerCase())
      if (linked) {
        await saveUser(
          {
            ...linked,
            payBasis: rates.payBasis,
            dayRate: rates.dayRate,
            hourlyRate: rates.payBasis === 'hourly' ? rates.hourlyRate : undefined,
          },
          organization.id
        )
      }
      try {
        const previousBasis = initial?.payBasis
        const previousAmount = previousBasis === 'hourly' ? initial?.hourlyRate : initial?.dayRate
        const { loadOperativeDayRateHistory, recordDayRateChangeIfNeeded } = await import(
          '@/lib/timesheets/dayRateHistoryStorage'
        )
        const history = await loadOperativeDayRateHistory(organization.id)
        await recordDayRateChangeIfNeeded({
          organizationId: organization.id,
          userId: linked?.id,
          operativeId: id,
          previousDayRate: previousAmount ?? null,
          nextDayRate: rates.payBasis === 'hourly' ? rates.hourlyRate ?? null : rates.dayRate ?? null,
          previousPayBasis: previousBasis,
          nextPayBasis: rates.payBasis,
          createdAt: operative.createdAt,
          history,
        })
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
        <PayBasisFields
          payBasis={form.payBasis}
          amount={form.rateAmount}
          onChange={(next) => setForm({ ...form, payBasis: next.payBasis, rateAmount: next.amount })}
        />
        <div>
          <FormLabel>Start date</FormLabel>
          <FormInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
      </div>
      <FormActions saving={saving} submitLabel={initial ? 'Save operative' : 'Create New Operative'} cancelHref={backHref} />
    </form>
  )
}

'use client'

import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInOrganizationZone } from '@/lib/canonical'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import type { Operative } from '@/types'
import { STAFF_TRADE_TYPES } from '@/lib/ios-parity/enums'
import { FormActions, FormInput, FormLabel, FormSelect } from '@/components/forms/FormShell'
import { PayBasisFields, payChoiceFromProfile, payChoiceToRates } from '@/components/users/PayBasisFields'
import { usePaySaveGate } from '@/components/users/PayRateChangeDialogs'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { isPlausibleDayKey } from '@/lib/security/boundedValue'

export function OperativeForm({
  initial,
  backHref,
  onSaved,
}: {
  initial?: Operative | null
  backHref: string
  onSaved: (id: string) => void
}) {
  const { organization, user: signedInUser } = useAuthStore()
  const { saveOperative, operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const { saveUser } = useUserStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { request: requestPaySave, ui: payDialogs } = usePaySaveGate()
  const timeZone = useOrganizationTimeZone()
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    payBasis: payChoiceFromProfile(initial).payBasis,
    rateAmount: payChoiceFromProfile(initial).amount,
    // Organisation day keys, not UTC dates (a UTC slice shows the previous day for an evening instant).
    startDate: dayKeyInOrganizationZone(
      (initial?.startDate ? new Date(initial.startDate) : new Date()).toISOString(),
      timeZone
    ),
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
    if (!isPlausibleDayKey(form.startDate)) {
      setError('Enter a valid start date.')
      return
    }
    const rates = payChoiceToRates(form.payBasis, form.rateAmount)
    const linkedPreview = users.find((row) => row.email.trim().toLowerCase() === form.email.trim().toLowerCase())
    const createdAt = initial?.createdAt || new Date()
    const decision = await requestPaySave({
      existing: Boolean(initial),
      employmentType: linkedPreview?.employmentType,
      previous: initial,
      next: rates,
      createdAt,
    })
    if (decision === 'cancel') return
    setSaving(true)
    setError(null)
    try {
      const operative: Operative = {
        id: initial?.id || '',
        firstName: first,
        lastName: last,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        // Midday on that organisation day, so every zone reads the same calendar day back.
        startDate: new Date(dateFromDayKey(form.startDate, timeZone).getTime() + 12 * 60 * 60 * 1000),
        payBasis: rates.payBasis,
        hourlyRate: rates.payBasis === 'hourly' ? rates.hourlyRate ?? 0 : 0,
        dayRate: rates.payBasis === 'day' ? rates.dayRate : undefined,
        skills: initial?.skills || [],
        qualifications: initial?.qualifications || [],
        isActive: form.isActive,
        tradeTypePreset: form.tradeTypePreset.trim() || undefined,
        tradeTypeCustom: form.tradeTypePreset === 'Other' ? form.tradeTypeCustom.trim() || undefined : undefined,
        organizationId: organization.id,
        createdAt,
        updatedAt: new Date(),
      }
      // Rulebook 1.10.0 §8 (`payRateChangeWrites`): work out the pay history rows before anything is written; a
      // history that did not load refuses the save (never a duplicate seed row).
      const previousBasis = initial?.payBasis
      const previousAmount = previousBasis === 'hourly' ? initial?.hourlyRate : initial?.dayRate
      const { loadOperativeDayRateHistoryOrNull, payHistoryBatchRows } = await import('@/lib/timesheets/dayRateHistoryStorage')
      const linked = users.find((row) => row.email.trim().toLowerCase() === operative.email.trim().toLowerCase())
      const nextAmount = rates.payBasis === 'hourly' ? rates.hourlyRate ?? null : rates.dayRate ?? null
      const payChanged = (previousAmount ?? null) !== nextAmount || (previousBasis ?? null) !== (rates.payBasis ?? null)
      const historyRowsFor = async (operativeId: string) =>
        payChanged
          ? payHistoryBatchRows({
              history: await loadOperativeDayRateHistoryOrNull(organization.id),
              userId: linked?.id,
              operativeId,
              previous: { rate: previousAmount ?? null, payBasis: previousBasis ?? null },
              next: { rate: nextAmount, payBasis: rates.payBasis },
              effectiveAt: decision instanceof Date ? decision : new Date(),
              seedEffective: operative.createdAt ?? null,
              timeZone,
            })
          : []
      const preflightRows = initial?.id ? await historyRowsFor(initial.id) : []
      const id = await saveOperative(organization.id, operative)
      const historyRows = initial?.id ? preflightRows : await historyRowsFor(id)
      if (linked) {
        await saveUser(
          {
            ...linked,
            payBasis: rates.payBasis,
            dayRate: rates.dayRate,
            hourlyRate: rates.hourlyRate,
          },
          organization.id,
          undefined,
          // Partial update of the changed pay fields only (rulebook §1, `userProfileWriteFields`), with the pay
          // history rows in the same batch (1.10.0).
          { baseline: linked, payHistoryRows: historyRows }
        )
      } else if (historyRows.length > 0 || payChanged) {
        const { writeBatch, doc, deleteField } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase/config')
        const { addPayProfileWrite } = await import('@/lib/pay/payProfileService')
        const batch = writeBatch(db)
        for (const row of historyRows) batch.set(doc(db, 'organizations', organization.id, 'operativeDayRateHistory', row.id), row.fields)
        // Rulebook 1.13.0 (Q1): a catalogue operative's pay also goes to its private pay profile (payProfiles/{rowId}).
        if (payChanged) {
          addPayProfileWrite(
            batch,
            organization.id,
            id,
            {
              payBasis: rates.payBasis ?? deleteField(),
              dayRate: rates.payBasis === 'hourly' ? deleteField() : rates.dayRate ?? deleteField(),
              hourlyRate: rates.payBasis === 'hourly' ? rates.hourlyRate ?? deleteField() : deleteField(),
            },
            signedInUser?.id || ''
          )
        }
        await batch.commit()
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
      {payDialogs}
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

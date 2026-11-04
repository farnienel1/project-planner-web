'use client'

/**
 * Rulebook 1.29.0 §4.5: "Set PAYE payday" — a day of the month (1–31) for PAYE payruns, saved on its own (admins,
 * online only). `payePaydayWriteFields` appends to the dated history, so a change applies from the next payrun and
 * past payruns keep their dates.
 */
import { useMemo, useState } from 'react'
import {
  PAYE_PAYDAY_CONTROL_LABEL,
  PAYE_PAYDAY_HELP,
  PAYE_PAYDAY_MAX,
  PAYE_PAYDAY_MIN,
  payePayday,
  payePaydayHistory,
  payePayrunSummary,
  payePaydayValidationError,
  formatPayePayrunDay,
} from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { savePayePayday } from '@/lib/overtime/overtimeData'
import { SectionLabel, SettingsCard } from '@/components/settings/primitives'

export function PayePaydayCard({ canEdit, step }: { canEdit: boolean; step?: number }) {
  const { organization } = useAuthStore()
  const { data, loaded } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const todayKey = dayKeyInZone(new Date(), timeZone)
  const saved = payePayday(data)
  const [picked, setPicked] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const summary = useMemo(() => payePayrunSummary(data, todayKey), [data, todayKey])
  const pending = useMemo(() => payePaydayHistory(data).filter((row) => row.effectiveFrom > todayKey).pop() ?? null, [data, todayKey])
  const days = Array.from({ length: PAYE_PAYDAY_MAX - PAYE_PAYDAY_MIN + 1 }, (_, i) => i + PAYE_PAYDAY_MIN)

  const save = async () => {
    if (!organization?.id || picked == null) return
    const error = payePaydayValidationError(picked)
    if (error) {
      setMessage(error)
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const wrote = await savePayePayday(organization.id, data, picked, todayKey)
      setMessage(wrote ? 'PAYE payday saved. It applies from the next PAYE payrun.' : 'That is already the PAYE payday.')
      setOpen(false)
      setPicked(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the PAYE payday.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SectionLabel step={step} label="PAYE payday" description={PAYE_PAYDAY_HELP} />
      <SettingsCard>
        <div className="space-y-3 p-5">
          <p className="text-[14px] text-[var(--ink)]">
            {!loaded
              ? 'Loading…'
              : summary.notConfigured
                ? 'No PAYE payday set. PAYE overtime uses a custom date range until one is set.'
                : summary.label}
          </p>
          {pending ? (
            <p className="text-[13px] text-[var(--ink3)]">
              Changes to the {pending.day}
              {ordinal(pending.day)} from {formatPayePayrunDay(pending.effectiveFrom)}.
            </p>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn" onClick={() => setOpen((value) => !value)} disabled={!loaded}>
              {PAYE_PAYDAY_CONTROL_LABEL}
              {saved ? ` (now the ${saved}${ordinal(saved)})` : ''}
            </button>
          ) : null}
          {open && canEdit ? (
            <div className="space-y-3">
              <div className="[display:grid] grid-cols-7 gap-1" role="listbox" aria-label="Day of the month">
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    role="option"
                    aria-selected={picked === day}
                    onClick={() => setPicked(day)}
                    className={`h-9 rounded-md text-[13px] font-semibold tabular-nums ${
                      picked === day ? 'bg-[var(--blue)] text-white' : 'bg-[var(--soft2)] text-[var(--ink)]'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {picked != null && picked >= 29 ? (
                <p className="text-[13px] text-[var(--ink3)]">In shorter months the payday is the last day of the month.</p>
              ) : null}
              <button type="button" className="btn primary" disabled={picked == null || saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save PAYE payday'}
              </button>
            </div>
          ) : null}
          {message ? <p className="text-[13px] text-[var(--ink2)]">{message}</p> : null}
        </div>
      </SettingsCard>
    </>
  )
}

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  return day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
}

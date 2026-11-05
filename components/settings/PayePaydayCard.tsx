'use client'

/**
 * Rulebook 1.29.0 §4.5 / 1.32.0: "Set PAYE payday" — a day of the month (1–31) for PAYE payruns. 1.32.0 (owner
 * decision 4 Nov): the pick is part of the Payment runs draft and is saved by the screen's main Save
 * (`saveInvoicingSettings` → `payePaydayWriteFields`, append-only history, applies from the next payrun); a banner
 * shows while none is set (`payePaydayBanner`).
 */
import { useMemo } from 'react'
import {
  PAYE_PAYDAY_CONTROL_LABEL,
  PAYE_PAYDAY_HELP,
  PAYE_PAYDAY_MAX,
  PAYE_PAYDAY_MIN,
  payePayday,
  payePaydayBanner,
  payePaydayHistory,
  payePayrunSummary,
  formatPayePayrunDay,
} from '@/lib/canonical'
import { useOrganizationDocument, useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { SectionLabel, SettingsCard } from '@/components/settings/primitives'

export function PayePaydayCard({
  canEdit,
  step,
  picked,
  onPick,
}: {
  canEdit: boolean
  step?: number
  /** The unsaved pick (null: unchanged); saved by the Payment runs Save. */
  picked: number | null
  onPick: (day: number | null) => void
}) {
  const { data, loaded } = useOrganizationDocument()
  const timeZone = useOrganizationTimeZone()
  const todayKey = dayKeyInZone(new Date(), timeZone)
  const saved = payePayday(data)
  const summary = useMemo(() => payePayrunSummary(data, todayKey), [data, todayKey])
  const pending = useMemo(() => payePaydayHistory(data).filter((row) => row.effectiveFrom > todayKey).pop() ?? null, [data, todayKey])
  const banner = payePaydayBanner({ organization: data, loaded, viewerIsAdmin: canEdit })
  const days = Array.from({ length: PAYE_PAYDAY_MAX - PAYE_PAYDAY_MIN + 1 }, (_, i) => i + PAYE_PAYDAY_MIN)
  const shown = picked ?? saved

  return (
    <>
      <SectionLabel step={step} label="PAYE payday" description={PAYE_PAYDAY_HELP} />
      <SettingsCard>
        <div className="space-y-3 p-5">
          {banner ? <p className="rounded-lg bg-[#FFF4E5] px-3 py-2 text-[13px] text-[#8A4B00]">{banner}</p> : null}
          <p className="text-[14px] text-[var(--ink)]">{!loaded ? 'Loading…' : summary.notConfigured ? 'No PAYE payday set.' : summary.label}</p>
          {pending ? (
            <p className="text-[13px] text-[var(--ink3)]">
              Changes to the {pending.day}
              {ordinal(pending.day)} from {formatPayePayrunDay(pending.effectiveFrom)}.
            </p>
          ) : null}
          {canEdit ? (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-[var(--ink2)]">{PAYE_PAYDAY_CONTROL_LABEL}</p>
              <div className="[display:grid] grid-cols-7 gap-1" role="listbox" aria-label="Day of the month">
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    role="option"
                    aria-selected={shown === day}
                    disabled={!loaded}
                    onClick={() => onPick(day === saved ? null : day)}
                    className={`h-9 rounded-md text-[13px] font-semibold tabular-nums ${
                      shown === day ? 'bg-[var(--blue)] text-white' : 'bg-[var(--soft2)] text-[var(--ink)]'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {shown != null && shown >= 29 ? (
                <p className="text-[13px] text-[var(--ink3)]">In shorter months the payday is the last day of the month.</p>
              ) : null}
              {picked != null ? <p className="text-[13px] text-[var(--ink2)]">Press Save to apply it from the next PAYE payrun.</p> : null}
            </div>
          ) : null}
        </div>
      </SettingsCard>
    </>
  )
}

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  return day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
}

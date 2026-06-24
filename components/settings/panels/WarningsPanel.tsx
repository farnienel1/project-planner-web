'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  DEFAULT_WARNING_DETECTION,
  loadOrganizationDetails,
  saveWarningDetection,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import { personDisplayName } from '@/lib/settings/orgHubUtils'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  Toggle,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

function ModeOption({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-blue-600' : 'border-slate-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
      </span>
      <span>
        <span className={`block text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-900'}`}>{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  )
}

function SeverityRow({ title, description, tone }: { title: string; description: string; tone: 'red' | 'amber' | 'blue' }) {
  const map = {
    red: { dot: 'bg-red-500', bg: 'bg-red-50 border-red-200', title: 'text-red-700', text: 'text-red-600' },
    amber: { dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', title: 'text-amber-700', text: 'text-amber-600' },
    blue: { dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200', title: 'text-blue-700', text: 'text-blue-600' },
  }[tone]
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${map.bg}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${map.dot}`} />
      <div>
        <div className={`text-xs font-bold ${map.title}`}>{title}</div>
        <div className={`mt-0.5 text-xs ${map.text}`}>{description}</div>
      </div>
    </div>
  )
}

export function WarningsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()

  const [draft, setDraft] = useState<OrgWarningDetectionSettings>(DEFAULT_WARNING_DETECTION)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id)
      .then((details) => {
        if (details?.warningDetection) setDraft(details.warningDetection)
      })
      .catch(() => {})
  }, [organization?.id])

  function patch(partial: Partial<OrgWarningDetectionSettings>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  const excluded = draft.excludedUserIdsFromUnbookedWarnings ?? []
  const activeUsers = users.filter((u) => u.isActive)
  const filtered = (() => {
    const q = search.trim().toLowerCase()
    const sorted = [...activeUsers].sort((a, b) => personDisplayName(a).localeCompare(personDisplayName(b)))
    if (!q) return sorted
    return sorted.filter(
      (u) => personDisplayName(u).toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
    )
  })()

  function toggleExcluded(id: string) {
    patch({
      excludedUserIdsFromUnbookedWarnings: excluded.includes(id)
        ? excluded.filter((entry) => entry !== id)
        : [...excluded, id],
    })
  }

  async function save() {
    if (!organization?.id) return
    setSaving(true)
    setError('')
    try {
      await saveWarningDetection(organization.id, draft)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save warning settings.')
    } finally {
      setSaving(false)
    }
  }

  const mode = draft.clashLookaheadMode
  const days = draft.clashLookaheadDays

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <PanelHeader title="Warnings" onBack={onBack} />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {saved && (
        <div className="mt-4">
          <SuccessBanner message="Warning settings saved" />
        </div>
      )}

      <p className="mt-4 px-1 text-sm text-slate-500">
        Control how and when your team is alerted to scheduling issues.
      </p>

      <SectionLabel label="Detection period" />
      <SettingsCard>
        <div className="space-y-3 p-4">
          <p className="text-xs text-slate-500">
            How far ahead Project Planner scans for clashes, unbooked labour, and material cut-off dates. Warnings
            refresh automatically each day.
          </p>
          <ModeOption
            selected={mode === 'numberOfDays'}
            label="Set number of days"
            description="Scan a fixed number of days from today — you control the window."
            onClick={() => patch({ clashLookaheadMode: 'numberOfDays' })}
          />
          <ModeOption
            selected={mode === 'endOfInvoicingPeriod'}
            label="End of invoicing period"
            description="Scan through the end of your current billing period. Adjusts automatically each period."
            onClick={() => patch({ clashLookaheadMode: 'endOfInvoicingPeriod' })}
          />
          <ModeOption
            selected={mode === 'endOfWorkingWeek'}
            label="End of working week"
            description="Scan through Friday of the current working week. Resets each Monday."
            onClick={() => patch({ clashLookaheadMode: 'endOfWorkingWeek' })}
          />

          {mode === 'numberOfDays' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Days ahead</div>
                  <div className="text-xs text-slate-500">Minimum 1 · Maximum 365</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => patch({ clashLookaheadDays: Math.max(1, days - 1) })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label="Decrease days"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-lg font-bold text-slate-900">{days}</span>
                  <button
                    type="button"
                    onClick={() => patch({ clashLookaheadDays: Math.min(365, days + 1) })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label="Increase days"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'endOfInvoicingPeriod' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              Warnings will scan through the end of your current invoicing period. This window resets automatically when
              the new period begins.
            </div>
          )}

          {mode === 'endOfWorkingWeek' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              Warnings will scan through Friday of the current working week, resetting each Monday.
            </div>
          )}
        </div>
      </SettingsCard>

      <SectionLabel label="Excluded users" />
      <SettingsCard>
        <div className="space-y-3 p-4">
          <p className="text-xs text-slate-500">
            Some staff (e.g. PAYE employees) don&apos;t need to appear in unbooked labour warnings. Users added here are
            silently skipped by the warnings engine.
          </p>

          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            <span>Manage excluded users</span>
            <span className="flex items-center gap-2">
              {excluded.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {excluded.length}
                </span>
              )}
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${pickerOpen ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </button>

          {pickerOpen && (
            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 p-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No active users to exclude.</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {filtered.map((u) => {
                    const isOn = excluded.includes(u.id)
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggleExcluded(u.id)}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-slate-900">{personDisplayName(u)}</span>
                            <span className="block truncate text-xs text-slate-500">{u.email}</span>
                          </span>
                          {isOn ? (
                            <span className="text-xs font-semibold text-emerald-600">Excluded</span>
                          ) : (
                            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Only exclude users who are permanently not bookable (e.g. office-based PAYE staff). For operatives working
            elsewhere temporarily, use the inactive flag in Manage Users instead.
          </p>
        </div>
      </SettingsCard>

      <SectionLabel label="Warning types" />
      <SettingsCard>
        <div className="divide-y divide-slate-100">
          <div className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Booking clashes</div>
              <p className="mt-1 text-xs text-slate-500">
                Flags when an operative is double-booked on the same date across two or more projects. Clashes are always
                treated as high-urgency.
              </p>
            </div>
            <Toggle checked={draft.detectClashes} onChange={(value) => patch({ detectClashes: value })} />
          </div>
          <div className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Include weekends in unbooked labour</div>
              <p className="mt-1 text-xs text-slate-500">
                Includes Saturday and Sunday when checking whether operatives are booked for every day in the window.
                Enable only if operatives regularly work weekends.
              </p>
              <p className="mt-1 text-xs italic text-slate-400">
                Does not affect clash detection — clashes follow your working week unless a weekend booking exists.
              </p>
            </div>
            <Toggle
              checked={draft.includeWeekendsForUnbookedLabour}
              onChange={(value) => patch({ includeWeekendsForUnbookedLabour: value })}
            />
          </div>
        </div>
      </SettingsCard>

      <SectionLabel label="Warning severity guide" />
      <SettingsCard>
        <div className="space-y-2.5 p-4">
          <SeverityRow
            tone="red"
            title="High"
            description="Operative clashes and unbooked labour — directly affect project delivery and must be resolved promptly."
          />
          <SeverityRow
            tone="amber"
            title="Medium"
            description="Manager and admin overlaps — flagged for the weekly report but less time-critical."
          />
          <SeverityRow
            tone="blue"
            title="Low"
            description="Materials not ordered by the required cut-off date — useful reminders that won't block site work immediately."
          />
        </div>
      </SettingsCard>

      <div className="mt-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

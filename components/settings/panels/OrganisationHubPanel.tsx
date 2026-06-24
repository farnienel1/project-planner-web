'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_PAYROLL_POLICY,
  formatAnnualLeaveSubtitle,
  formatInvoicingSubtitle,
  formatPayrollSubtitle,
  formatScheduleOptionsSubtitle,
  loadOrganizationDetails,
  type OrganizationDetails,
} from '@/lib/settings/organizationSettings'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/settings/notificationPreferences'
import {
  materialCutoffTimeLabel,
  MATERIAL_CUTOFF_TIME_OPTIONS,
  orgCountryLabel,
  orgCreatedLabel,
  orgInitials,
  ORG_HUB_MONTHS,
  personDisplayName,
} from '@/lib/settings/orgHubUtils'
import { getManagerUsers, getOperativeModeUsers } from '@/lib/staff/userRosterUtils'
import { pluralize } from '@/lib/utils/pluralize'
import {
  PanelHeader,
  SectionLabel,
  SettingsCard,
  SettingsRow,
  Toggle,
  Select,
  SuccessBanner,
  ErrorBanner,
} from '@/components/settings/primitives'

export type OrganisationHubDestination =
  | 'working-hours'
  | 'annual-leave-defaults'
  | 'schedule-options'
  | 'warnings'
  | 'payment-runs'
  | 'roles'

const ICON = {
  building:
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  globe:
    'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.955 11.955 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  sun: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  bell: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  document:
    'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  users:
    'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  trash:
    'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
} as const

export function OrganisationHubPanel({
  onBack,
  onNavigate,
}: {
  onBack: () => void
  onNavigate: (destination: OrganisationHubDestination) => void
}) {
  const { user, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()

  const [details, setDetails] = useState<OrganizationDetails | null>(null)
  const [notif, setNotif] = useState<NotificationPreferences | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then(setDetails).catch(() => {})
  }, [organization?.id])

  useEffect(() => {
    if (!user?.id) return
    loadNotificationPreferences(user.id).then(setNotif).catch(() => {})
  }, [user?.id])

  const country = orgCountryLabel(details?.countryCode)
  const orgName = organization?.name ?? 'Organisation'

  const owner = useMemo(() => {
    const creatorId = details?.creatorUserId
    const byCreator = creatorId ? users.find((entry) => entry.id === creatorId) : undefined
    const chosen = byCreator ?? users.find((entry) => entry.isSuperAdmin) ?? user
    if (!chosen) return { name: '—', isYou: false, initials: '—' }
    return {
      name: personDisplayName(chosen),
      isYou: chosen.id === user?.id,
      initials: orgInitials(personDisplayName(chosen)),
    }
  }, [details?.creatorUserId, users, user])

  const rolesSubtitle = useMemo(() => {
    const adminCount = users.filter((entry) => entry.isSuperAdmin || entry.permissions.adminAccess).length
    const managerCount = getManagerUsers(users).filter(
      (entry) => !entry.permissions.adminAccess && !entry.isSuperAdmin
    ).length
    const operativeCount = getOperativeModeUsers(users).length
    return `${pluralize(adminCount, 'admin')} · ${pluralize(managerCount, 'manager')} · ${pluralize(operativeCount, 'op', 'ops')}`
  }, [users])

  const hoursSubtitle = details
    ? formatPayrollSubtitle(details.payrollTimePolicy)
    : formatPayrollSubtitle(DEFAULT_PAYROLL_POLICY)
  const leaveSubtitle = details
    ? formatAnnualLeaveSubtitle(details.annualLeaveDefaults, ORG_HUB_MONTHS)
    : formatAnnualLeaveSubtitle(DEFAULT_ANNUAL_LEAVE, ORG_HUB_MONTHS)
  const scheduleSubtitle = details
    ? formatScheduleOptionsSubtitle(details.myScheduleOptions)
    : formatScheduleOptionsSubtitle({
        showOffice: true,
        showWorkingFromHome: true,
        showSiteSurvey: true,
        customItems: [],
        customItemEnabled: {},
      })
  const paymentSubtitle = details
    ? formatInvoicingSubtitle(details.invoicing)
    : formatInvoicingSubtitle(DEFAULT_INVOICING)

  const cutOffOn = !!notif?.materialOrderCutOff
  const cutOffMinutes = (notif?.materialCutOffHour ?? 16) * 60 + (notif?.materialCutOffMinute ?? 0)
  const reminderSubtitle = cutOffOn
    ? `Daily at ${materialCutoffTimeLabel(cutOffMinutes)}`
    : 'Material cut-off notifications off'

  async function patchNotif(patch: Partial<NotificationPreferences>) {
    if (!user?.id || !notif) return
    const previous = notif
    const next = { ...notif, ...patch }
    setNotif(next)
    try {
      await saveNotificationPreferences(user.id, next)
      setFeedback({ kind: 'success', msg: 'Settings saved' })
      window.setTimeout(() => setFeedback(null), 2500)
    } catch (error) {
      setNotif(previous)
      setFeedback({
        kind: 'error',
        msg: error instanceof Error ? error.message : 'Could not save settings',
      })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <PanelHeader title="Organisation" onBack={onBack} />

      {feedback?.kind === 'success' && <SuccessBanner message={feedback.msg} />}
      {feedback?.kind === 'error' && <ErrorBanner message={feedback.msg} />}

      <div className="rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#378ADD] p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-white/[0.18] text-sm font-semibold">
            {orgInitials(orgName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{orgName}</div>
            <div className="text-[11px] text-white/90">{country} · Company</div>
          </div>
        </div>

        <div className="my-3.5 h-px bg-white/20" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-br from-[#993556] to-[#C2547A] text-[9px] font-semibold ring-[1.5px] ring-white/40">
            {owner.initials}
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-white/85">
              Owner &amp; super admin
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-semibold">{owner.name}</span>
              {owner.isYou && <span className="text-[10px] text-white/75">· you</span>}
            </div>
          </div>
          <span className="ml-auto rounded-full bg-white/[0.18] px-2 py-0.5 text-[9px] font-semibold">
            {orgCreatedLabel(organization?.createdAt)}
          </span>
        </div>
      </div>

      <SectionLabel label="Identity" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.building}
          iconBg="bg-[#185FA5]/10"
          iconColor="text-[#185FA5]"
          label="Company details"
          description="Name, logo, and address — edit during org setup for now"
        />
        <SettingsRow
          icon={ICON.globe}
          iconBg="bg-[#854F0B]/[0.18]"
          iconColor="text-[#854F0B]"
          label="Currency & region"
          value={`GBP · ${country}`}
        />
      </SettingsCard>

      <SectionLabel label="Defaults for new operatives" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.clock}
          iconBg="bg-[#EEEDFE]"
          iconColor="text-[#3C3489]"
          label="Working hours & overtime"
          description={hoursSubtitle}
          chevron
          onClick={() => onNavigate('working-hours')}
        />
        <SettingsRow
          icon={ICON.sun}
          iconBg="bg-[#FAECE7]"
          iconColor="text-[#993C1D]"
          label="Annual leave"
          description={leaveSubtitle}
          chevron
          onClick={() => onNavigate('annual-leave-defaults')}
        />
      </SettingsCard>

      <SectionLabel label="Booking & scheduling" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.calendar}
          iconBg="bg-[#FBEAF0]"
          iconColor="text-[#993556]"
          label="Schedule options"
          description={scheduleSubtitle}
          chevron
          onClick={() => onNavigate('schedule-options')}
        />
        <SettingsRow
          icon={ICON.warning}
          iconBg="bg-[#FCEBEB]"
          iconColor="text-[#A32D2D]"
          label="Warnings"
          description="Change and alter warning defaults"
          chevron
          onClick={() => onNavigate('warnings')}
        />
        <SettingsRow
          icon={ICON.bell}
          iconBg="bg-[#854F0B]/[0.18]"
          iconColor="text-[#854F0B]"
          label="Material cut-off notification to all managers"
          description={reminderSubtitle}
        >
          <Toggle
            checked={cutOffOn}
            onChange={(value) => void patchNotif({ materialOrderCutOff: value })}
          />
        </SettingsRow>
        <SettingsRow icon={ICON.clock} iconBg="bg-slate-100" iconColor="text-slate-400" label="Material cut-off time">
          <Select
            className="w-32 shrink-0 bg-white py-2 text-xs font-semibold text-blue-600"
            value={String(cutOffMinutes)}
            disabled={!cutOffOn || !notif}
            onChange={(event) => {
              const total = parseInt(event.target.value, 10)
              void patchNotif({
                materialCutOffHour: Math.floor(total / 60),
                materialCutOffMinute: total % 60,
              })
            }}
          >
            {MATERIAL_CUTOFF_TIME_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {materialCutoffTimeLabel(minutes)}
              </option>
            ))}
          </Select>
        </SettingsRow>
        <SettingsRow
          icon={ICON.calendar}
          iconBg="bg-slate-100"
          iconColor="text-slate-400"
          label="Material cut-off email on Saturday"
        >
          <Toggle
            checked={!!notif?.materialCutOffOnSaturday}
            disabled={!cutOffOn}
            onChange={(value) => void patchNotif({ materialCutOffOnSaturday: value })}
          />
        </SettingsRow>
        <SettingsRow
          icon={ICON.calendar}
          iconBg="bg-slate-100"
          iconColor="text-slate-400"
          label="Material cut-off email on Sunday"
        >
          <Toggle
            checked={!!notif?.materialCutOffOnSunday}
            disabled={!cutOffOn}
            onChange={(value) => void patchNotif({ materialCutOffOnSunday: value })}
          />
        </SettingsRow>
      </SettingsCard>

      <SectionLabel label="Payment runs and timesheets" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.document}
          iconBg="bg-[#185FA5]/10"
          iconColor="text-[#185FA5]"
          label="Payment Runs and Timesheets"
          description={paymentSubtitle}
          chevron
          onClick={() => onNavigate('payment-runs')}
        />
      </SettingsCard>

      <SectionLabel label="Team" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.users}
          iconBg="bg-[#0F6E56]/[0.15]"
          iconColor="text-[#0F6E56]"
          label="Roles & permissions"
          description={rolesSubtitle}
          chevron
          onClick={() => onNavigate('roles')}
        />
      </SettingsCard>

      <SectionLabel label="Danger zone" />
      <SettingsCard>
        <SettingsRow
          icon={ICON.trash}
          danger
          label="Delete organisation"
          description="Permanent · cannot be undone"
          chevron
          onClick={() => {
            if (window.confirm('Are you absolutely sure? This cannot be undone.')) {
              setFeedback({
                kind: 'error',
                msg: 'Organisation deletion is not available in the app. Contact support to close an account.',
              })
            }
          }}
        />
      </SettingsCard>
    </div>
  )
}

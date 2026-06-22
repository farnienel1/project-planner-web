'use client'

import Link from 'next/link'
import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_WARNING_DETECTION,
  formatAnnualLeaveSubtitle,
  formatPayrollSubtitle,
  formatScheduleOptionsSubtitle,
  loadOrganizationDetails,
  saveAnnualLeaveDefaults,
  saveInvoicingSettings,
  saveMyScheduleOptions,
  savePayrollPolicy,
  saveWarningDetection,
  capitalizeDay,
  WEEKDAY_OPTIONS,
  type OrganizationDetails,
  type OrgAnnualLeaveDefaults,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import {
  formatCutoffTime,
  loadNotificationPreferences,
  parseCutoffTime,
  saveNotificationPreferences,
} from '@/lib/settings/notificationPreferences'

// ─── Shared primitives ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[28px] w-[50px] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}
    >
      <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] ring-0 transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[1px]'}`} />
    </button>
  )
}

function SectionLabel({ label }: { label: string }) {
  return <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
}

function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">{children}</div>
}

function SettingsRow({
  icon, iconBg = 'bg-slate-100', iconColor = 'text-slate-600',
  label, description, value, chevron, badge, danger, onClick, children,
}: {
  icon: string; iconBg?: string; iconColor?: string; label: string;
  description?: string; value?: string; chevron?: boolean; badge?: string;
  danger?: boolean; onClick?: () => void; children?: ReactNode;
}) {
  const inner = (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''} ${danger ? 'hover:bg-red-50' : ''}`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-slate-900'}`}>{label}</p>
          {badge && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{badge}</span>}
        </div>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {value && <span className="text-sm font-semibold text-blue-600 flex-shrink-0">{value}</span>}
      {children}
      {chevron && (
        <svg className="h-4 w-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
  return onClick ? <button type="button" className="w-full text-left" onClick={onClick}>{inner}</button> : <div>{inner}</div>
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`w-full rounded-2xl py-3.5 text-sm font-bold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
    </button>
  )
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      ✓ {message}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
      {message}
    </div>
  )
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 leading-relaxed">{hint}</p>}
    </div>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 ${props.className || ''}`}
    />
  )
}

function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    >
      {children}
    </select>
  )
}

function Textarea({ ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
    />
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// ─── Subpanels ────────────────────────────────────────────────────────────────
type Panel = 
  | 'main'
  | 'profile'
  | 'password'
  | 'notifications'
  | 'organisation'
  | 'working-hours'
  | 'annual-leave-defaults'
  | 'schedule-options'
  | 'warnings'
  | 'payment-runs'
  | 'roles'

// ─── Profile Panel ────────────────────────────────────────────────────────────
function ProfilePanel({ onBack }: { onBack: () => void }) {
  const { user, organization } = useAuthStore()
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [surname, setSurname] = useState(user?.surname || '')
  const [mobile, setMobile] = useState(user?.mobileNumber || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const initials = `${firstName[0] || ''}${surname[0] || ''}`.toUpperCase()

  const save = async () => {
    if (!user?.id) return
    setSaving(true); setError('')
    try {
      await updateDoc(doc(db, 'users', user.id), { firstName: firstName.trim(), surname: surname.trim(), mobileNumber: mobile.trim(), updatedAt: Timestamp.now() })
      const current = useAuthStore.getState().user
      if (current) {
        useAuthStore.setState({
          user: {
            ...current,
            firstName: firstName.trim(),
            surname: surname.trim(),
            mobileNumber: mobile.trim(),
          },
        })
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="My profile" onBack={onBack} />

      {/* Avatar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Profile image</p>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white flex-shrink-0">
            {initials || '?'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Profile photo</p>
            <p className="text-xs text-slate-500">Used across Home and Settings</p>
          </div>
          <button type="button" className="text-sm font-semibold text-blue-600 hover:underline">Change</button>
        </div>
      </div>

      {/* Fields */}
      <SettingsCard>
        <div className="px-4 py-3 space-y-1">
          <div className="flex items-center justify-between py-1"><span className="text-sm text-slate-500">Name</span><span className="text-sm font-semibold text-slate-900">{user?.firstName} {user?.surname}</span></div>
          <div className="flex items-center justify-between py-1"><span className="text-sm text-slate-500">Email</span><span className="text-sm font-semibold text-slate-900">{user?.email}</span></div>
          <div className="flex items-center justify-between py-1"><span className="text-sm text-slate-500">Organisation</span><span className="text-sm font-semibold text-slate-900">{organization?.name}</span></div>
        </div>
      </SettingsCard>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <FormField label="First name"><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></FormField>
        <FormField label="Surname"><Input value={surname} onChange={e => setSurname(e.target.value)} /></FormField>
        <FormField label="Mobile number"><Input value={mobile} onChange={e => setMobile(e.target.value)} type="tel" /></FormField>
      </div>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Profile updated." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Password Panel ───────────────────────────────────────────────────────────
function PasswordPanel({ onBack }: { onBack: () => void }) {
  const { firebaseUser } = useAuthStore() as { firebaseUser: { email?: string | null } | null }
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const changePassword = async () => {
    if (!firebaseUser?.email || !current || !next || next !== confirm) {
      setError(next !== confirm ? 'Passwords do not match' : 'Please fill all fields')
      return
    }
    setSaving(true); setError('')
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, current)
      await reauthenticateWithCredential(firebaseUser as Parameters<typeof reauthenticateWithCredential>[0], credential)
      await updatePassword(firebaseUser as Parameters<typeof updatePassword>[0], next)
      setSaved(true); setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSaved(false), 4000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to change password') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="Sign-in & password" onBack={onBack} />

      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-blue-600">Change Password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your current password and choose a new one.</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <FormField label="Current Password">
          <div className="relative">
            <Input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} placeholder="Enter your current password" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowCurrent(!showCurrent)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCurrent ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 9A9 9 0 103 12a9 9 0 0018 0z'} /></svg>
            </button>
          </div>
        </FormField>
        <FormField label="New Password">
          <div className="relative">
            <Input type={showNew ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} placeholder="Enter your new password" />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowNew(!showNew)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showNew ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3 9A9 9 0 103 12a9 9 0 0018 0z'} /></svg>
            </button>
          </div>
        </FormField>
        <FormField label="Confirm New Password">
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm your new password" />
        </FormField>
      </div>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Password changed successfully." />}
      <button
        type="button"
        onClick={changePassword}
        disabled={saving || !current || !next || !confirm}
        className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-all"
      >
        {saving ? 'Changing…' : 'Change Password'}
      </button>
    </div>
  )
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuthStore()
  const [materialCutoff, setMaterialCutoff] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    void loadNotificationPreferences(user.id).then((prefs) => {
      setMaterialCutoff(prefs.materialOrderCutOff)
    })
  }, [user?.id])

  const save = async () => {
    if (!user?.id) return
    const existing = await loadNotificationPreferences(user.id)
    await saveNotificationPreferences(user.id, {
      ...existing,
      materialOrderCutOff: materialCutoff,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="My notifications" onBack={onBack} />
      <SettingsCard>
        <SettingsRow
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          iconBg="bg-blue-50" iconColor="text-blue-600"
          label="General app options"
          description="My schedule list on this device"
          chevron
        />
      </SettingsCard>
      <p className="px-1 text-xs text-slate-500">Controls extra rows in My Schedule (office, WFH, custom labels).</p>

      <SettingsCard>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Material order cut-off (4:00 PM daily)</p>
            <p className="text-xs text-slate-500 mt-0.5">Sends a daily reminder at 4:00 PM for admins and managers.</p>
          </div>
          <Toggle checked={materialCutoff} onChange={setMaterialCutoff} />
        </div>
      </SettingsCard>

      {saved && <SuccessBanner message="Notifications saved." />}
      <SaveButton saving={false} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Organisation Panel ───────────────────────────────────────────────────────
function OrganisationPanel({ onBack, onNavigate }: { onBack: () => void; onNavigate: (p: Panel) => void }) {
  const { user, organization } = useAuthStore()
  const [orgDetails, setOrgDetails] = useState<OrganizationDetails | null>(null)
  const [matCutoffEnabled, setMatCutoffEnabled] = useState(true)
  const [matCutoffTime, setMatCutoffTime] = useState('16:00')
  const [matSaturday, setMatSaturday] = useState(false)
  const [matSunday, setMatSunday] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then(setOrgDetails)
  }, [organization?.id])

  useEffect(() => {
    if (!user?.id) return
    void loadNotificationPreferences(user.id).then((prefs) => {
      setMatCutoffEnabled(prefs.materialOrderCutOff)
      setMatCutoffTime(formatCutoffTime(prefs.materialCutOffHour, prefs.materialCutOffMinute))
      setMatSaturday(prefs.materialCutOffOnSaturday)
      setMatSunday(prefs.materialCutOffOnSunday)
    })
  }, [user?.id])

  const saveScheduling = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const { hour, minute } = parseCutoffTime(matCutoffTime)
      await saveNotificationPreferences(user.id, {
        materialOrderCutOff: matCutoffEnabled,
        materialCutOffHour: hour,
        materialCutOffMinute: minute,
        materialCutOffOnSaturday: matSaturday,
        materialCutOffOnSunday: matSunday,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const payrollSubtitle = orgDetails
    ? formatPayrollSubtitle(orgDetails.payrollTimePolicy)
    : formatPayrollSubtitle(DEFAULT_PAYROLL_POLICY)
  const leaveSubtitle = orgDetails
    ? formatAnnualLeaveSubtitle(orgDetails.annualLeaveDefaults, MONTHS)
    : formatAnnualLeaveSubtitle(DEFAULT_ANNUAL_LEAVE, MONTHS)
  const scheduleSubtitle = orgDetails
    ? formatScheduleOptionsSubtitle(orgDetails.myScheduleOptions)
    : 'Office, WFH, Site Survey'

  return (
    <div className="space-y-5">
      <PanelHeader title="Organisation" onBack={onBack} />

      {/* Org hero */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">
            {organization?.name?.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-bold">{organization?.name}</p>
            <p className="text-xs text-blue-200">{orgDetails?.countryCode || 'United Kingdom'} · Company</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">
            {user?.firstName?.[0]}
            {user?.surname?.[0]}
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-200">Organisation admin</p>
            <p className="text-sm font-semibold">
              {user?.firstName} {user?.surname} · you
            </p>
          </div>
        </div>
      </div>

      {/* Identity */}
      <SectionLabel label="Identity" />
      <SettingsCard>
        <SettingsRow
          icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          iconBg="bg-slate-100" iconColor="text-slate-600"
          label="Company details"
          description="Name, logo, address"
          chevron
        />
        <SettingsRow
          icon="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
          iconBg="bg-amber-50" iconColor="text-amber-600"
          label="Currency & region" value="GBP · United Kingdom" chevron
        />
      </SettingsCard>

      {/* Defaults for new operatives */}
      <SectionLabel label="Defaults for new operatives" />
      <SettingsCard>
        <SettingsRow
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          iconBg="bg-indigo-50" iconColor="text-indigo-600"
          label="Working hours & overtime"
          description={payrollSubtitle}
          chevron
          onClick={() => onNavigate('working-hours')}
        />
        <SettingsRow
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          iconBg="bg-pink-50" iconColor="text-pink-600"
          label="Annual leave"
          description={leaveSubtitle}
          chevron
          onClick={() => onNavigate('annual-leave-defaults')}
        />
      </SettingsCard>

      {/* Booking & Scheduling */}
      <SectionLabel label="Booking & scheduling" />
      <SettingsCard>
        <SettingsRow
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          iconBg="bg-purple-50" iconColor="text-purple-600"
          label="Schedule options"
          description={scheduleSubtitle}
          chevron
          onClick={() => onNavigate('schedule-options')}
        />
        <SettingsRow
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          iconBg="bg-red-50" iconColor="text-red-600"
          label="Warnings" description="Change and alter warning defaults" chevron
          onClick={() => onNavigate('warnings')}
        />

        {/* Material cut-off inline toggles */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Material cut-off notification to all managers</p>
              <p className="text-xs text-slate-500">Daily at {matCutoffTime}</p>
            </div>
          </div>
          <Toggle checked={matCutoffEnabled} onChange={setMatCutoffEnabled} />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Material cut-off time</span>
          <input
            type="time"
            value={matCutoffTime}
            onChange={(e) => setMatCutoffTime(e.target.value)}
            className="text-sm font-semibold text-blue-600 border-none outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Material cut-off email on Saturday</span>
          <Toggle checked={matSaturday} onChange={setMatSaturday} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Material cut-off email on Sunday</span>
          <Toggle checked={matSunday} onChange={setMatSunday} />
        </div>
      </SettingsCard>

      {/* Payment runs */}
      <SectionLabel label="Payment runs and timesheets" />
      <SettingsCard>
        <SettingsRow
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          iconBg="bg-blue-50" iconColor="text-blue-600"
          label="Payment Runs and Timesheets" description="Recurring: Monday-Sunday" chevron
          onClick={() => onNavigate('payment-runs')}
        />
      </SettingsCard>

      {/* Team */}
      <SectionLabel label="Team" />
      <SettingsCard>
        <SettingsRow
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          label="Roles & permissions" description="1 admin · 1 managers · 1 ops" chevron
          onClick={() => onNavigate('roles')}
        />
      </SettingsCard>

      {/* Danger zone */}
      <SectionLabel label="Danger zone" />
      <SettingsCard>
        <SettingsRow
          icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          iconBg="bg-red-50" iconColor="text-red-600"
          label="Delete organisation" description="Permanent · cannot be undone" chevron danger
          onClick={() => window.confirm('Are you absolutely sure? This cannot be undone.') && alert('Contact support to delete your organisation.')}
        />
      </SettingsCard>

      {saved && <SuccessBanner message="Scheduling settings saved." />}
      <SaveButton saving={saving} saved={saved} onClick={saveScheduling} />
    </div>
  )
}

// ─── Working Hours Panel ──────────────────────────────────────────────────────
function WorkingHoursPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [startTime, setStartTime] = useState(DEFAULT_PAYROLL_POLICY.standardDayStart)
  const [endTime, setEndTime] = useState(DEFAULT_PAYROLL_POLICY.standardDayEnd)
  const [breakMins, setBreakMins] = useState(DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes)
  const [breakStart, setBreakStart] = useState(DEFAULT_PAYROLL_POLICY.breakWindowStart)
  const [breakEnd, setBreakEnd] = useState(DEFAULT_PAYROLL_POLICY.breakWindowEnd)
  const [stdHours, setStdHours] = useState(DEFAULT_PAYROLL_POLICY.standardPaidHours)
  const [weekdayOT, setWeekdayOT] = useState(DEFAULT_PAYROLL_POLICY.weekdayOutsideStandardMultiplier)
  const [satAllOT, setSatAllOT] = useState(true)
  const [satMultiplier, setSatMultiplier] = useState(2)
  const [sunAllOT, setSunAllOT] = useState(true)
  const [sunMultiplier, setSunMultiplier] = useState(2)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      const p = details.payrollTimePolicy
      setStartTime(p.standardDayStart)
      setEndTime(p.standardDayEnd)
      setBreakMins(p.unpaidBreakMinutes)
      setBreakStart(p.breakWindowStart)
      setBreakEnd(p.breakWindowEnd)
      setStdHours(p.standardPaidHours)
      setWeekdayOT(p.weekdayOutsideStandardMultiplier)
      setSatAllOT(p.saturday.allHoursAtMultiplierMode)
      setSatMultiplier(p.saturday.allHoursMultiplier)
      setSunAllOT(p.sunday.allHoursAtMultiplierMode)
      setSunMultiplier(p.sunday.allHoursMultiplier)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    try {
      const policy: OrgPayrollTimePolicy = {
        standardDayStart: startTime,
        standardDayEnd: endTime,
        unpaidBreakMinutes: breakMins,
        standardPaidHours: stdHours,
        breakWindowStart: breakStart,
        breakWindowEnd: breakEnd,
        weekdayOutsideStandardMultiplier: weekdayOT,
        saturday: { allHoursAtMultiplierMode: satAllOT, allHoursMultiplier: satMultiplier },
        sunday: { allHoursAtMultiplierMode: sunAllOT, allHoursMultiplier: sunMultiplier },
      }
      await savePayrollPolicy(organization.id, policy)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="Working hours" onBack={onBack} />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Standard day (Mon–Fri reference)</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start time"><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></FormField>
          <FormField label="End time"><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></FormField>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Unpaid break: {breakMins} min</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setBreakMins(Math.max(0, breakMins - 5))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50">−</button>
            <button type="button" onClick={() => setBreakMins(breakMins + 5)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50">+</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Break start"><Input type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)} /></FormField>
          <FormField label="Break end"><Input type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)} /></FormField>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Standard paid hours (full day): {stdHours.toFixed(1)}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStdHours(Math.max(0, stdHours - 0.5))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50">−</button>
            <button type="button" onClick={() => setStdHours(stdHours + 0.5)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50">+</button>
          </div>
        </div>
        <p className="text-xs text-slate-400">Clock times use 24h format (e.g. 07:30). Mon–Fri hours outside this window are treated as overtime at the weekday multiplier below.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Weekday OT (outside standard window)</p>
            <p className="text-xs text-slate-500 mt-0.5">Applies Monday–Friday to time worked outside the standard day window.</p>
          </div>
          <input type="number" step="0.5" min="1" max="3" value={weekdayOT} onChange={e => setWeekdayOT(parseFloat(e.target.value))}
            className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-blue-600 outline-none" />
        </div>
      </div>

      {/* Saturday */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Saturday</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">All hours at multiplier</p>
            <p className="text-xs text-slate-500 mt-0.5">All hours on Saturday will be at the multiplier rate.</p>
          </div>
          <Toggle checked={satAllOT} onChange={setSatAllOT} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Multiplier</span>
          <input type="number" step="0.5" min="1" max="3" value={satMultiplier} onChange={e => setSatMultiplier(parseFloat(e.target.value))}
            className="w-16 text-center text-sm font-bold text-blue-600 bg-transparent border-none outline-none" />
        </div>
      </div>

      {/* Sunday */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Sunday</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">All hours at multiplier</p>
            <p className="text-xs text-slate-500 mt-0.5">All hours on Sunday will be at the multiplier rate.</p>
          </div>
          <Toggle checked={sunAllOT} onChange={setSunAllOT} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Multiplier</span>
          <input type="number" step="0.5" min="1" max="3" value={sunMultiplier} onChange={e => setSunMultiplier(parseFloat(e.target.value))}
            className="w-16 text-center text-sm font-bold text-blue-600 bg-transparent border-none outline-none" />
        </div>
      </div>

      {saved && <SuccessBanner message="Working hours saved." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Annual Leave Defaults Panel ──────────────────────────────────────────────
function AnnualLeaveDefaultsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [days, setDays] = useState(DEFAULT_ANNUAL_LEAVE.daysPerYear)
  const [startMonth, setStartMonth] = useState(DEFAULT_ANNUAL_LEAVE.startMonth)
  const [endMonth, setEndMonth] = useState(DEFAULT_ANNUAL_LEAVE.endMonth)
  const [carryOver, setCarryOver] = useState(DEFAULT_ANNUAL_LEAVE.carriesOver)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      setDays(details.annualLeaveDefaults.daysPerYear)
      setStartMonth(details.annualLeaveDefaults.startMonth)
      setEndMonth(details.annualLeaveDefaults.endMonth)
      setCarryOver(details.annualLeaveDefaults.carriesOver)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    try {
      const defaults: OrgAnnualLeaveDefaults = {
        daysPerYear: days,
        startMonth,
        endMonth,
        carriesOver: carryOver,
      }
      await saveAnnualLeaveDefaults(organization.id, defaults)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="Annual leave defaults" onBack={onBack} />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <p className="text-xs text-slate-500 font-medium">Default annual leave for new users</p>
        <FormField label="Days per year"><Input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={0} max={365} /></FormField>
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Company leave year</p>
          <p className="text-xs text-slate-400 mb-2">Runs from the first day of the start month through the last day of the end month.</p>
          <div className="flex items-center gap-3">
            <div className="flex-1"><Select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>{MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</Select></div>
            <span className="text-slate-400 font-bold">→</span>
            <div className="flex-1"><Select value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>{MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</Select></div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Carry unused days into next leave year</p>
            <p className="text-xs text-slate-400 mt-0.5">Unused allowance from the previous leave year is added to this year's balance.</p>
          </div>
          <Toggle checked={carryOver} onChange={setCarryOver} />
        </div>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-700">These settings apply only when adding new manager/operative users. Existing users keep their current annual leave values unless an admin/manager edits their profile.</p>
      </div>
      {saved && <SuccessBanner message="Annual leave defaults saved." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Schedule Options Panel ───────────────────────────────────────────────────
function ScheduleOptionsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [office, setOffice] = useState(true)
  const [wfh, setWfh] = useState(true)
  const [survey, setSurvey] = useState(true)
  const [customItems, setCustomItems] = useState<string[]>([])
  const [customEnabled, setCustomEnabled] = useState<Record<string, boolean>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      const opts = details.myScheduleOptions
      setOffice(opts.showOffice)
      setWfh(opts.showWorkingFromHome)
      setSurvey(opts.showSiteSurvey)
      setCustomItems(opts.customItems)
      setCustomEnabled(opts.customItemEnabled)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    try {
      await saveMyScheduleOptions(organization.id, {
        showOffice: office,
        showWorkingFromHome: wfh,
        showSiteSurvey: survey,
        customItems,
        customItemEnabled: customItems.reduce<Record<string, boolean>>((acc, item) => {
          acc[item] = customEnabled[item] ?? true
          return acc
        }, {}),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="My Schedule options" onBack={onBack} rightAction={<button type="button" onClick={() => setShowAdd(true)} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg></button>} />

      <div className="rounded-2xl border border-slate-200 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-700">My Schedule: Add or remove admin/manager additional options within My Schedule. Office, Working From Home and Site Survey have been included as standard.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Additional options</p>
        <SettingsCard>
          {[
            { label: 'Office', checked: office, onChange: setOffice },
            { label: 'Working From Home', checked: wfh, onChange: setWfh },
            { label: 'Site Survey', checked: survey, onChange: setSurvey },
            ...customItems.map((item) => ({
              label: item,
              checked: customEnabled[item] ?? true,
              onChange: (v: boolean) => {
                if (!v) {
                  setCustomItems((prev) => prev.filter((entry) => entry !== item))
                  setCustomEnabled((prev) => {
                    const next = { ...prev }
                    delete next[item]
                    return next
                  })
                } else {
                  setCustomEnabled((prev) => ({ ...prev, [item]: true }))
                }
              },
            })),
          ].map(({ label, checked, onChange }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3.5">
              <span className="text-sm font-medium text-slate-900">{label}</span>
              <Toggle checked={checked} onChange={onChange} />
            </div>
          ))}
        </SettingsCard>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-80 rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add My Schedule Item</h3>
            <p className="text-xs text-slate-500 mb-3">Create an extra booking option for admin/manager My Schedule.</p>
            <Input placeholder="Item name" value={newItem} onChange={e => setNewItem(e.target.value)} autoFocus />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => { setShowAdd(false); setNewItem('') }} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              <button type="button" onClick={() => { if (newItem.trim()) { setCustomItems([...customItems, newItem.trim()]); setNewItem(''); setShowAdd(false) } }} className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white">Add</button>
            </div>
          </div>
        </div>
      )}

      {saved && <SuccessBanner message="Schedule options saved." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Warnings Panel ───────────────────────────────────────────────────────────
function WarningsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [lookAheadMode, setLookAheadMode] = useState<'week' | 'days'>('week')
  const [daysAhead, setDaysAhead] = useState(DEFAULT_WARNING_DETECTION.clashLookaheadDays)
  const [clashes, setClashes] = useState(true)
  const [weekends, setWeekends] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      const w = details.warningDetection
      setLookAheadMode(w.clashLookaheadMode === 'numberOfDays' ? 'days' : 'week')
      setDaysAhead(w.clashLookaheadDays)
      setClashes(w.detectClashes)
      setWeekends(w.includeWeekendsForUnbookedLabour)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    try {
      const settings: OrgWarningDetectionSettings = {
        detectClashes: clashes,
        clashLookaheadMode: lookAheadMode === 'days' ? 'numberOfDays' : 'endOfWorkingWeek',
        clashLookaheadDays: daysAhead,
        includeWeekendsForUnbookedLabour: weekends,
        excludedUserIdsFromUnbookedWarnings: [],
      }
      await saveWarningDetection(organization.id, settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="Warnings" onBack={onBack} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Warning detection</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 leading-relaxed">How far ahead should clashes, missed bookings and material lists be detected. It is set to End of the working week by default.</p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Detection period</p>
          <SettingsCard>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-slate-900">Look ahead</span>
              <Select value={lookAheadMode} onChange={e => setLookAheadMode(e.target.value as 'week' | 'days')} className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600 outline-none p-0">
                <option value="week">End of the working week</option>
                <option value="days">Set number of days</option>
              </Select>
            </div>
            {lookAheadMode === 'days' && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700">Days ahead: {daysAhead}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setDaysAhead(Math.max(1, daysAhead - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700">−</button>
                  <button type="button" onClick={() => setDaysAhead(daysAhead + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700">+</button>
                </div>
              </div>
            )}
          </SettingsCard>
          <p className="mt-2 text-xs text-slate-400">Applies to clashes, unbooked labour, and material cut-off checks. Changing the look-ahead updates warnings immediately.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Exclude users from the warnings</p>
        <SettingsCard>
          <SettingsRow icon="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            iconBg="bg-slate-100" iconColor="text-slate-500"
            label="Excluded users" value="1" chevron />
        </SettingsCard>
        <p className="text-xs text-slate-400 leading-relaxed">Use this feature to remove certain users such as PAYE staff from the warnings page so they will not show up when not booked in.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Clashes</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Clashes</p>
            <p className="text-xs text-slate-400 mt-0.5">Includes all days — weekend clashes are covered when this is on.</p>
          </div>
          <Toggle checked={clashes} onChange={setClashes} />
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Include weekends for unbooked labour detection</p>
            <p className="text-xs text-slate-400 mt-0.5">Any labour that is not booked in over the weekend will trigger a warning. We do not recomend this setting is turned on, unless you organisation works 7 Days a week regularily or offers a 24/7 service.</p>
          </div>
          <Toggle checked={weekends} onChange={setWeekends} />
        </div>
      </div>

      {saved && <SuccessBanner message="Settings saved. Warnings have been updated." />}
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  )
}

// ─── Payment Runs Panel ───────────────────────────────────────────────────────
function PaymentRunsPanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [mode, setMode] = useState<'date_ranges' | 'recurring_timeframe'>(DEFAULT_INVOICING.paymentRunMode)
  const [startDay, setStartDay] = useState(DEFAULT_INVOICING.recurringRunStartDay)
  const [endDay, setEndDay] = useState(DEFAULT_INVOICING.recurringRunEndDay)
  const [paymentDateMode, setPaymentDateMode] = useState<'specific_dates' | 'recurring_date'>(DEFAULT_INVOICING.paymentDateMode)
  const [recurringDay, setRecurringDay] = useState(DEFAULT_INVOICING.recurringPaymentDay)
  const [noteToUser, setNoteToUser] = useState(DEFAULT_INVOICING.noteToUsers)
  const [paymentRunDateRanges, setPaymentRunDateRanges] = useState(DEFAULT_INVOICING.paymentRunDateRanges)
  const [paymentDates, setPaymentDates] = useState<string[]>(DEFAULT_INVOICING.paymentDates)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (!details) return
      const inv = details.invoicing
      setMode(inv.paymentRunMode)
      setStartDay(inv.recurringRunStartDay)
      setEndDay(inv.recurringRunEndDay)
      setPaymentDateMode(inv.paymentDateMode)
      setRecurringDay(inv.recurringPaymentDay)
      setNoteToUser(inv.noteToUsers)
      setPaymentRunDateRanges(inv.paymentRunDateRanges)
      setPaymentDates(inv.paymentDates)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    setSaving(true)
    try {
      const settings: OrgInvoicingSettings = {
        paymentRunMode: mode,
        paymentDateMode,
        recurringRunStartDay: startDay,
        recurringRunEndDay: endDay,
        recurringPaymentDay: recurringDay,
        paymentRunDateRanges,
        paymentDates,
        noteToUsers: noteToUser,
      }
      await saveInvoicingSettings(organization.id, settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="Payment Runs and Timesheets" onBack={onBack} />

      <SettingsCard>
        <SettingsRow icon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          iconBg="bg-blue-50" iconColor="text-blue-600"
          label="How payment runs should be configured" chevron />
      </SettingsCard>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Payment runs</p>
        {(['date_ranges', 'recurring_timeframe'] as const).map((opt) => (
          <label
            key={opt}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${mode === opt ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${mode === opt ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
              {mode === opt && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
            </span>
            <span className="text-sm font-medium text-slate-900">
              {opt === 'date_ranges' ? 'Set payment run date ranges' : 'Choose recurring timeframe'}
            </span>
            <input type="radio" className="sr-only" checked={mode === opt} onChange={() => setMode(opt)} />
          </label>
        ))}

        {mode === 'recurring_timeframe' && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Start day</span>
              <Select value={startDay} onChange={(e) => setStartDay(e.target.value)} className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600 outline-none p-0">
                {WEEKDAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {capitalizeDay(d)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">End day</span>
              <Select value={endDay} onChange={(e) => setEndDay(e.target.value)} className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600 outline-none p-0">
                {WEEKDAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {capitalizeDay(d)}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-xs text-slate-400">
              In arrears: {capitalizeDay(startDay)} to {capitalizeDay(endDay)} (of the previous week)
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Payment day/dates</p>
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
          {(['specific_dates', 'recurring_date'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPaymentDateMode(opt)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${paymentDateMode === opt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {opt === 'specific_dates' ? 'Set Payment date/s' : 'Recurring payment date'}
            </button>
          ))}
        </div>
        {paymentDateMode === 'recurring_date' && (
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Recurring payment date</span>
            <Select value={recurringDay} onChange={(e) => setRecurringDay(e.target.value)} className="w-auto border-none bg-transparent text-right text-sm font-semibold text-blue-600 outline-none p-0">
              {WEEKDAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Every {capitalizeDay(d)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Note to user</p>
        <Textarea value={noteToUser} onChange={e => setNoteToUser(e.target.value)} rows={3} />
        <p className="text-xs text-slate-400 leading-relaxed">Use this section to explain how payment runs and timesheet requirements work. These notes appear on operative timesheet pages.</p>
      </div>

      {saved && <SuccessBanner message="Payment run saved." />}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving…' : 'Save Payment Run'}
      </button>
    </div>
  )
}

// ─── Roles Panel ──────────────────────────────────────────────────────────────
function RolesPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <PanelHeader title="Roles & permissions" onBack={onBack} />
      <SettingsCard>
        <Link href="/dashboard/settings/users" className="block">
          <SettingsRow
            icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            label="Manage users"
            description="Add, edit, and set permissions for your team"
            chevron
          />
        </Link>
      </SettingsCard>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center py-8">
        <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <p className="text-sm font-semibold text-slate-700">Change roles on user profiles</p>
        <p className="text-xs text-slate-400 mt-1">Use Manage users to assign admin, manager, or operative access.</p>
      </div>
    </div>
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────
function PanelHeader({ title, onBack, rightAction }: { title: string; onBack: () => void; rightAction?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50">
        <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
      </button>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {rightAction || <div className="w-9" />}
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsScreen({ initialPanel = 'main' }: { initialPanel?: Panel }) {
  const { user, organization, signOut } = useAuthStore()
  const [panel, setPanel] = useState<Panel>(initialPanel)
  const isAdmin = hasAdminAccess(user)
  const initials = `${user?.firstName?.[0] || ''}${user?.surname?.[0] || ''}`.toUpperCase()

  if (panel === 'profile') return <div className="max-w-xl mx-auto pb-10"><ProfilePanel onBack={() => setPanel('main')} /></div>
  if (panel === 'password') return <div className="max-w-xl mx-auto pb-10"><PasswordPanel onBack={() => setPanel('main')} /></div>
  if (panel === 'notifications') return <div className="max-w-xl mx-auto pb-10"><NotificationsPanel onBack={() => setPanel('main')} /></div>
  if (panel === 'organisation') return <div className="max-w-xl mx-auto pb-10"><OrganisationPanel onBack={() => setPanel('main')} onNavigate={setPanel} /></div>
  if (panel === 'working-hours') return <div className="max-w-xl mx-auto pb-10"><WorkingHoursPanel onBack={() => setPanel('organisation')} /></div>
  if (panel === 'annual-leave-defaults') return <div className="max-w-xl mx-auto pb-10"><AnnualLeaveDefaultsPanel onBack={() => setPanel('organisation')} /></div>
  if (panel === 'schedule-options') return <div className="max-w-xl mx-auto pb-10"><ScheduleOptionsPanel onBack={() => setPanel('organisation')} /></div>
  if (panel === 'warnings') return <div className="max-w-xl mx-auto pb-10"><WarningsPanel onBack={() => setPanel('organisation')} /></div>
  if (panel === 'payment-runs') return <div className="max-w-xl mx-auto pb-10"><PaymentRunsPanel onBack={() => setPanel('organisation')} /></div>
  if (panel === 'roles') return <div className="max-w-xl mx-auto pb-10"><RolesPanel onBack={() => setPanel('organisation')} /></div>

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-10">
      {/* Profile hero */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white flex-shrink-0">
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-900 truncate">{user?.firstName} {user?.surname}</p>
          <p className="text-sm text-slate-500 truncate">{organization?.name}</p>
          {isAdmin && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Personal */}
      <SectionLabel label="Personal" />
      <SettingsCard>
        <SettingsRow icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" iconBg="bg-blue-50" iconColor="text-blue-600" label="My profile" description="Name, photo, contact details" chevron onClick={() => setPanel('profile')} />
        <SettingsRow icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" iconBg="bg-purple-50" iconColor="text-purple-600" label="Sign-in & password" description="Email, password, security" chevron onClick={() => setPanel('password')} />
        <SettingsRow icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" iconBg="bg-red-50" iconColor="text-red-500" label="My notifications" description="What you get pinged about" chevron onClick={() => setPanel('notifications')} />
      </SettingsCard>

      {/* Company-wide (admin only) */}
      {isAdmin && (
        <>
          <SectionLabel label="Company-wide" />
          <button
            type="button"
            onClick={() => setPanel('organisation')}
            className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 text-left shadow-md hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Organisation settings</p>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-blue-100">Admin only</span>
                </div>
                <p className="text-xs text-blue-200 mt-0.5">Hours, leave, schedule options &amp; more for {organization?.name}.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Hours', 'Leave', 'Schedule', 'Warnings', 'Payment'].map(tag => (
                    <span key={tag} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-blue-100">{tag}</span>
                  ))}
                </div>
              </div>
              <svg className="h-4 w-4 text-white/50 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
          </button>
          <p className="px-1 text-xs text-slate-500">Tap to manage how {organization?.name} runs — affects everyone in your team.</p>
        </>
      )}

      {/* Support & legal */}
      <SectionLabel label="Support & legal" />
      <SettingsCard>
        <Link href="/dashboard/help">
          <SettingsRow icon="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Help & support" description="Get in touch, browse FAQs" chevron />
        </Link>
        <SettingsRow icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" iconBg="bg-slate-100" iconColor="text-slate-600" label="Privacy & terms" description="Legal information" chevron />
      </SettingsCard>

      {/* Sign out */}
      <SettingsCard>
        <button type="button" onClick={async () => { if (window.confirm('Sign out?')) await signOut() }}
          className="flex w-full items-center justify-center gap-2 px-4 py-4 text-red-600 hover:bg-red-50 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span className="text-sm font-bold">Sign out</span>
        </button>
      </SettingsCard>

      <p className="text-center text-[11px] text-slate-400">Project Planner · v1.0</p>
    </div>
  )
}

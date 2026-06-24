'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { canAccessOrganisationSettingsHub, hasAdminAccess } from '@/lib/navigation/menuPermissions'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/lib/settings/notificationPreferences'
import {
  Toggle,
  SectionLabel,
  SettingsCard,
  SettingsRow,
  SaveButton,
  SuccessBanner,
  ErrorBanner,
  FormField,
  Input,
  Select,
  Textarea,
  PanelHeader,
} from '@/components/settings/primitives'
import { OrganisationHubPanel, type OrganisationHubDestination } from '@/components/settings/panels/OrganisationHubPanel'
import { WarningsPanel } from '@/components/settings/panels/WarningsPanel'
import { PaymentRunsPanel } from '@/components/settings/panels/PaymentRunsPanel'
import { WorkingHoursPanel } from '@/components/settings/panels/WorkingHoursPanel'
import { AnnualLeaveDefaultsPanel } from '@/components/settings/panels/AnnualLeaveDefaultsPanel'
import { ScheduleOptionsPanel } from '@/components/settings/panels/ScheduleOptionsPanel'
import { CompanyDetailsPanel } from '@/components/settings/panels/CompanyDetailsPanel'

// ─── Subpanels ────────────────────────────────────────────────────────────────
type Panel = 
  | 'main'
  | 'profile'
  | 'password'
  | 'notifications'
  | 'organisation'
  | 'company-details'
  | 'working-hours'
  | 'annual-leave-defaults'
  | 'schedule-options'
  | 'warnings'
  | 'payment-runs'
  | 'roles'

const ORGANISATION_HUB_PANELS: Panel[] = [
  'organisation',
  'company-details',
  'working-hours',
  'annual-leave-defaults',
  'schedule-options',
  'warnings',
  'payment-runs',
  'roles',
]

function isOrganisationHubPanel(panel: Panel): boolean {
  return ORGANISATION_HUB_PANELS.includes(panel)
}

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

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsScreen({ initialPanel = 'main' }: { initialPanel?: Panel }) {
  const { user, organization, signOut } = useAuthStore()
  const canAccessOrgHub = canAccessOrganisationSettingsHub(user)
  const safeInitialPanel =
    !canAccessOrgHub && isOrganisationHubPanel(initialPanel) ? 'main' : initialPanel
  const [panel, setPanel] = useState<Panel>(safeInitialPanel)
  const isAdmin = hasAdminAccess(user)
  const initials = `${user?.firstName?.[0] || ''}${user?.surname?.[0] || ''}`.toUpperCase()

  useEffect(() => {
    if (!canAccessOrgHub && isOrganisationHubPanel(panel)) {
      setPanel('main')
    }
  }, [canAccessOrgHub, panel])

  if (panel === 'profile') return <div className="max-w-xl mx-auto pb-10"><ProfilePanel onBack={() => setPanel('main')} /></div>
  if (panel === 'password') return <div className="max-w-xl mx-auto pb-10"><PasswordPanel onBack={() => setPanel('main')} /></div>
  if (panel === 'notifications') return <div className="max-w-xl mx-auto pb-10"><NotificationsPanel onBack={() => setPanel('main')} /></div>
  if (panel === 'organisation' && canAccessOrgHub) {
    return (
      <OrganisationHubPanel
        onBack={() => setPanel('main')}
        onNavigate={(destination: OrganisationHubDestination) => setPanel(destination)}
      />
    )
  }
  if (panel === 'company-details' && canAccessOrgHub) return <CompanyDetailsPanel onBack={() => setPanel('organisation')} />
  if (panel === 'working-hours' && canAccessOrgHub) return <WorkingHoursPanel onBack={() => setPanel('organisation')} />
  if (panel === 'annual-leave-defaults' && canAccessOrgHub) return <AnnualLeaveDefaultsPanel onBack={() => setPanel('organisation')} />
  if (panel === 'schedule-options' && canAccessOrgHub) return <ScheduleOptionsPanel onBack={() => setPanel('organisation')} />
  if (panel === 'warnings' && canAccessOrgHub) return <WarningsPanel onBack={() => setPanel('organisation')} />
  if (panel === 'payment-runs' && canAccessOrgHub) return <PaymentRunsPanel onBack={() => setPanel('organisation')} />
  if (panel === 'roles' && canAccessOrgHub) return <RolesPanel onBack={() => setPanel('organisation')} />

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

      {/* Company-wide (admin only — managers and operatives never see this hub) */}
      {canAccessOrgHub && (
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

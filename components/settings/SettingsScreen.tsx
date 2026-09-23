'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuthStore } from '@/lib/stores/authStore'
import { uploadFile, profilePhotoPath } from '@/lib/firebase/storageUtils'
import { UserAvatar } from '@/components/users/UserAvatar'
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
import { MaterialCutOffPanel } from '@/components/settings/panels/MaterialCutOffPanel'
import { PaymentRunsPanel } from '@/components/settings/panels/PaymentRunsPanel'
import { WorkingHoursPanel } from '@/components/settings/panels/WorkingHoursPanel'
import { AnnualLeaveDefaultsPanel } from '@/components/settings/panels/AnnualLeaveDefaultsPanel'
import { ScheduleOptionsPanel } from '@/components/settings/panels/ScheduleOptionsPanel'
import { CompanyDetailsPanel } from '@/components/settings/panels/CompanyDetailsPanel'
import { BillingPanel } from '@/components/settings/panels/BillingPanel'
import { SettingsChrome } from '@/components/settings/SettingsChrome'
import {
  COMPANY_SETTINGS,
  PERSONAL_SETTINGS,
  settingsHrefForPanel,
  settingsPanelFromPath,
  type SettingsPanel,
} from '@/lib/settings/settingsNav'

// ─── Subpanels ────────────────────────────────────────────────────────────────
type Panel = SettingsPanel

const ORGANISATION_HUB_PANELS: Panel[] = [
  'organisation',
  'company-details',
  'working-hours',
  'annual-leave-defaults',
  'schedule-options',
  'warnings',
  'material-cutoff',
  'payment-runs',
  'roles',
  'billing',
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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

  const onPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user?.id) return
    setUploadingPhoto(true)
    setError('')
    try {
      if (!organization?.id) throw new Error('Missing organisation for profile photo')
      const url = await uploadFile(
        profilePhotoPath(organization.id, user.id),
        file,
        file.type || 'image/jpeg'
      )
      await updateDoc(doc(db, 'users', user.id), { profilePhotoURL: url, updatedAt: Timestamp.now() })
      const current = useAuthStore.getState().user
      if (current) useAuthStore.setState({ user: { ...current, profilePhotoURL: url } })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader title="My profile" onBack={onBack} />

      <div className="card pad">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Profile image</p>
        <div className="flex items-center gap-4">
          {user ? <UserAvatar user={{ ...user, firstName, surname }} size={56} /> : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white flex-shrink-0">
              {(firstName[0] || '') + (surname[0] || '')}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--ink)]">Profile photo</p>
            <p className="text-xs text-[var(--ink3)]">Used across Home and Settings. Same photo as iOS.</p>
          </div>
          <label className={`btn sm ${uploadingPhoto ? 'opacity-50' : ''}`}>
            {uploadingPhoto ? 'Uploading…' : 'Change photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploadingPhoto}
              onChange={onPhoto}
            />
          </label>
        </div>
      </div>

      {/* Fields */}
      <SettingsCard>
        <div className="px-4 py-3 space-y-1">
          <div className="flex items-center justify-between py-1"><span className="text-sm text-[var(--ink3)]">Name</span><span className="text-sm font-semibold text-[var(--ink)]">{user?.firstName} {user?.surname}</span></div>
          <div className="flex items-center justify-between py-1"><span className="text-sm text-[var(--ink3)]">Email</span><span className="text-sm font-semibold text-[var(--ink)]">{user?.email}</span></div>
          <div className="flex items-center justify-between py-1"><span className="text-sm text-[var(--ink3)]">Organisation</span><span className="text-sm font-semibold text-[var(--ink)]">{organization?.name}</span></div>
        </div>
      </SettingsCard>

      <div className="space-y-3 card pad">
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

      <div className="space-y-3 card pad">
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
            <p className="text-sm font-semibold text-slate-900">Material order cut-off</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Company reminder time is set in Organisation settings → Material cut-off, and syncs with iOS.
            </p>
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
      <div className="card pad text-center py-8">
        <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <p className="text-sm font-semibold text-slate-700">Change roles on user profiles</p>
        <p className="text-xs text-slate-400 mt-1">Use Manage users to assign admin, manager, or operative access.</p>
      </div>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsScreen({ initialPanel = 'main' }: { initialPanel?: Panel }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, organization, signOut } = useAuthStore()
  const canAccessOrgHub = canAccessOrganisationSettingsHub(user)
  const pathPanel = settingsPanelFromPath(pathname)
  const requestedPanel = pathPanel || initialPanel
  const safeInitialPanel =
    !canAccessOrgHub && isOrganisationHubPanel(requestedPanel) ? 'main' : requestedPanel
  const [panel, setPanel] = useState<Panel>(safeInitialPanel)
  const isAdmin = hasAdminAccess(user)

  useEffect(() => {
    setPanel(safeInitialPanel)
  }, [safeInitialPanel])

  useEffect(() => {
    if (!canAccessOrgHub && isOrganisationHubPanel(panel)) {
      setPanel('main')
    }
  }, [canAccessOrgHub, panel])

  const goHub = () => router.push('/dashboard/settings')
  const wrap = (active: Panel, node: ReactNode) => (
    <SettingsChrome panel={active} canAccessCompany={canAccessOrgHub}>
      {node}
    </SettingsChrome>
  )

  if (panel === 'profile') return wrap('profile', <ProfilePanel onBack={goHub} />)
  if (panel === 'password') return wrap('password', <PasswordPanel onBack={goHub} />)
  if (panel === 'notifications') return wrap('notifications', <NotificationsPanel onBack={goHub} />)
  if (panel === 'organisation' && canAccessOrgHub) {
    return wrap(
      'company-details',
      <OrganisationHubPanel
        onBack={goHub}
        onNavigate={(destination: OrganisationHubDestination) =>
          router.push(settingsHrefForPanel(destination))
        }
      />
    )
  }
  if (panel === 'company-details' && canAccessOrgHub) {
    return wrap('company-details', <CompanyDetailsPanel onBack={goHub} />)
  }
  if (panel === 'working-hours' && canAccessOrgHub) {
    return wrap('working-hours', <WorkingHoursPanel onBack={goHub} />)
  }
  if (panel === 'annual-leave-defaults' && canAccessOrgHub) {
    return wrap('annual-leave-defaults', <AnnualLeaveDefaultsPanel onBack={goHub} />)
  }
  if (panel === 'schedule-options' && canAccessOrgHub) {
    return wrap('schedule-options', <ScheduleOptionsPanel onBack={goHub} />)
  }
  if (panel === 'warnings' && canAccessOrgHub) {
    const openedFromWarningsList = pathname === '/dashboard/settings/warnings'
    return wrap(
      'warnings',
      <WarningsPanel
        onBack={() => {
          if (openedFromWarningsList) router.push('/dashboard/warnings')
          else goHub()
        }}
      />
    )
  }
  if (panel === 'material-cutoff' && canAccessOrgHub) {
    return wrap('material-cutoff', <MaterialCutOffPanel onBack={goHub} />)
  }
  if (panel === 'payment-runs' && canAccessOrgHub) {
    return wrap('payment-runs', <PaymentRunsPanel onBack={goHub} />)
  }
  if (panel === 'roles' && canAccessOrgHub) return wrap('roles', <RolesPanel onBack={goHub} />)
  if (panel === 'billing' && canAccessOrgHub) return wrap('billing', <BillingPanel onBack={goHub} />)

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 pb-10">
      <div className="phead" data-hue="lib">
        <div className="badge-ico">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1>Settings</h1>
          <div className="sub">Personal, company-wide and support</div>
        </div>
      </div>

      <section className="hero" style={{ padding: '22px 26px' }}>
        <div className="relative z-[1] flex items-center gap-4">
          {user ? <UserAvatar user={user} size={72} /> : null}
          <div className="min-w-0 grow">
            <div className="big" style={{ fontSize: 26 }}>
              {user?.firstName} {user?.surname}
            </div>
            <div className="opacity-85">{organization?.name}</div>
            {isAdmin ? (
              <span className="mt-2 inline-flex pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                Admin
              </span>
            ) : null}
          </div>
          <Link href="/dashboard/settings/profile" className="btn hbtn solid">
            My profile
          </Link>
        </div>
      </section>

      <div className="grid g2">
        <section>
          <SectionLabel label="Personal" />
          <SettingsCard>
            <Link href="/dashboard/change-organisation">
              <SettingsRow
                icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Switch organisation"
                description={organization?.name || 'No organisation linked'}
                chevron
              />
            </Link>
            {PERSONAL_SETTINGS.map((item) => (
              <Link key={item.id} href={item.href}>
                <SettingsRow
                  icon={item.icon}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                  label={item.label}
                  description={item.description}
                  chevron
                />
              </Link>
            ))}
          </SettingsCard>
        </section>

        {canAccessOrgHub ? (
          <section>
            <div className="row" style={{ margin: '0 6px 10px' }}>
              <SectionLabel label="Company-wide" />
              <span className="pill" data-hue="user">
                Admin only
              </span>
            </div>
            <SettingsCard>
              {COMPANY_SETTINGS.map((item) => (
                <Link key={item.id} href={item.href}>
                  <SettingsRow
                    icon={item.icon}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label={item.label}
                    description={item.description}
                    chevron
                  />
                </Link>
              ))}
            </SettingsCard>
            <p className="muted small" style={{ margin: '10px 6px' }}>
              These settings affect everyone in {organization?.name}.
            </p>
          </section>
        ) : null}
      </div>

      {/* Support & legal */}
      <SectionLabel label="Support & legal" />
      <SettingsCard>
        <Link href="/dashboard/help">
          <SettingsRow icon="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Help & support" description="Get in touch, browse FAQs" chevron />
        </Link>
        <Link href="/dashboard/privacy">
          <SettingsRow icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" iconBg="bg-slate-100" iconColor="text-slate-600" label="Privacy Policy" description="Legal agreements" chevron />
        </Link>
      </SettingsCard>

      {/* Sign out */}
      <SettingsCard>
        <button type="button" onClick={async () => { if (window.confirm('Are you sure you want to sign out?')) await signOut() }}
          className="flex w-full items-center justify-center gap-2 px-4 py-4 text-[var(--red)] hover:bg-[var(--red-t)] transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span className="text-sm font-bold">Sign out</span>
        </button>
      </SettingsCard>

      <p className="text-center text-[11px] text-slate-400">Project Planner · v1.0</p>
    </div>
  )
}

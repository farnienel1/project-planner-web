/* Harness: renders the real User profile / Edit user components with fixture stores (no Firebase). */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useUserStore } from '@/lib/stores/userStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { UserProfileSummary } from '@/components/users/UserProfileSummary'
import { EditUserProfile } from '@/components/users/EditUserProfile'
import ProfileLoading from '@/app/dashboard/users/[userId]/loading'
import EditLoading from '@/app/dashboard/users/[userId]/edit/loading'

const w = window as any
const params = new URLSearchParams(location.search)
const view = params.get('view') || 'edit'
const variant = params.get('variant') || 'operative'
const theme = params.get('theme') || 'light'
document.documentElement.setAttribute('data-theme', theme)
document.documentElement.style.colorScheme = theme

const now = new Date('2026-11-12T12:03:00Z')
const base = {
  organizationId: 'org1',
  isActive: true,
  passwordSet: true,
  isSuperAdmin: false,
  policyAccepted: true,
  createdAt: new Date('2025-01-10T09:00:00Z'),
  updatedAt: new Date('2026-11-01T09:00:00Z'),
  lastSeenAt: now,
  annualLeaveEnabled: true,
  timesheetsEnabled: true,
}
const perms = (p: Record<string, boolean>) => ({
  adminAccess: false,
  manager: false,
  operatives: false,
  skills: false,
  qualifications: false,
  materials: false,
  projects: false,
  smallWorks: false,
  operativeMode: false,
  siteAudit: false,
  subContractors: false,
  wholesalersOrderHistory: false,
  annualLeaveSelfBook: false,
  dailyOverview: true,
  ...p,
})
const adminPerms = perms({ adminAccess: true, manager: true, operatives: true, skills: true, qualifications: true, materials: true, projects: true, smallWorks: true, siteAudit: true, subContractors: true, wholesalersOrderHistory: true, annualLeaveSelfBook: true, timesheetSelfSign: true, weeklyReports: true })

const users: any[] = [
  { ...base, id: 'admin1', email: 'test.admin@raccordmep.co.uk', firstName: 'Test', surname: 'Admin', role: 'admin', isSuperAdmin: true, permissions: adminPerms, hasNoLineManager: true, payBasis: 'day', dayRate: 250, tradeTypePreset: 'Carpenter', mobileNumber: '07700900001' },
  { ...base, id: 'mgr1', email: 'farnie@raccordmep.co.uk', firstName: 'Test', surname: 'Manager', role: 'manager', permissions: perms({ manager: true, materials: true, siteAudit: true, dailyOverview: true, annualLeaveSelfBook: true, wholesalersOrderHistory: true, projects: true }), assignedManagerUserId: 'admin1', assignedManagerUserIds: ['admin1'], payBasis: 'hourly', hourlyRate: 25, employmentType: 'paye', tradeTypePreset: 'Electrician', mobileNumber: '07700900002' },
  { ...base, id: 'mgr2', email: 'ops.manager@raccordmep.co.uk', firstName: 'Olivia', surname: 'Operatives-Manager', role: 'manager', permissions: perms({ manager: true, operatives: true, materials: true, siteAudit: true }), assignedManagerUserId: 'admin1', assignedManagerUserIds: ['admin1'], payBasis: 'day', dayRate: 200, employmentType: 'self_employed' },
  { ...base, id: 'adm2', email: 'second.administrator.with.a.very.long.address@raccordmep-example-company.co.uk', firstName: 'Alexandra', surname: 'Montgomery-Fairweather', role: 'admin', permissions: { ...adminPerms, annualLeaveSelfBook: false, timesheetSelfSign: false }, assignedManagerUserId: 'admin1', assignedManagerUserIds: ['admin1'], payBasis: 'day', dayRate: 300, employmentType: 'paye', tradeTypePreset: 'Other', tradeTypeCustom: 'Commercial manager' },
  { ...base, id: 'op1', email: 'farnienel@hotmail.com', firstName: 'Farnie', surname: 'Nel', role: 'operative', permissions: perms({ operativeMode: true, materials: true, siteAudit: true }), assignedManagerUserId: 'mgr1', assignedManagerUserIds: ['mgr1'], payBasis: 'day', dayRate: 225, employmentType: 'self_employed', tradeTypePreset: 'Electrician', mobileNumber: '07876643693', annualLeaveDaysPerYear: 21 },
  { ...base, id: 'op2', email: 'inactive.op@raccordmep.co.uk', firstName: 'Ivan', surname: 'Inactive', role: 'operative', isActive: false, permissions: perms({ operativeMode: true, materials: true }), assignedManagerUserId: 'mgr1', assignedManagerUserIds: ['mgr1'], payBasis: 'day', dayRate: 180, employmentType: 'self_employed', tradeTypePreset: 'Plumber' },
  { ...base, id: 'op3', email: 'no.allowance@raccordmep.co.uk', firstName: 'Nora', surname: 'Allowance', role: 'operative', annualLeaveEnabled: false, permissions: perms({ operativeMode: true }), assignedManagerUserId: 'mgr1', assignedManagerUserIds: ['mgr1'], payBasis: 'hourly', hourlyRate: 19.5, employmentType: 'self_employed', tradeTypePreset: 'Labourer' },
  { ...base, id: 'op4', email: 'pending.invite@raccordmep.co.uk', firstName: 'Petra', surname: 'Pending', role: 'operative', passwordSet: false, status: 'pending', lastSeenAt: undefined, permissions: perms({ operativeMode: true }), assignedManagerUserId: 'mgr1', assignedManagerUserIds: ['mgr1'], payBasis: 'day', dayRate: 150, employmentType: 'self_employed' },
  { ...base, id: 'gh1', email: '', firstName: 'Gary', surname: 'Ghost', role: 'operative', ghost: true, passwordSet: false, lastSeenAt: undefined, permissions: perms({ operativeMode: true }), assignedManagerUserId: 'mgr1', assignedManagerUserIds: ['mgr1'], payBasis: 'day', dayRate: 160, employmentType: 'self_employed', tradeTypePreset: 'Labourer', timesheetsEnabled: false },
]
const byId = Object.fromEntries(users.map((u) => [u.id, u]))

const variants: Record<string, { viewer: string; target: string }> = {
  operative: { viewer: 'admin1', target: 'op1' },
  manager: { viewer: 'admin1', target: 'mgr1' },
  admin: { viewer: 'admin1', target: 'adm2' },
  superadmin: { viewer: 'admin1', target: 'admin1' },
  inactive: { viewer: 'admin1', target: 'op2' },
  allowanceoff: { viewer: 'admin1', target: 'op3' },
  pending: { viewer: 'admin1', target: 'op4' },
  ghost: { viewer: 'admin1', target: 'gh1' },
  opsmgr: { viewer: 'mgr2', target: 'op1' },
  operativeview: { viewer: 'mgr1', target: 'op1' },
}
const v = variants[variant] || variants.operative
const viewer = byId[v.viewer]
const targetId = v.target

const qual = (id: string, name: string) => ({ id, name, hasEndDate: true, createdAt: base.createdAt, updatedAt: base.createdAt })
const operatives: any[] = [
  {
    id: 'oprow1',
    firstName: 'Farnie',
    lastName: 'Nel',
    email: 'farnienel@hotmail.com',
    startDate: base.createdAt,
    hourlyRate: 0,
    dayRate: 225,
    payBasis: 'day',
    skills: [],
    qualifications: [qual('q1', 'Qualified Supervisor (NAPIT)'), qual('q2', 'NVQ Level 7 Senior Construction Management with a long name')],
    qualificationExpiryDates: { q2: new Date('2026-09-30T00:00:00Z') },
    qualificationCertificateURLs: { q2: 'https://example.invalid/cert.pdf' },
    isActive: true,
    createdAt: base.createdAt,
    updatedAt: base.createdAt,
    organizationId: 'org1',
  },
]

w.__FIXTURES__ = {
  'organizations/org1': {
    name: 'Raccord MEP',
    countryCode: 'GB',
    currencyCode: 'GBP',
    creatorUserId: 'admin1',
    members: Object.fromEntries(users.filter((u) => u.id !== 'gh1').map((u) => [u.id, u.role])),
    annualLeaveDefaults: { daysPerYear: 25, startMonth: 1, endMonth: 12, carriesOver: false },
  },
}
w.__SAVES__ = []

const organization = { id: 'org1', name: 'Raccord MEP', creatorUserId: 'admin1' }
const clone = (u: any) => (u ? { ...u, permissions: { ...u.permissions } } : null)

useAuthStore.setState({ user: viewer, organization, loading: false, reloadSignedInProfile: async () => {} } as never)
useOrgUserStore.setState({
  users,
  rosterDocuments: users,
  rosterDocumentsOrgId: 'org1',
  userIdAliases: {},
  loadUsers: async () => {},
} as never)
useOperativeStore.setState({
  operatives,
  loadOperatives: async () => {},
  patchOperativeQualifications: async (_org: string, op: any) => {
    w.__SAVES__.push({ fn: 'patchOperativeQualifications', op })
    return op.id
  },
} as never)
useHolidayStore.setState({ bookings: [], loadBookings: async () => {} } as never)
useInviteStore.setState({ inviteUser: async (args: any) => void w.__SAVES__.push({ fn: 'inviteUser', args }) } as never)
const realUserStore = useUserStore.getState()
const record = (fn: string, real?: (...a: any[]) => any) => async (...args: any[]) => {
  w.__SAVES__.push({ fn, args })
  if (real) {
    try {
      return await real(...args)
    } catch (e) {
      w.__SAVES__.push({ fn: fn + ':threw', error: String(e) })
    }
  }
  return undefined
}
useUserStore.setState({
  getUser: async (id: string) => clone(byId[id]),
  saveUser: record('saveUser', realUserStore.saveUser),
  setUserActive: record('setUserActive', realUserStore.setUserActive),
  deleteUser: record('deleteUser'),
  sendPasswordReset: record('sendPasswordReset'),
  changeAccountType: record('changeAccountType', realUserStore.changeAccountType),
  syncLinkedOperative: record('syncLinkedOperative'),
  transferSuperAdmin: record('transferSuperAdmin'),
  removeFromManagedJobs: async (...args: any[]) => {
    w.__SAVES__.push({ fn: 'removeFromManagedJobs', args })
    return 0
  },
} as never)

w.__PATHNAME__ = view === 'profile' ? `/dashboard/users/${targetId}` : `/dashboard/users/${targetId}/edit`

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame min-h-screen text-[var(--ink)]">
      <div className="flex min-h-screen">
        <aside className="sb hidden lg:block lg:w-[244px] lg:shrink-0" aria-label="Main" />
        <div className="app-panel flex min-w-0 flex-1 flex-col">
          <header className="tb flex h-[54px] items-center px-5">
            <b>Manage users</b>
          </header>
          <main className="min-w-0 flex-1">
            <div className="page mx-auto w-full max-w-shell px-4 py-6 min-[760px]:px-7 min-[760px]:pb-14" id="harness-page">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

const page =
  view === 'profile' ? (
    <UserProfileSummary userId={targetId} backHref="/dashboard/settings/users" from="users" />
  ) : view === 'loading-profile' ? (
    <ProfileLoading />
  ) : view === 'loading-edit' ? (
    <EditLoading />
  ) : (
    <EditUserProfile
      userId={targetId}
      backHref={`/dashboard/users/${targetId}?from=users`}
      suppressAdminAccessToggle={false}
      hubHref="/dashboard/settings/users"
    />
  )

createRoot(document.getElementById('root')!).render(<Shell>{page}</Shell>)
w.__HARNESS_READY__ = true

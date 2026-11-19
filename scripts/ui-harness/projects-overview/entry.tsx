/* Harness: renders the real Projects / Small works workspace pages (Overview, a section page, not found) with a
   fake Firestore over fixtures, for the before / after comparison of the UI-only restyle
   (docs/design/projects-overview-ui/). Not run by CI. */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useAuthStore } from '@/lib/stores/authStore'
import ProjectPage from '@/app/dashboard/projects/[id]/page'
import SmallWorkPage from '@/app/dashboard/small-works/[id]/page'
import { ProjectFeaturePageShell } from '@/components/projects/ProjectFeaturePageShell'

const w = window as any
const params = new URLSearchParams(location.search)
const view = params.get('view') || 'overview' // overview | section | notfound
const variant = params.get('variant') || 'admin' // admin | mgrassigned | mgrother | operative
const kind = params.get('kind') || 'proj' // proj | sw
const long = params.get('long') === '1'
const theme = params.get('theme') || 'light'
// theme=system: no data-theme, so the prefers-color-scheme dark tokens apply (overflow.mjs emulates a dark system).
if (theme !== 'system') {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
}

const ts = (iso: string) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 })
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
const adminPerms = perms({ adminAccess: true, manager: true, operatives: true, materials: true, projects: true, smallWorks: true, siteAudit: true, subContractors: true, wholesalersOrderHistory: true, annualLeaveSelfBook: true, weeklyReports: true })
const userBase = { organizationId: 'org1', isActive: true, passwordSet: true, isSuperAdmin: false, createdAt: ts('2025-01-10T09:00:00Z') }
const users: Record<string, any> = {
  admin1: { ...userBase, email: 'test.admin@example.test', firstName: 'Test', surname: 'Admin', role: 'admin', isSuperAdmin: true, adminAccess: true, permissions: adminPerms, hasNoLineManager: true },
  mgr1: { ...userBase, email: 'mia.manager@example.test', firstName: 'Mia', surname: 'Manager', role: 'manager', manager: true, permissions: perms({ manager: true, materials: true, siteAudit: true }), assignedManagerUserIds: ['admin1'] },
  mgr3: { ...userBase, email: 'other.manager@example.test', firstName: 'Oscar', surname: 'Other', role: 'manager', manager: true, permissions: perms({ manager: true, materials: true, siteAudit: true }), assignedManagerUserIds: ['admin1'] },
  op1: { ...userBase, email: 'ollie.op@example.test', firstName: 'Ollie', surname: 'Operative', role: 'operative', operativeMode: true, permissions: perms({ operativeMode: true, materials: true, siteAudit: true }), assignedManagerUserIds: ['mgr1'], payBasis: 'day', dayRate: 200, employmentType: 'self_employed' },
}
const viewerId = ({ admin: 'admin1', mgrassigned: 'mgr1', mgrother: 'mgr3', operative: 'op1' } as Record<string, string>)[variant] || 'admin1'
const viewer = { id: viewerId, ...users[viewerId], createdAt: new Date('2025-01-10T09:00:00Z') }

const siteName = long
  ? 'Refurbishment of the Grand Victorian Exchange Building and Adjoining Warehouse Courtyard Extension Phase Two'
  : 'High Street Fit Out'
const projectDoc = {
  jobNumber: 'J-1042',
  siteName: kind === 'proj' ? siteName : 'Kitchen Socket Swap',
  addressLine1: kind === 'proj' ? '1 High Street' : '',
  townCity: kind === 'proj' ? 'Leeds' : '',
  postcode: kind === 'proj' ? 'LS1 1AA' : '',
  client: { id: 'client1', name: long ? 'Northern Consolidated Property Holdings and Investments Limited' : 'Client Co' },
  startDate: ts(kind === 'proj' ? '2026-11-02T00:00:00Z' : '2026-12-01T00:00:00Z'),
  endDate: ts(kind === 'proj' ? '2026-12-18T00:00:00Z' : '2026-12-05T00:00:00Z'),
  jobType: kind === 'proj' ? 'CAT A' : 'Small Works',
  description: kind === 'proj' ? 'Strip out and fit out of the ground floor.' : '',
  notes: kind === 'proj' ? 'Keys from the concierge.' : '',
  managerId: 'user:mgr1',
  managerIds: ['user:mgr1'],
  managerUserIds: ['mgr1'],
  isLive: true,
  organizationId: 'org1',
  createdAt: ts('2026-10-01T09:00:00Z'),
}
const col = kind === 'proj' ? 'projects' : 'smallWorks'
const jobId = 'JOB1'
const fixtures: Record<string, any> = {
  'organizations/org1': {
    name: 'Acme Build',
    countryCode: 'GB',
    currencyCode: 'GBP',
    creatorUserId: 'admin1',
    members: { admin1: 'admin', mgr1: 'manager', mgr3: 'manager', op1: 'operative' },
    payrollTimePolicy: { standardDayStart: '07:30', standardDayEnd: '16:00', unpaidBreakMinutes: 30, breakWindowStart: '12:00', breakWindowEnd: '12:30', weekdayOvertimeMultiplier: 1.5 },
  },
  'organizations/org1/managers/mgrrow1': { firstName: 'Mia', lastName: 'Manager', email: 'mia.manager@example.test', isActive: true, organizationId: 'org1' },
  'organizations/org1/operatives/oprow1': { firstName: 'Ollie', lastName: 'Operative', email: 'ollie.op@example.test', isActive: true, organizationId: 'org1', payBasis: 'day', dayRate: 200 },
  'organizations/org1/tasks/T1': { projectId: jobId, title: 'Order skip', status: 'To Do', priority: 'Medium', assignedOperativeIds: [], assignedManagerIds: [], items: [], completedItemIds: [], organizationId: 'org1', createdAt: ts('2026-11-01T09:00:00Z') },
  'organizations/org1/tasks/T2': { projectId: jobId, title: 'Snag list', status: 'In Progress', priority: 'High', assignedOperativeIds: [], assignedManagerIds: [], items: [], completedItemIds: [], organizationId: 'org1', createdAt: ts('2026-11-01T09:00:00Z') },
  'organizations/org1/tasks/T3': { projectId: jobId, title: 'Done item', status: 'Completed', priority: 'Low', assignedOperativeIds: [], assignedManagerIds: [], items: [], completedItemIds: [], organizationId: 'org1', createdAt: ts('2026-11-01T09:00:00Z') },
  'organizations/org1/bookings/B1': { operativeId: 'op1', projectId: jobId, date: ts('2026-11-13T00:00:00Z'), timeSlot: 'FULL DAY', status: 'Confirmed', bookedBy: 'Test Admin', isBreakRemoved: false, jobCollection: col },
  'organizations/org1/bookings/B2': { operativeId: 'op1', projectId: jobId, date: ts('2026-11-14T00:00:00Z'), timeSlot: 'CUSTOM HOURS', workStartTime: '07:30', workEndTime: '19:00', status: 'Confirmed', bookedBy: 'Test Admin', isBreakRemoved: false, jobCollection: col },
  'organizations/org1/variations/V1': { orgId: 'org1', parentId: jobId, parentType: kind === 'proj' ? 'project' : 'smallWork', voNumber: 'VO-001', sequence: 1, heading: 'Extra socket', status: 'open', labour: [], materials: [], evidence: [] },
  'organizations/org1/variations/V2': { orgId: 'org1', parentId: jobId, parentType: kind === 'proj' ? 'project' : 'smallWork', voNumber: 'VO-002', sequence: 2, heading: 'Move door', status: 'submitted', labour: [], materials: [], evidence: [] },
}
for (const [id, u] of Object.entries(users)) fixtures[`users/${id}`] = u
if (view !== 'notfound') fixtures[`organizations/org1/${col}/${jobId}`] = projectDoc
w.__FIXTURES__ = fixtures

const basePath = kind === 'proj' ? `/dashboard/projects/${jobId}` : `/dashboard/small-works/${jobId}`
w.__PARAMS__ = { id: jobId }
w.__PATHNAME__ = view === 'section' ? `${basePath}/tasks` : basePath

useAuthStore.setState({ user: viewer, organization: { id: 'org1', name: 'Acme Build', creatorUserId: 'admin1', countryCode: 'GB' }, loading: false } as never)

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame min-h-screen text-[var(--ink)]">
      <div className="flex min-h-screen">
        <aside className="sb hidden lg:block lg:w-[244px] lg:shrink-0" aria-label="Main" />
        <div className="app-panel flex min-w-0 flex-1 flex-col">
          <header className="tb flex h-[54px] items-center px-5">
            <b>Projects</b>
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
  view === 'section' ? (
    <ProjectFeaturePageShell title="Tasks" backLabel="Back to project" collection={col}>
      {() => <div data-testid="section-body">Section content</div>}
    </ProjectFeaturePageShell>
  ) : kind === 'proj' ? (
    <ProjectPage />
  ) : (
    <SmallWorkPage />
  )

createRoot(document.getElementById('root')!).render(<Shell>{page}</Shell>)
w.__HARNESS_READY__ = true

'use client'
import '@/app/pages-ui.css'
import { userCanEditJob } from '@/lib/access/bookingAccess'
import '@/app/projects-ui.css'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CameraIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CubeIcon,
  EyeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  FlagIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'
import {
  daysLeftCaption,
  deriveWorkStatus,
  timelineProgressPercent,
  workStatusLabel,
} from '@/lib/projects/workStatus'
import { visibleJobTypeLabel } from '@/lib/jobTypes/jobTypesStorage'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import { useAuthStore } from '@/lib/stores/authStore'
import { canOpenJobScheduling, canViewMaterials, canViewSiteAudit } from '@/lib/permissions'
import { canViewProjectActiveUsers } from '@/lib/projects/activeUsers'
import { useActiveUserBadge } from '@/components/projects/features/ProjectActiveUsersSection'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { jobHubTiles } from '@/lib/projects/jobHubTiles'
import { canSeeJobVariations } from '@/lib/variations/variationAccess'
import { subscribeParentVariations } from '@/lib/variations/variationStorage'
import { assignedManagerLabel, assignedManagerNames } from '@/lib/projects/assignedManagers'
import type { SectionHue } from '@/lib/ui/sectionHue'
import type { Project, User } from '@/types'
import { projectJobKind, projectStatusTone } from '@/lib/ui/projectWorkspaceUi'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { openVariationCount } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

function formatLondonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: organizationZoneOr(),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function canConfigureProjectVisibility(user: User | null, isSmallWork: boolean): boolean {
  if (!user || user.permissions.operativeMode) return false
  if (user.isSuperAdmin || user.permissions.adminAccess) return true
  if (!user.permissions.manager) return false
  return isSmallWork ? user.permissions.smallWorks !== false : user.permissions.projects !== false
}

const TAB_META: Record<string, { hue: SectionHue; icon: typeof Squares2X2Icon }> = {
  overview: { hue: 'blue', icon: Squares2X2Icon },
  schedule: { hue: 'sched', icon: CalendarDaysIcon },
  view: { hue: 'user', icon: EyeIcon },
  tasks: { hue: 'task', icon: ClipboardDocumentCheckIcon },
  materials: { hue: 'sw', icon: CubeIcon },
  'health-safety': { hue: 'hs', icon: ShieldCheckIcon },
  deadlines: { hue: 'red', icon: FlagIcon },
  'site-audit': { hue: 'daily', icon: CameraIcon },
  location: { hue: 'proj', icon: MapPinIcon },
  variations: { hue: 'warn', icon: DocumentTextIcon },
  'active-users': { hue: 'user', icon: UserGroupIcon },
}

function tabFromPath(pathname: string, basePath: string): string {
  const rest = pathname.slice(basePath.length).replace(/^\//, '')
  if (!rest) return 'overview'
  if (rest.startsWith('schedule')) return 'schedule'
  if (rest.startsWith('view')) return 'view'
  if (rest.startsWith('tasks')) return 'tasks'
  if (rest.startsWith('materials')) return 'materials'
  if (rest.startsWith('health-safety')) return 'health-safety'
  if (rest.startsWith('deadlines')) return 'deadlines'
  if (rest.startsWith('site-audit')) return 'site-audit'
  if (rest.startsWith('location')) return 'location'
  if (rest.startsWith('variations')) return 'variations'
  if (rest.startsWith('active-users')) return 'active-users'
  return 'overview'
}

function hideWorkspaceTabs(pathname: string): boolean {
  return (
    pathname.includes('/schedule/operatives') ||
    pathname.includes('/schedule/subcontractors') ||
    /\/edit\/?$/.test(pathname)
  )
}

export function ProjectWorkspaceChrome({
  project,
  basePath,
  taskCount,
  children,
}: {
  project: Project
  basePath: string
  taskCount?: number
  children: ReactNode
}) {
  const pathname = usePathname() || ''
  const { user, organization } = useAuthStore()
  const isSmallWork = basePath.includes('small-works')
  // Rulebook 1.21.0: the job's day is the organisation's (`jobWorkStatus`), never London or the browser.
  const timeZone = useOrganizationTimeZone()
  const now = new Date()
  const status = deriveWorkStatus(project, now, timeZone)
  const progress = timelineProgressPercent(project.startDate, project.endDate, status, now, timeZone)
  const remaining = daysLeftCaption(project.endDate, status, now, timeZone)
  // 1.10.0 round 2 (`canEditJob`): a manager edits the details of a job they manage even without the toggle.
  const canEdit = userCanEditJob(user, project, isSmallWork ? 'smallWorks' : 'projects', useOperativeStore.getState().managers)
  // Rulebook §2 `canScheduleOperatives`: Book labour and the Scheduling tab are never offered to an operative.
  const showBook = canOpenJobScheduling(user)
  const showViewTile = canConfigureProjectVisibility(user, isSmallWork)
  const isOperative = isOperativeMode(user)
  const { managers: rosterManagers, loadManagers } = useOperativeStore()
  const { loadUsers } = useOrgUserStore()
  const managerRoster = useRosterDocuments(organization?.id)
  const showActiveUsers = canViewProjectActiveUsers(user, rosterManagers, project)
  const activeUserCount = useActiveUserBadge(project, showActiveUsers)

  useEffect(() => {
    if (!organization?.id) return
    void loadManagers(organization.id)
    void loadUsers(organization.id)
  }, [organization?.id, loadManagers, loadUsers])
  const active = tabFromPath(pathname, basePath)
  const hideTabs = hideWorkspaceTabs(pathname)
  const typeLabel = visibleJobTypeLabel(project.jobType, project.customJobType)
  const managers = assignedManagerLabel(project, rosterManagers, managerRoster, organization?.id)
  const catalogue = isSmallWork ? '/dashboard/small-works' : '/dashboard/projects'
  const catalogueLabel = isSmallWork ? 'Small works' : 'Projects'

  const showVariations = canSeeJobVariations(user, project, rosterManagers)
  const [openVariations, setOpenVariations] = useState(0)

  useEffect(() => {
    if (!showVariations || !organization?.id) {
      setOpenVariations(0)
      return
    }
    return subscribeParentVariations(
      organization.id,
      project.id,
      (rows) => setOpenVariations(openVariationCount(rows)),
      () => setOpenVariations(0)
    )
  }, [showVariations, organization?.id, project.id])

  const tiles = jobHubTiles({
    isOperative,
    canSchedule: showBook,
    showViewTile,
    canViewMaterials: canViewMaterials(user),
    canViewSiteAudit: canViewSiteAudit(user),
    showActiveUsers,
    locationCaption: project.addressLine1 || undefined,
  }).map((tile) => {
    if (tile.href === 'tasks') return { ...tile, badge: taskCount }
    if (tile.href === 'active-users' && activeUserCount) return { ...tile, badge: activeUserCount }
    return tile
  })

  const tabs = [
    { href: '', label: 'Overview', key: 'overview', badge: undefined as number | undefined },
    ...(showVariations
      ? [
          {
            href: 'variations',
            label: 'Variations',
            key: 'variations',
            badge: openVariations > 0 ? openVariations : undefined,
          },
        ]
      : []),
    ...tiles.map((tile) => ({
      href: tile.href,
      label: tile.href === 'view' ? 'View access' : tile.href === 'health-safety' ? 'H&S' : tile.label,
      key: tile.href,
      badge: tile.badge,
    })),
  ]

  return (
    <div className="pj">
      <div className="pj-back-row">
        <Link href={catalogue} className="pj-back">
          ← {catalogueLabel}
        </Link>
      </div>

      <section className="pj-band" data-kind={projectJobKind(isSmallWork)}>
        <div className="pj-band-top">
          <div className="pj-band-id">
            <div className="pj-band-meta">
              <span className="pj-band-num">
                <span className="pj-kind-dot" aria-hidden="true" />
                {project.jobNumber}
              </span>
              {typeLabel ? <span className="pj-band-chip">{typeLabel.toUpperCase()}</span> : null}
              <span className="pj-band-chip" data-tone={projectStatusTone(workStatusLabel(status))}>
                <i aria-hidden="true" />
                {workStatusLabel(status)}
              </span>
            </div>
            {active === 'overview' ? (
              <h1 className="pj-band-title">{project.siteName}</h1>
            ) : (
              <p className="pj-band-title">{project.siteName}</p>
            )}
            <p className="pj-band-sub">
              {project.client?.name || 'No client'} · {managers}
            </p>
          </div>
          {canEdit || showBook ? (
            <div className="pj-band-acts">
              {canEdit ? (
                <Link href={`${basePath}/edit`} className="pj-bbtn ghost">
                  <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              ) : null}
              {showBook ? (
                <Link href={`${basePath}/schedule/operatives`} className="pj-bbtn solid">
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  Book labour
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="pj-band-stats">
          <div className="pj-band-prog">
            <div className="pj-band-prog-line">
              <b>{progress}% complete</b>
              <span>
                {remaining} · {formatLondonDay(new Date(project.startDate))} – {formatLondonDay(new Date(project.endDate))}
              </span>
            </div>
            <div className="pj-band-bar">
              <i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
          </div>
          {showVariations ? (
            <div className="pj-band-stat">
              <span>Variations</span>
              <b>{openVariations}</b>
            </div>
          ) : null}
          {taskCount !== undefined ? (
            <div className="pj-band-stat">
              <span>Tasks</span>
              <b>{taskCount}</b>
            </div>
          ) : null}
          {showActiveUsers && activeUserCount !== undefined ? (
            <div className="pj-band-stat">
              <span>Active users</span>
              <b>{activeUserCount}</b>
            </div>
          ) : null}
        </div>
      </section>

      {!hideTabs ? (
        <nav className="pj-tiles" aria-label="Project sections">
          {tabs.map((tab) => {
            const meta = TAB_META[tab.key] || TAB_META.overview
            const Icon = meta.icon
            const on = tab.key === active
            return (
              <Link
                key={tab.key}
                href={tab.href ? `${basePath}/${tab.href}` : basePath}
                className={on ? 'pj-tile on' : 'pj-tile'}
                aria-current={on ? 'page' : undefined}
              >
                <span className="pj-ico" aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="pj-tile-label">{tab.label}</span>
                {tab.badge ? <span className="pj-tile-count">{tab.badge}</span> : null}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {children}
    </div>
  )
}

export function ProjectDetailsCard({
  project,
  basePath,
  canEdit,
}: {
  project: Project
  basePath: string
  canEdit: boolean
}) {
  const { organization } = useAuthStore()
  const rosterManagers = useOperativeStore((state) => state.managers)
  const users = useRosterDocuments(organization?.id)
  const address = formatSiteAddress(project)
  const managerNames = assignedManagerNames(project, rosterManagers, users, organization?.id)
  const rows: {
    hue: SectionHue
    label: string
    value: string
    warn?: boolean
    icon: typeof BuildingOffice2Icon
  }[] = [
    { hue: 'blue', label: 'Client', value: project.client?.name || '—', icon: BuildingOffice2Icon },
    {
      hue: 'user',
      label: managerNames.length > 1 ? 'Managers' : 'Manager',
      value: managerNames.length > 0 ? managerNames.join(', ') : '—',
      icon: UserGroupIcon,
    },
    {
      hue: 'sched',
      label: 'Timeline',
      value: `${formatLondonDay(new Date(project.startDate))} – ${formatLondonDay(new Date(project.endDate))}`,
      icon: ClockIcon,
    },
    {
      hue: 'proj',
      label: 'Address',
      value: address || 'No address yet. Add one so the team can find site.',
      warn: !address,
      icon: MapPinIcon,
    },
    { hue: 'lib', label: 'Description', value: project.description || 'No description added', icon: DocumentTextIcon },
  ]

  return (
    <section className="pj-card">
      <div className="pj-card-h">
        <h2 className="pj-card-title">Details</h2>
        {canEdit ? (
          <Link href={`${basePath}/edit`} className="pj-link">
            Edit
          </Link>
        ) : null}
      </div>
      <div className="pj-card-b">
        <dl className="pj-dl">
          {rows.map((row) => {
            const Icon = row.icon
            const soft = !row.warn && row.label === 'Description' && !project.description
            return (
              <div key={row.label}>
                <Icon className="pj-dl-icon h-4 w-4" aria-hidden="true" />
                <div className="min-w-0">
                  <dt>{row.label}</dt>
                  <dd className={row.warn ? 'warn' : soft ? 'soft' : undefined}>{row.value}</dd>
                </div>
              </div>
            )
          })}
          {project.notes ? (
            <div>
              <ChatBubbleLeftRightIcon className="pj-dl-icon h-4 w-4" aria-hidden="true" />
              <div className="min-w-0">
                <dt>Notes</dt>
                <dd>{project.notes}</dd>
              </div>
            </div>
          ) : null}
        </dl>
        {canEdit ? (
          <Link href={`${basePath}/edit`} className="pj-btn primary">
            Edit project details
          </Link>
        ) : null}
      </div>
    </section>
  )
}

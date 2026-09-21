'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { format } from 'date-fns'
import {
  CalendarDaysIcon,
  CameraIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  EyeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/solid'
import {
  daysLeftCaption,
  deriveWorkStatus,
  timelineProgressPercent,
  workStatusLabel,
} from '@/lib/projects/workStatus'
import { formatSiteAddress } from '@/lib/maps/siteAddress'
import { useAuthStore } from '@/lib/stores/authStore'
import { canBookWork, canManageWorkCatalogue, canViewMaterials, canViewSiteAudit } from '@/lib/permissions'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { jobHubTiles } from '@/lib/projects/jobHubTiles'
import type { SectionHue } from '@/lib/ui/sectionHue'
import type { Project, User } from '@/types'
import { cn } from '@/lib/ui/cn'

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
  'site-audit': { hue: 'daily', icon: CameraIcon },
  location: { hue: 'proj', icon: MapPinIcon },
}

function tabFromPath(pathname: string, basePath: string): string {
  const rest = pathname.slice(basePath.length).replace(/^\//, '')
  if (!rest) return 'overview'
  if (rest.startsWith('schedule')) return 'schedule'
  if (rest.startsWith('view')) return 'view'
  if (rest.startsWith('tasks')) return 'tasks'
  if (rest.startsWith('materials')) return 'materials'
  if (rest.startsWith('health-safety')) return 'health-safety'
  if (rest.startsWith('site-audit')) return 'site-audit'
  if (rest.startsWith('location')) return 'location'
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
  const { user } = useAuthStore()
  const isSmallWork = basePath.includes('small-works')
  const status = deriveWorkStatus(project)
  const progress = timelineProgressPercent(project.startDate, project.endDate, status)
  const remaining = daysLeftCaption(project.endDate, status)
  const canEdit = canManageWorkCatalogue(user, isSmallWork ? 'smallWorks' : 'projects')
  const showBook = canBookWork(user) && !isOperativeMode(user)
  const showViewTile = canConfigureProjectVisibility(user, isSmallWork)
  const isOperative = isOperativeMode(user)
  const active = tabFromPath(pathname, basePath)
  const hideTabs = hideWorkspaceTabs(pathname)
  const typeLabel = (project.customJobType?.trim() || project.jobType || '').trim()
  const managers = project.manager?.name || '—'
  const catalogue = isSmallWork ? '/dashboard/small-works' : '/dashboard/projects'
  const catalogueLabel = isSmallWork ? 'Small works' : 'Projects'

  const tiles = jobHubTiles({
    isOperative,
    showViewTile,
    canViewMaterials: canViewMaterials(user),
    canViewSiteAudit: canViewSiteAudit(user),
    locationCaption: project.addressLine1 || undefined,
  }).map((tile) => (tile.href === 'tasks' ? { ...tile, badge: taskCount } : tile))

  const tabs = [
    { href: '', label: 'Overview', key: 'overview' as const, badge: undefined as number | undefined },
    ...tiles.map((tile) => ({
      href: tile.href,
      label: tile.href === 'view' ? 'View access' : tile.href === 'health-safety' ? 'H&S' : tile.label,
      key: tile.href,
      badge: tile.badge,
    })),
  ]

  return (
    <div>
      <div className="mb-3">
        <Link href={catalogue} className="btn sm ghost">
          ← {catalogueLabel}
        </Link>
      </div>

      <section className="hero" data-hue={isSmallWork ? 'sw' : undefined} style={{ padding: '24px 28px' }}>
        <div className="relative z-[1] flex flex-wrap items-start gap-[18px]">
          <div className="grow" style={{ minWidth: 260 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-[family-name:var(--head)] font-extrabold opacity-85">{project.jobNumber}</span>
              {typeLabel ? (
                <span className="tag" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                  {typeLabel.toUpperCase()}
                </span>
              ) : null}
              <span className="pill dot" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                {workStatusLabel(status)}
              </span>
            </div>
            <div className="big" style={{ marginTop: 6 }}>
              {project.siteName}
            </div>
            <div style={{ opacity: 0.85, marginTop: 4 }}>
              {project.client?.name || 'No client'} · {managers}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {canEdit ? (
              <Link href={`${basePath}/edit`} className="btn sm hbtn">
                <PencilSquareIcon className="h-4 w-4" />
                Edit
              </Link>
            ) : null}
            {showBook ? (
              <Link href={`${basePath}/schedule/operatives`} className="btn sm hbtn solid">
                <PlusIcon className="h-4 w-4" />
                Book labour
              </Link>
            ) : null}
          </div>
        </div>
        <div className="relative z-[1]" style={{ marginTop: 20 }}>
          <div className="row small" style={{ opacity: 0.9, marginBottom: 8 }}>
            <b>{progress}% complete</b>
            <span className="grow" />
            {remaining} · {format(new Date(project.startDate), 'd MMM yyyy')} – {format(new Date(project.endDate), 'd MMM yyyy')}
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
            <i
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: 'linear-gradient(90deg,#fff,#BFD8FF)',
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      </section>

      {!hideTabs ? (
        <nav className="ptabs" aria-label="Project sections">
          {tabs.map((tab) => {
            const meta = TAB_META[tab.key] || TAB_META.overview
            const Icon = meta.icon
            const on = tab.key === active
            return (
              <Link
                key={tab.key}
                href={tab.href ? `${basePath}/${tab.href}` : basePath}
                data-hue={meta.hue}
                className={cn(on && 'on')}
              >
                <span className="ico-chip">
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                {tab.label}
                {tab.badge ? <span className="count">{tab.badge}</span> : null}
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
  const address = formatSiteAddress(project)
  const rows: { hue: SectionHue; label: string; value: string; warn?: boolean }[] = [
    { hue: 'blue', label: 'Client', value: project.client?.name || '—' },
    { hue: 'user', label: 'Manager', value: project.manager?.name || '—' },
    {
      hue: 'sched',
      label: 'Timeline',
      value: `${format(new Date(project.startDate), 'd MMM yyyy')} – ${format(new Date(project.endDate), 'd MMM yyyy')}`,
    },
    {
      hue: 'proj',
      label: 'Address',
      value: address || 'No address yet. Add one so the team can find site.',
      warn: !address,
    },
    { hue: 'lib', label: 'Description', value: project.description || 'No description added' },
  ]

  return (
    <section className="card">
      <div className="card-h">
        <h2 className="h2">Details</h2>
        {canEdit ? (
          <div className="acts">
            <Link href={`${basePath}/edit`} className="btn sm ghost">
              Edit
            </Link>
          </div>
        ) : null}
      </div>
      <div className="card-b space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="row" data-hue={row.hue} style={{ padding: '4px 0' }}>
            <span className="ico-chip sm" />
            <div className="grow">
              <div className="eyebrow">{row.label}</div>
              <div className="font-semibold" style={row.warn ? { color: 'var(--warn)' } : undefined}>
                {row.value}
              </div>
            </div>
          </div>
        ))}
        {project.notes ? (
          <div>
            <div className="eyebrow">Notes</div>
            <div className="font-semibold">{project.notes}</div>
          </div>
        ) : null}
        {canEdit ? (
          <Link href={`${basePath}/edit`} className="btn primary block">
            Edit project details
          </Link>
        ) : null}
      </div>
    </section>
  )
}

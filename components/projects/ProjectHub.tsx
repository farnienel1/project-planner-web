'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  daysLeftCaption,
  deriveWorkStatus,
  timelineProgressPercent,
  workStatusLabel,
} from '@/lib/projects/workStatus'
import { useAuthStore } from '@/lib/stores/authStore'
import type { Project, User } from '@/types'

function canConfigureProjectVisibility(user: User | null, isSmallWork: boolean): boolean {
  if (!user || user.permissions.operativeMode) return false
  if (user.isSuperAdmin || user.permissions.adminAccess) return true
  if (!user.permissions.manager) return false
  return isSmallWork ? user.permissions.smallWorks !== false : user.permissions.projects !== false
}

// ── Tile icon paths ────────────────────────────────────────────────────────────
const TILE_ICONS: Record<string, { path: string; bg: string; iconColor: string }> = {
  schedule:      { path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
  view:          { path: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-9a9 9 0 110 18A9 9 0 0112 3z', bg: 'bg-violet-50', iconColor: 'text-violet-600' },
  tasks:         { path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', bg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  materials:     { path: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
  'health-safety': { path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  'site-audit':  { path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', bg: 'bg-red-50', iconColor: 'text-red-600' },
  location:      { path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', bg: 'bg-teal-50', iconColor: 'text-teal-600' },
}

function TileIcon({ tileKey }: { tileKey: string }) {
  const cfg = TILE_ICONS[tileKey] || TILE_ICONS.tasks
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cfg.bg}`}>
      <svg className={`h-6 w-6 ${cfg.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.path} />
      </svg>
    </div>
  )
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full rounded-full bg-white/20">
        <div
          className="h-1.5 rounded-full bg-white transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  )
}

function computeProgress(project: Project): number {
  const status = deriveWorkStatus(project)
  return timelineProgressPercent(project.startDate, project.endDate, status)
}

function daysLeft(project: Project): string {
  return daysLeftCaption(project.endDate, deriveWorkStatus(project))
}

export function ProjectHub({
  project,
  basePath,
  taskCount,
}: {
  project: Project
  basePath: string
  taskCount?: number
}) {
  const { user } = useAuthStore()
  const status = deriveWorkStatus(project)
  const progress = computeProgress(project)
  const remaining = daysLeft(project)
  const isSmallWork = basePath.includes('small-works')
  const showViewTile = canConfigureProjectVisibility(user, isSmallWork)
  const heroGradient = isSmallWork
    ? 'bg-gradient-to-br from-amber-500 to-orange-600'
    : 'bg-gradient-to-br from-blue-600 to-blue-800'
  const heroSubtext = isSmallWork ? 'text-amber-100' : 'text-blue-200'

  const tiles = [
    { href: 'schedule',       label: 'Scheduling',  desc: 'Bookings and operative schedule' },
    ...(showViewTile
      ? [{ href: 'view', label: 'View', desc: 'Control who can see this project' }]
      : []),
    { href: 'tasks',          label: 'My Tasks',     desc: 'Tasks and assignments', badge: taskCount },
    { href: 'materials',      label: 'Materials',    desc: 'Materials list and send to wholesaler' },
    { href: 'health-safety',  label: 'H&S',          desc: 'Toolbox talks, RAMS, documents' },
    { href: 'site-audit',     label: 'Site Audit',   desc: 'Audits for this project' },
    { href: 'location',       label: 'Location',     desc: project.addressLine1 || 'View on map' },
  ]

  return (
    <div className="space-y-4">
      {/* ── Hero header ── */}
      <div className={`relative overflow-hidden rounded-2xl ${heroGradient} px-6 pt-6 pb-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold tracking-wide">
                {project.jobNumber}
              </span>
              {project.jobType && (
                <span className={`rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium ${heroSubtext}`}>
                  {project.jobType}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-tight truncate">{project.siteName}</h1>
            <p className={`mt-1 text-sm truncate ${heroSubtext}`}>
              {project.client?.name}
              {project.addressLine1 && ` · ${project.addressLine1}`}
            </p>
          </div>
          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            status === 'active' ? 'bg-emerald-400/25 text-emerald-100' :
            status === 'completed' ? `bg-white/15 ${heroSubtext}` :
            status === 'upcoming' ? 'bg-amber-400/25 text-amber-100' :
            `bg-white/15 ${heroSubtext}`
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              status === 'active' ? 'bg-emerald-300' :
              status === 'upcoming' ? 'bg-amber-300' :
              'bg-slate-300'
            }`} />
            {workStatusLabel(status)}
          </span>
        </div>

        {/* Progress */}
        <ProgressBar percent={progress} />
        <div className="mt-1.5 flex items-center justify-between">
          <span className={`text-xs ${heroSubtext}`}>{progress}% complete</span>
          <span className={`text-xs ${heroSubtext}`}>{remaining} days left</span>
        </div>
      </div>

      {/* ── Manage tiles ── */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Manage</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={`${basePath}/${tile.href}`}
              className="relative flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-95"
            >
              {tile.badge !== undefined && tile.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow">
                  {tile.badge}
                </span>
              )}
              <TileIcon tileKey={tile.href} />
              <span className="text-xs font-semibold text-slate-800 leading-tight">{tile.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Details section ── */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Details</p>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
          {/* Client */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 flex-shrink-0">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Client</p>
              <p className="text-sm font-semibold text-slate-900">{project.client?.name || '—'}</p>
            </div>
          </div>

          {/* Manager */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Manager</p>
              <p className="text-sm font-semibold text-slate-900">{project.manager?.name || '—'}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Timeline</p>
              <p className="text-sm font-semibold text-slate-900">
                {format(new Date(project.startDate), 'd MMM yy')} – {format(new Date(project.endDate), 'd MMM yy')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 flex-shrink-0 mt-0.5">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Description</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {project.description || project.notes || 'No description added'}
              </p>
            </div>
          </div>

          {/* Address */}
          {project.addressLine1 && (
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 flex-shrink-0 mt-0.5">
                <svg className="h-4 w-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Address</p>
                <p className="text-sm text-slate-700">
                  {[project.addressLine1, project.addressLine2, project.townCity, project.postcode]
                    .filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

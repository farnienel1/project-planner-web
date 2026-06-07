'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { deriveWorkStatus } from '@/lib/projects/workStatus'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import { ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import {
  buildSiteAuditPdfContextFromProject,
  openSiteAuditPdf,
} from '@/lib/siteAudit/siteAuditPdf'
import type { Project, SiteAudit } from '@/types'

const AUDIT_TYPES = ['All', 'Pre-Start', 'General', 'Variations', 'Snags', 'Other'] as const
type AuditTypeFilter = (typeof AUDIT_TYPES)[number]

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'Pre-Start': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  General: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  Variations: {
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  Snags: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  Other: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.Other
}

function normaliseType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('pre') || lower.includes('start')) return 'Pre-Start'
  if (lower.includes('snag')) return 'Snags'
  if (lower.includes('variation')) return 'Variations'
  if (lower.includes('general')) return 'General'
  return 'Other'
}

function TypeBadge({ type }: { type: string }) {
  const norm = normaliseType(type)
  const cfg = getTypeConfig(norm)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {type}
    </span>
  )
}

function TypeIcon({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) {
  const norm = normaliseType(type)
  const cfg = getTypeConfig(norm)
  const sz = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <div
      className={`flex ${sz} flex-shrink-0 items-center justify-center rounded-xl ${cfg.bg} border ${cfg.border}`}
    >
      <svg className={`h-5 w-5 ${cfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.icon} />
      </svg>
    </div>
  )
}

function AuditDetail({ audit, onClose }: { audit: SiteAudit; onClose: () => void }) {
  const [imgExpanded, setImgExpanded] = useState<string | null>(null)
  const { organization } = useAuthStore()
  const { projects, smallWorks } = useProjectStore()

  const project =
    projects.find((entry) => entry.id === audit.projectId) ??
    smallWorks.find((entry) => entry.id === audit.projectId) ??
    null

  const pdfContext = buildSiteAuditPdfContextFromProject(audit, project, organization)

  const handlePdf = () => openSiteAuditPdf(audit, pdfContext)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-slate-50 sm:rounded-3xl sm:shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Done
          </button>
          <h2 className="text-base font-bold text-slate-900">Audit detail</h2>
          <div className="w-16" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <TypeIcon type={audit.type} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{audit.customTitle || audit.type}</p>
                <TypeBadge type={audit.type} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {audit.projectJobNumber} {audit.projectName}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-slate-400">{audit.authorName}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  {audit.items.length} items
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePdf}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              Share / Download
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              Preview PDF
            </button>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Summary</p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {[
                { label: 'Author', value: audit.authorName },
                { label: 'Date', value: format(audit.date, 'd MMM yyyy') },
                { label: 'Project', value: audit.projectName },
                { label: 'Visible to operatives', value: audit.visibleToOperatives ? 'Yes' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Items · {audit.items.length}
            </p>
            <div className="space-y-3">
              {audit.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="px-4 pb-2 pt-3">
                    <p className="text-sm font-bold text-slate-900">
                      {idx + 1}. {item.title}
                    </p>
                    {item.location && <p className="mt-0.5 text-xs text-slate-500">{item.location}</p>}
                    {item.assignee && <p className="text-xs text-slate-500">{item.assignee}</p>}
                    {item.comments && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.comments}</p>
                    )}
                  </div>
                  {item.imageURL && (
                    <div>
                      <img
                        src={item.imageURL}
                        alt={`Item ${idx + 1}`}
                        className="w-full cursor-pointer object-cover"
                        style={{ maxHeight: imgExpanded === item.id ? 'none' : '200px' }}
                        onClick={() => setImgExpanded(imgExpanded === item.id ? null : item.id)}
                      />
                      <p className="px-4 py-2 text-[11px] text-slate-400">
                        {imgExpanded === item.id ? 'Tap to collapse' : 'Tap to expand'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {imgExpanded && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImgExpanded(null)}
          role="presentation"
        >
          {audit.items.find((i) => i.id === imgExpanded)?.imageURL && (
            <img
              src={audit.items.find((i) => i.id === imgExpanded)!.imageURL!}
              alt="Expanded"
              className="max-h-full max-w-full rounded-xl"
            />
          )}
        </div>
      )}
    </div>
  )
}

function ProjectAuditsView({
  projectId,
  projectJobNumber,
  projectName,
  audits,
  onBack,
}: {
  projectId: string
  projectJobNumber: string
  projectName: string
  audits: SiteAudit[]
  onBack: () => void
}) {
  const [typeFilter, setTypeFilter] = useState<AuditTypeFilter>('All')
  const [selectedAudit, setSelectedAudit] = useState<SiteAudit | null>(null)

  const projectAudits = useMemo(
    () => audits.filter((a) => a.projectId === projectId),
    [audits, projectId]
  )

  const filtered = useMemo(() => {
    if (typeFilter === 'All') return projectAudits
    return projectAudits.filter((a) => normaliseType(a.type) === typeFilter)
  }, [projectAudits, typeFilter])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: projectAudits.length }
    for (const t of AUDIT_TYPES.filter((t) => t !== 'All')) {
      counts[t] = projectAudits.filter((a) => normaliseType(a.type) === t).length
    }
    return counts
  }, [projectAudits])

  const photoCount = projectAudits.reduce(
    (sum, a) => sum + a.items.filter((i) => i.imageURL).length,
    0
  )
  const lastSubmitted = projectAudits[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
          aria-label="Back"
        >
          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="text-xs font-bold text-blue-600">{projectJobNumber}</p>
          <h2 className="text-base font-bold leading-tight text-slate-900">Site audits</h2>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-5 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">This project</p>
        <p className="mt-1 text-2xl font-bold">
          {projectAudits.length} audit{projectAudits.length !== 1 ? 's' : ''}
          <span className="ml-2 text-lg font-normal text-blue-200">
            · {photoCount} photo{photoCount !== 1 ? 's' : ''}
          </span>
        </p>
        {lastSubmitted && (
          <p className="mt-1 text-xs text-blue-200">
            Last submitted {formatDistanceToNow(lastSubmitted.date, { addSuffix: true })} by{' '}
            {lastSubmitted.authorName}
          </p>
        )}
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {AUDIT_TYPES.map((type) => {
          const count = typeCounts[type] || 0
          const active = typeFilter === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {type} · {count}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
          <p className="text-sm font-bold text-slate-700">No site audits</p>
          <p className="mt-1 text-xs text-slate-400">Create your first audit for this project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((audit) => (
            <button
              key={audit.id}
              type="button"
              onClick={() => setSelectedAudit(audit)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <TypeIcon type={audit.type} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {audit.customTitle || audit.type}
                    </p>
                    <TypeBadge type={audit.type} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {audit.projectJobNumber} {audit.projectName}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{audit.authorName}</span>
                    <span className="text-[11px] text-slate-400">
                      {audit.items.length} item{audit.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <svg
                  className="h-4 w-4 flex-shrink-0 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedAudit && (
        <AuditDetail audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
      )}
    </div>
  )
}

type ProjectFilter = 'All' | 'Active' | 'Upcoming' | 'Completed'

function ProjectListView({
  title,
  projects,
  audits,
  onBack,
  onSelectProject,
}: {
  title: string
  projects: Project[]
  audits: SiteAudit[]
  onBack: () => void
  onSelectProject: (p: Project) => void
}) {
  const [filter, setFilter] = useState<ProjectFilter>('All')

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filter === 'All') return true
      const status = deriveWorkStatus(p)
      if (filter === 'Active') return status === 'active'
      if (filter === 'Upcoming') return status === 'upcoming'
      if (filter === 'Completed') return status === 'completed' || status === 'inactive'
      return true
    })
  }, [projects, filter])

  const auditCountForProject = (id: string) => audits.filter((a) => a.projectId === id).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
          aria-label="Back"
        >
          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>

      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {(['All', 'Active', 'Upcoming', 'Completed'] as ProjectFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-400">No projects found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => {
            const auditCount = auditCountForProject(project.id)
            const status = deriveWorkStatus(project)
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {project.jobNumber}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          status === 'active'
                            ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Completed'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{project.siteName}</p>
                    {project.client?.name && (
                      <p className="truncate text-xs text-slate-500">{project.client.name}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {auditCount > 0 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        {auditCount} audit{auditCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type View =
  | { type: 'hub' }
  | { type: 'projects' }
  | { type: 'small-works' }
  | { type: 'project-audits'; projectId: string; projectJobNumber: string; projectName: string; from: 'projects' | 'small-works' }

export function SiteAuditScreen() {
  const { organization } = useAuthStore()
  const { audits, loading, error, loadAudits } = useSiteAuditStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const [view, setView] = useState<View>({ type: 'hub' })

  useEffect(() => {
    if (!organization?.id) return
    loadAudits(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization, loadAudits, loadProjects, loadSmallWorks])

  if (loading) return <LoadingSpinner />

  const shell = (content: ReactNode) => (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      {error && <ErrorBanner message={error} />}
      {content}
    </div>
  )

  if (view.type === 'hub') {
    const totalAudits = audits.length
    const totalPhotos = audits.reduce((sum, a) => sum + a.items.filter((i) => i.imageURL).length, 0)

    return shell(
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site audit</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Capture site evidence, notes, and produce a shareable PDF.
          </p>
        </div>

        {totalAudits > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{totalAudits}</p>
              <p className="mt-0.5 text-xs text-slate-500">Total audits</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-700">{totalPhotos}</p>
              <p className="mt-0.5 text-xs text-slate-500">Photos captured</p>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Link
            href="/dashboard/site-audit/new"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">New site audit</p>
              <p className="text-xs text-slate-500">Start a new walkthrough</p>
            </div>
            <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={() => setView({ type: 'projects' })}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">Projects</p>
              <p className="text-xs text-slate-500">Browse audits by project</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{projects.length}</span>
              <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setView({ type: 'small-works' })}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">Small works</p>
              <p className="text-xs text-slate-500">Browse audits by small works job</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{smallWorks.length}</span>
              <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    )
  }

  if (view.type === 'projects') {
    return shell(
      <ProjectListView
        title="Projects"
        projects={projects}
        audits={audits}
        onBack={() => setView({ type: 'hub' })}
        onSelectProject={(p) =>
          setView({
            type: 'project-audits',
            projectId: p.id,
            projectJobNumber: p.jobNumber,
            projectName: p.siteName,
            from: 'projects',
          })
        }
      />
    )
  }

  if (view.type === 'small-works') {
    return shell(
      <ProjectListView
        title="Small works"
        projects={smallWorks}
        audits={audits}
        onBack={() => setView({ type: 'hub' })}
        onSelectProject={(p) =>
          setView({
            type: 'project-audits',
            projectId: p.id,
            projectJobNumber: p.jobNumber,
            projectName: p.siteName,
            from: 'small-works',
          })
        }
      />
    )
  }

  if (view.type === 'project-audits') {
    return shell(
      <ProjectAuditsView
        projectId={view.projectId}
        projectJobNumber={view.projectJobNumber}
        projectName={view.projectName}
        audits={audits}
        onBack={() => setView({ type: view.from })}
      />
    )
  }

  return null
}

export function SiteAuditNewScreen() {
  const { organization } = useAuthStore()
  const { loadProjects, loadSmallWorks, projects, smallWorks } = useProjectStore()
  const { loadAudits } = useSiteAuditStore()
  const [source, setSource] = useState<'projects' | 'small-works'>('projects')
  const [createProject, setCreateProject] = useState<Project | null>(null)

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization, loadProjects, loadSmallWorks])

  const list = source === 'projects' ? projects : smallWorks

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/site-audit"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
          aria-label="Back"
        >
          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">New site audit</h1>
          <p className="text-sm text-slate-500">Choose a project to attach this audit to</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {(['projects', 'small-works'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSource(key)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-all ${
              source === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {key === 'small-works' ? 'Small works' : 'Projects'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No jobs available</p>
        ) : (
          list.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setCreateProject(project)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm hover:border-slate-300 hover:shadow-md"
            >
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                {project.jobNumber}
              </span>
              <p className="mt-1 text-sm font-bold text-slate-900">{project.siteName}</p>
            </button>
          ))
        )}
      </div>

      {createProject && organization?.id && (
        <SiteAuditCreateFlow
          project={createProject}
          onClose={() => setCreateProject(null)}
          onCreated={() => {
            loadAudits(organization.id)
            setCreateProject(null)
          }}
        />
      )}
    </div>
  )
}

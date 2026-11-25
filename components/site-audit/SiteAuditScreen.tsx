'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { deriveWorkStatus } from '@/lib/projects/workStatus'
import { jobWorkStatus, normalizeDocumentId, worksInTab, worksListMembership, worksTab, type WorksTab } from '@/lib/canonical'
import { useOrganizationTimeZone } from '@/lib/stores/organizationDocumentStore'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import { UnsentSiteAudits } from '@/components/site-audit/UnsentSiteAudits'
import { SiteAuditSteps } from '@/components/site-audit/SiteAuditSteps'
import { Chip, PageBand, PageShell, SegmentedTabs } from '@/components/ui/page'
import {
  SITE_AUDIT_JOB_DEFAULT_TAB,
  SITE_AUDIT_JOB_TABS,
  SITE_AUDIT_JOBS_FAILED_MESSAGE,
  SITE_AUDIT_LEAVE_CONFIRM_MESSAGE,
  siteAuditAuthoredJobIds,
  siteAuditBrowseJobs,
  siteAuditJobChoice,
  siteAuditsVisibleToViewer,
  type SiteAuditJobChoice,
  siteAuditJobTabCounts,
  siteAuditJobsInTab,
} from '@/lib/siteAudit/siteAuditCreateDraft'
import { useSiteAuditJobContext } from '@/components/site-audit/useSiteAuditJobContext'
import { ErrorBanner, LoadingSpinner } from '@/components/dashboard/PageShell'
import {
  buildSiteAuditPdfContextFromProject,
  openSiteAuditPdf,
} from '@/lib/siteAudit/siteAuditPdf'
import type { Project, SiteAudit } from '@/types'
import { ReportFileLink } from '@/components/fileReports/ReportFileLink'
import { PersonalSiteAuditsView, usePersonalSiteAudits } from '@/components/site-audit/PersonalSiteAudits'
import { PERSONAL_SITE_AUDIT_SECTION_LABEL } from '@/lib/canonical'

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
      className={`flex ${sz} shrink-0 items-center justify-center rounded-xl ${cfg.bg} border ${cfg.border}`}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-slate-50 sm:rounded-3xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            Done
          </button>
          <h2 className="text-base font-bold text-slate-900">Audit detail</h2>
          <div className="w-16" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-start gap-3 card pad">
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
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-95"
            >
              Share / Download
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="flex items-center justify-center gap-2 card py-3 text-sm font-bold text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-95"
            >
              Preview PDF
            </button>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Summary</p>
            <div className="divide-y divide-slate-100 overflow-hidden card shadow-xs">
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
                  className="overflow-hidden card shadow-xs"
                >
                  <div className="px-4 pb-2 pt-3">
                    <p className="text-sm font-bold text-slate-900">
                      {idx + 1}. {item.title}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      Taken {format(item.createdAt, 'd MMM yyyy, HH:mm')}
                    </p>
                    {item.location && <p className="mt-0.5 text-xs text-slate-500">{item.location}</p>}
                    {item.assignee && <p className="text-xs text-slate-500">{item.assignee}</p>}
                    {item.comments && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.comments}</p>
                    )}
                    {item.annotations ? <p className="mt-1 text-xs text-slate-500">{item.annotations}</p> : null}
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
                      <div className="flex items-center justify-between gap-3 px-4 py-2">
                        <p className="text-[11px] text-slate-400">
                          {imgExpanded === item.id ? 'Click to collapse' : 'Click to expand'}
                        </p>
                        <ReportFileLink fileRef={item.imageURL} surface="site_audit" parentId={audit.id} />
                      </div>
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
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImgExpanded(null)}
          role="presentation"
        >
          {audit.items.find((i) => i.id === imgExpanded)?.imageURL && (
            <div className="flex max-h-full max-w-full flex-col items-center gap-3">
              <img
                src={audit.items.find((i) => i.id === imgExpanded)!.imageURL!}
                alt="Expanded"
                className="max-h-[85vh] max-w-full rounded-xl"
              />
              <ReportFileLink
                fileRef={audit.items.find((i) => i.id === imgExpanded)!.imageURL}
                surface="site_audit"
                parentId={audit.id}
                className="text-xs font-medium text-white/80 underline-offset-2 hover:text-white hover:underline"
              />
            </div>
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
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs hover:bg-slate-50"
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

      <div className="rounded-2xl bg-linear-to-br/srgb from-blue-600 to-blue-800 px-5 py-5 text-white shadow-lg">
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
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
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
        <div className="empty py-14 text-center">
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
              className="w-full card px-4 py-3.5 text-left shadow-xs transition-shadow hover:shadow-md!"
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
                  className="h-4 w-4 shrink-0 text-slate-300"
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
  choice,
  onRetry,
  audits,
  onBack,
  onSelectProject,
}: {
  title: string
  /** The jobs this person may browse (`siteAuditBrowseJobs`), with loading / failed (owner decision 23 Nov). */
  choice: SiteAuditJobChoice<Project>
  onRetry: () => void
  audits: SiteAudit[]
  onBack: () => void
  onSelectProject: (p: Project) => void
}) {
  const projects = choice.jobs
  const [filter, setFilter] = useState<ProjectFilter>('Active')

  // Rulebook 1.21.0 (`worksInTab`): the shared tabs on the organisation's day; inactive jobs are under Completed.
  const timeZone = useOrganizationTimeZone()
  const filtered = useMemo(() => {
    const tab = filter === 'All' ? 'all' : filter === 'Active' ? 'active' : filter === 'Upcoming' ? 'upcoming' : 'completed'
    return worksInTab(projects, tab, Date.now(), timeZone)
  }, [projects, filter, timeZone])

  const auditCountForProject = (id: string) => audits.filter((a) => a.projectId === id).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-xs hover:bg-slate-50"
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
              filter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {choice.state === 'loading' ? (
        <div className="empty py-12 text-center">
          <p className="text-sm text-slate-400">Loading jobs…</p>
        </div>
      ) : choice.state === 'failed' ? (
        <div className="empty py-12 text-center">
          <p className="text-sm text-(--red)">{SITE_AUDIT_JOBS_FAILED_MESSAGE}</p>
          <button type="button" onClick={onRetry} className="pu-btn sm mt-3">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty py-12 text-center">
          <p className="text-sm text-slate-400">No projects found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => {
            const auditCount = auditCountForProject(project.id)
            const status = deriveWorkStatus(project, new Date(), timeZone)
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project)}
                className="w-full card px-4 py-3.5 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-md!"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
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
                  <div className="flex shrink-0 items-center gap-2">
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
  | { type: 'personal' }
  | { type: 'project-audits'; projectId: string; projectJobNumber: string; projectName: string; from: 'projects' | 'small-works' }

export function SiteAuditScreen() {
  const { organization, user } = useAuthStore()
  const { audits: storedAudits, loading, error, loadAudits } = useSiteAuditStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const projectsLoadedOrgId = useProjectStore((state) => state.projectsLoadedOrgId)
  const smallWorksLoadedOrgId = useProjectStore((state) => state.smallWorksLoadedOrgId)
  // Owner decision 23 Nov: the browse lists show only the jobs the person sees (rulebook §21 `visibleJobs`; every job
  // for admins and managers) plus, for an operative, the jobs holding an audit they wrote; an operative sees the audits
  // marked visible to operatives and their own (as the job's Site audits page and iOS).
  const jobContext = useSiteAuditJobContext()
  const operativeMode = isOperativeMode(user)
  const viewerIds = jobContext.viewer?.ids
  const audits = useMemo(
    () => siteAuditsVisibleToViewer(storedAudits, { operativeMode, viewerIds: viewerIds ?? [] }),
    [storedAudits, operativeMode, viewerIds]
  )
  const authoredJobIds = useMemo(() => siteAuditAuthoredJobIds(storedAudits, viewerIds ?? []), [storedAudits, viewerIds])
  const browseChoice = (jobs: Project[], loadedOrgId: string | null | undefined): SiteAuditJobChoice<Project> => {
    const choice = siteAuditBrowseJobs({
      jobs,
      viewer: jobContext.viewer,
      context: jobContext.context,
      contextLoaded: jobContext.contextLoaded,
      contextFailed: jobContext.contextFailed,
      authoredJobIds,
    })
    const catalogueLoaded = Boolean(organization?.id && loadedOrgId === organization.id)
    return !catalogueLoaded && choice.state === 'ready' && jobs.length === 0 ? { state: 'loading', jobs: [] } : choice
  }
  const projectChoice = browseChoice(worksListMembership(projects, 'projects'), projectsLoadedOrgId)
  const smallWorksChoice = browseChoice(worksListMembership(smallWorks, 'smallWorks'), smallWorksLoadedOrgId)
  const choiceCount = (choice: SiteAuditJobChoice<Project>) =>
    choice.state === 'ready' ? choice.jobs.length : choice.state === 'loading' ? '…' : null
  // An operative's hub totals count only the audits on the jobs they can browse (both lists ready); everyone else all.
  const browsableJobKeys =
    projectChoice.state === 'ready' && smallWorksChoice.state === 'ready'
      ? new Set([...projectChoice.jobs, ...smallWorksChoice.jobs].map((job) => normalizeDocumentId(job.id)))
      : null
  const hubAudits = !operativeMode
    ? audits
    : browsableJobKeys
      ? audits.filter((audit) => browsableJobKeys.has(normalizeDocumentId(audit.projectId)))
      : []
  const [view, setView] = useState<View>({ type: 'hub' })
  // Rulebook 1.30.0 §26: the signed-in person's own personal audits (owner only).
  const personal = usePersonalSiteAudits()
  // Back from the Create Personal Site Audit page (`?view=personal`): open the Personal list.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'personal') setView({ type: 'personal' })
  }, [])

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
    const totalAudits = hubAudits.length
    const totalPhotos = hubAudits.reduce((sum, a) => sum + a.items.filter((i) => i.imageURL).length, 0)

    return shell(
      <div className="space-y-5">
        <div className="phead" data-hue="hs">
          <h1>Site audit</h1>
          <p className="sub">
            Pre-starts, snags and variations across every job.
          </p>
        </div>

        {totalAudits > 0 && (
          <div className="grid g2">
            <div className="stat" data-hue="hs">
              <div>
                <b>{totalAudits}</b>
                <span>Total audits</span>
              </div>
            </div>
            <div className="stat" data-hue="lib">
              <div>
                <b>{totalPhotos}</b>
                <span>Photos captured</span>
              </div>
            </div>
          </div>
        )}

        <div className="rows">
          <Link href="/dashboard/site-audit/new" className="ritem" data-hue="hs">
            <span className="ico-chip">+</span>
            <span className="grow">
              <span className="t">New site audit</span>
              <span className="s">Start a new walkthrough</span>
            </span>
          </Link>

          <button type="button" onClick={() => setView({ type: 'projects' })} className="ritem" data-hue="proj">
            <span className="ico-chip">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </span>
            <span className="grow">
              <span className="t">Projects</span>
              <span className="s">Browse audits by project</span>
            </span>
            {choiceCount(projectChoice) !== null && <span className="count soft">{choiceCount(projectChoice)}</span>}
          </button>

          <button type="button" onClick={() => setView({ type: 'small-works' })} className="ritem" data-hue="sw">
            <span className="ico-chip">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <span className="grow">
              <span className="t">Small works</span>
              <span className="s">Browse audits by small works job</span>
            </span>
            {choiceCount(smallWorksChoice) !== null && <span className="count soft">{choiceCount(smallWorksChoice)}</span>}
          </button>

          <button type="button" onClick={() => setView({ type: 'personal' })} className="ritem" data-hue="hs">
            <span className="ico-chip">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <span className="grow">
              <span className="t">{PERSONAL_SITE_AUDIT_SECTION_LABEL}</span>
              <span className="s">Your own audits, not linked to a job — only you can see them</span>
            </span>
            <span className="count soft">{personal.audits.length}</span>
          </button>
        </div>
        <div className="mt-4">
          <UnsentSiteAudits />
        </div>
      </div>
    )
  }

  if (view.type === 'projects') {
    return shell(
      <ProjectListView
        title="Projects"
        choice={projectChoice}
        onRetry={jobContext.retry}
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
        choice={smallWorksChoice}
        onRetry={jobContext.retry}
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

  if (view.type === 'personal') {
    return shell(<PersonalSiteAuditsView onBack={() => setView({ type: 'hub' })} />)
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

const SITE_AUDIT_JOB_TAB_LABELS = { active: 'Active', upcoming: 'Upcoming', completed: 'Completed' } as const

/**
 * New site audit as its own page (owner request 23 Nov), step by step: 1 Job (projects or small works under All /
 * Active / Upcoming / Completed, default Active — `worksInTab` / `worksTabCounts` on the organisation day), then the
 * create flow's Details, Photos and Review & save. Cancel and a saved audit return to Site audit.
 */
export function SiteAuditNewScreen() {
  const router = useRouter()
  const { organization, user } = useAuthStore()
  const { loadProjects, loadSmallWorks, projects, smallWorks } = useProjectStore()
  const projectsLoadedOrgId = useProjectStore((state) => state.projectsLoadedOrgId)
  const smallWorksLoadedOrgId = useProjectStore((state) => state.smallWorksLoadedOrgId)
  const { loadAudits } = useSiteAuditStore()
  // Owner decision 23 Nov: only the jobs the person sees (rulebook §21 `visibleJobs`) — an operative's own jobs.
  const jobContext = useSiteAuditJobContext()
  const timeZone = useOrganizationTimeZone()
  const [source, setSource] = useState<'projects' | 'small-works'>('projects')
  const [tab, setTab] = useState<WorksTab>(SITE_AUDIT_JOB_DEFAULT_TAB)
  const [createProject, setCreateProject] = useState<Project | null>(null)
  const [nowMs] = useState(() => Date.now())
  // Same test as a job's New audit buttons (`ProjectSiteAuditSection`); the route is inside `SiteAuditAccess`.
  const canCreate = !isOperativeMode(user) || user?.permissions.siteAudit === true
  const [unsaved, setUnsaved] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization, loadProjects, loadSmallWorks])

  // Rulebook 1.21.0 (`worksListMembership`): every document of the catalogue, live or not.
  const catalogue = source === 'projects' ? worksListMembership(projects, 'projects') : worksListMembership(smallWorks, 'smallWorks')
  const catalogueLoaded = Boolean(
    organization?.id && (source === 'projects' ? projectsLoadedOrgId : smallWorksLoadedOrgId) === organization.id
  )
  const choice = useMemo(
    () =>
      siteAuditJobChoice({
        jobs: catalogue,
        viewer: jobContext.viewer,
        context: jobContext.context,
        contextLoaded: jobContext.contextLoaded,
        contextFailed: jobContext.contextFailed,
      }),
    [catalogue, jobContext.viewer, jobContext.context, jobContext.contextLoaded, jobContext.contextFailed]
  )
  const list = choice.jobs
  const jobsState = !catalogueLoaded && choice.state === 'ready' && catalogue.length === 0 ? 'loading' : choice.state
  const counts = useMemo(() => siteAuditJobTabCounts(list, nowMs, timeZone), [list, nowMs, timeZone])
  const shown = useMemo(() => siteAuditJobsInTab(list, tab, nowMs, timeZone), [list, tab, nowMs, timeZone])
  const leave = () => router.push('/dashboard/site-audit')
  const backToHub = () => {
    if (unsaved && !window.confirm(SITE_AUDIT_LEAVE_CONFIRM_MESSAGE)) return
    leave()
  }

  return (
    <PageShell>
      <PageBand
        eyebrow="Site audit"
        title="New site audit"
        subtitle={createProject ? undefined : 'Choose a project to attach this audit to'}
        back={{ label: 'Site audit', onClick: backToHub }}
      />
      {!canCreate ? (
        <p className="py-8 text-center text-sm text-(--ink3)">You can&apos;t create site audits.</p>
      ) : createProject && organization?.id ? (
        <SiteAuditCreateFlow
          project={createProject}
          onClose={leave}
          onChangeJob={() => setCreateProject(null)}
          onUnsavedChange={setUnsaved}
          onCreated={() => {
            loadAudits(organization.id)
          }}
        />
      ) : (
        <div className="space-y-4">
          <SiteAuditSteps current={1} />
          <div className="flex flex-wrap gap-2">
            <SegmentedTabs
              ariaLabel="Job type"
              value={source}
              onChange={setSource}
              items={[
                { id: 'projects', label: 'Projects' },
                { id: 'small-works', label: 'Small works' },
              ]}
            />
            <SegmentedTabs
              ariaLabel="Filter jobs"
              value={tab}
              onChange={setTab}
              items={SITE_AUDIT_JOB_TABS.map((option) => ({ id: option.tab, label: option.label, count: counts[option.tab] }))}
            />
          </div>
          <div className="space-y-2">
            {jobsState === 'loading' ? (
              <p className="py-8 text-center text-sm text-(--ink3)">Loading jobs…</p>
            ) : jobsState === 'failed' ? (
              <div className="py-8 text-center">
                <p className="text-sm text-(--red)">{SITE_AUDIT_JOBS_FAILED_MESSAGE}</p>
                <button type="button" onClick={jobContext.retry} className="pu-btn sm mt-3">
                  Retry
                </button>
              </div>
            ) : shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-(--ink3)">No jobs available</p>
            ) : (
              shown.map((project) => {
                const jobTab = worksTab(jobWorkStatus(project, nowMs, timeZone))
                return (
                  <button key={project.id} type="button" onClick={() => setCreateProject(project)} className="sa-job-row">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {project.jobNumber ? <Chip tone="blue">{project.jobNumber}</Chip> : null}
                        <Chip tone={jobTab === 'active' ? 'green' : 'slate'}>{SITE_AUDIT_JOB_TAB_LABELS[jobTab]}</Chip>
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold">{project.siteName}</span>
                    </span>
                    <span aria-hidden="true" className="text-(--ink3)">
                      ›
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'
import { EmptyState, LoadingSpinner } from '@/components/dashboard/PageShell'
import { SiteAuditCreateFlow } from '@/components/projects/siteAudit/SiteAuditCreateFlow'
import type { Project, SiteAudit } from '@/types'
import {
  FeatureCard,
  FeatureScreen,
  FilterChipsRow,
  SITE_AUDIT_TYPES,
  SiteAuditTypeFilter,
  StatusPill,
  siteAuditTypeTone,
} from '@/components/projects/features/featureUi'

function SiteAuditHero({
  auditCount,
  photoCount,
  lastLine,
}: {
  auditCount: number
  photoCount: number
  lastLine?: string
}) {
  return (
    <FeatureCard className="overflow-hidden">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-4 text-white">
        <p className="text-xs font-medium text-slate-300">Site audits</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xl font-extrabold">{auditCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Audits</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold">{photoCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Items</p>
          </div>
        </div>
        {lastLine && <p className="mt-3 text-[11px] text-slate-400">{lastLine}</p>}
      </div>
    </FeatureCard>
  )
}

function AuditListCard({ audit, onSelect }: { audit: SiteAudit; onSelect: () => void }) {
  const tone = siteAuditTypeTone(audit.type)
  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <FeatureCard className="p-3 transition hover:border-slate-300 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              tone === 'amber'
                ? 'bg-amber-50 text-amber-600'
                : tone === 'purple'
                  ? 'bg-purple-50 text-purple-600'
                  : tone === 'red'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-blue-50 text-blue-600'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{audit.type}</span>
              <StatusPill label={audit.type} tone={tone} />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {audit.projectJobNumber} {audit.projectName}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {audit.authorName}
              </span>
              <span className="inline-flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                {audit.items.length} items
              </span>
              <span>{format(audit.date, 'd MMM yyyy')}</span>
            </div>
          </div>
          <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </FeatureCard>
    </button>
  )
}

export function ProjectSiteAuditSection({ project }: { project: Project }) {
  const { organization, user } = useAuthStore()
  const { audits, loading, loadAudits } = useSiteAuditStore()
  const [typeFilter, setTypeFilter] = useState<SiteAuditTypeFilter>('All')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState<SiteAudit | null>(null)
  const canCreate = !isOperativeMode(user) || user?.permissions.siteAudit === true

  useEffect(() => {
    if (organization?.id) loadAudits(organization.id)
  }, [organization, loadAudits])

  const projectAudits = useMemo(
    () => audits.filter((a) => a.projectId === project.id).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [audits, project.id]
  )

  const filteredAudits = useMemo(() => {
    if (typeFilter === 'All') return projectAudits
    return projectAudits.filter((a) => a.type === typeFilter)
  }, [projectAudits, typeFilter])

  const photoCount = projectAudits.reduce((n, a) => n + a.items.length, 0)
  const lastSubmitted = projectAudits[0]
    ? `Last submitted ${format(projectAudits[0].createdAt, 'd MMM yyyy')} by ${projectAudits[0].authorName}`
    : undefined

  const chips = useMemo(() => {
    const list: { id: SiteAuditTypeFilter; label: string; count: number }[] = [
      { id: 'All', label: 'All', count: projectAudits.length },
    ]
    for (const t of SITE_AUDIT_TYPES) {
      list.push({ id: t, label: t, count: projectAudits.filter((a) => a.type === t).length })
    }
    return list
  }, [projectAudits])

  if (loading) return <LoadingSpinner />

  return (
    <FeatureScreen>
      <div className="mb-4 flex items-center justify-between gap-2">
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#185FA5] text-white shadow-md hover:bg-[#134d88]"
            aria-label="New site audit"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      <SiteAuditHero auditCount={projectAudits.length} photoCount={photoCount} lastLine={lastSubmitted} />

      <div className="mt-4">
        <FilterChipsRow chips={chips} selected={typeFilter} onSelect={setTypeFilter} />
      </div>

      {showCreate && organization?.id && (
        <SiteAuditCreateFlow
          project={project}
          onClose={() => setShowCreate(false)}
          onCreated={() => loadAudits(organization.id)}
        />
      )}

      <div className="mt-4 space-y-2">
        {filteredAudits.length === 0 ? (
          <FeatureCard className="py-12 text-center">
            <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">No site audits</p>
            <p className="mt-1 text-xs text-slate-500">Create your first audit for this project.</p>
            {canCreate && (
              <button type="button" onClick={() => setShowCreate(true)} className="mt-4 text-sm font-semibold text-[#185FA5]">
                + New audit
              </button>
            )}
          </FeatureCard>
        ) : (
          filteredAudits.map((audit) => (
            <AuditListCard key={audit.id} audit={audit} onSelect={() => setSelectedAudit(audit)} />
          ))
        )}
      </div>

      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <FeatureCard className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <StatusPill label={selectedAudit.type} tone={siteAuditTypeTone(selectedAudit.type)} />
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {selectedAudit.customTitle || selectedAudit.type}
                </p>
                <p className="text-xs text-slate-500">
                  {format(selectedAudit.date, 'd MMM yyyy')} · {selectedAudit.authorName}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedAudit.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.location && <p className="text-xs text-slate-500">{item.location}</p>}
                  {item.comments && <p className="mt-1 text-sm text-slate-600">{item.comments}</p>}
                  {item.imageURL && (
                    <a href={item.imageURL} target="_blank" rel="noreferrer" className="mt-2 block">
                      <img src={item.imageURL} alt="" className="max-h-40 rounded-lg object-cover" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </FeatureCard>
        </div>
      )}
    </FeatureScreen>
  )
}

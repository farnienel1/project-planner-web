'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { FeatureProjectStrip } from '@/components/projects/features/featureUi'

export function ProjectFeaturePageShell({
  title,
  backLabel,
  collection = 'projects',
  children,
}: {
  title: string
  backLabel: string
  collection?: 'projects' | 'smallWorks'
  children: (project: import('@/types').Project) => ReactNode
}) {
  const base = collection === 'smallWorks' ? '/dashboard/small-works' : '/dashboard/projects'
  const accent = collection === 'smallWorks' ? 'text-amber-600' : 'text-blue-600'

  return (
    <ProjectRecordPageShell collection={collection}>
      {(project) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`${base}/${project.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </Link>
            <span className={`text-sm font-bold ${accent}`}>{title}</span>
          </div>
          <FeatureProjectStrip
            jobNumber={project.jobNumber}
            siteName={project.siteName}
            clientName={project.client?.name}
          />
          {children(project)}
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

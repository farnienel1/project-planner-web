'use client'

import Link from 'next/link'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectVisibilityPage } from '@/components/projects/ProjectVisibilityPage'

export default function ProjectViewPage() {
  return (
    <ProjectRecordPageShell>
      {(project) => (
        <div className="space-y-4">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Back to project
          </Link>
          <ProjectVisibilityPage project={project} collection="projects" />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

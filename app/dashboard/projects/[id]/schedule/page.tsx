'use client'

import Link from 'next/link'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'

export default function ProjectSchedulePage() {
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
          <ProjectScheduleSection
            project={project}
            scheduleBasePath={`/dashboard/projects/${project.id}/schedule`}
          />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

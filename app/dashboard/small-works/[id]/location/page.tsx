'use client'

import Link from 'next/link'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectLocationPage } from '@/components/projects/ProjectLocationPage'

export default function SmallWorkLocationPageRoute() {
  return (
    <ProjectRecordPageShell collection="smallWorks">
      {(work) => (
        <div className="space-y-4">
          <Link
            href={`/dashboard/small-works/${work.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Back to small work
          </Link>
          <ProjectLocationPage project={work} hubPath={`/dashboard/small-works/${work.id}`} />
        </div>
      )}
    </ProjectRecordPageShell>
  )
}

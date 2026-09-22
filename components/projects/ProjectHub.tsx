/**
 * Project / small-works workspace overview.
 */
'use client'

import Link from 'next/link'
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, CubeIcon, ShieldCheckIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { canManageWorkCatalogue } from '@/lib/permissions'
import { ProjectDetailsCard, ProjectWorkspaceChrome } from '@/components/projects/ProjectWorkspaceChrome'
import { ProjectScheduleSection } from '@/components/projects/scheduling/ProjectScheduleSection'
import type { Project } from '@/types'

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
  const isSmallWork = basePath.includes('small-works')
  const canEdit = canManageWorkCatalogue(user, isSmallWork ? 'smallWorks' : 'projects')

  return (
    <ProjectWorkspaceChrome project={project} basePath={basePath} taskCount={taskCount}>
      <div className="gmain grid">
        <div className="stack">
          <section className="card">
            <div className="card-h" data-hue="sched">
              <span className="ico-chip sm">
                <CalendarDaysIcon className="h-4 w-4" />
              </span>
              <h2 className="h2">This week on site</h2>
              <div className="acts">
                <Link href={`${basePath}/schedule`} className="btn sm tint" data-hue="sched">
                  Open scheduling
                </Link>
              </div>
            </div>
            <div className="card-b">
              <ProjectScheduleSection project={project} scheduleBasePath={`${basePath}/schedule`} variant="hub" />
            </div>
          </section>
          <div className="g2 grid">
            <section className="card">
              <div className="card-h" data-hue="task">
                <span className="ico-chip sm">
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                </span>
                <h2 className="h2">My tasks</h2>
                <div className="acts">
                  <Link href={`${basePath}/tasks`} className="btn sm ghost">
                    All
                  </Link>
                </div>
              </div>
              <div className="card-b">
                <p className="muted small">
                  {taskCount ? `${taskCount} open task${taskCount === 1 ? '' : 's'} on this job.` : 'No open tasks. Create snags, variations and to-dos for this job.'}
                </p>
                <Link href={`${basePath}/tasks`} className="btn sm primary mt-3">
                  {taskCount ? 'Open tasks' : 'Create a task'}
                </Link>
              </div>
            </section>
            <section className="card">
              <div className="card-h" data-hue="sw">
                <span className="ico-chip sm">
                  <CubeIcon className="h-4 w-4" />
                </span>
                <h2 className="h2">Materials</h2>
                <div className="acts">
                  <Link href={`${basePath}/materials`} className="btn sm ghost">
                    All
                  </Link>
                </div>
              </div>
              <div className="card-b">
                <p className="muted small">Order materials for delivery to site.</p>
                <Link href={`${basePath}/materials`} className="btn sm hue mt-3" data-hue="sw">
                  Order materials
                </Link>
              </div>
            </section>
          </div>
        </div>
        <div className="stack">
          <ProjectDetailsCard project={project} basePath={basePath} canEdit={canEdit} />
          <section className="card" data-hue="hs">
            <div className="card-h">
              <span className="ico-chip sm">
                <ShieldCheckIcon className="h-4 w-4" />
              </span>
              <h2 className="h2">Health & safety</h2>
              <div className="acts">
                <Link href={`${basePath}/health-safety`} className="btn sm ghost">
                  Open
                </Link>
              </div>
            </div>
            <div className="card-b">
              <p className="muted small">Toolbox talks, RAMS and site documents for this job.</p>
            </div>
          </section>
        </div>
      </div>
    </ProjectWorkspaceChrome>
  )
}

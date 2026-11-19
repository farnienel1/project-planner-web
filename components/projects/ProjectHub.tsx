/**
 * Project / small-works workspace overview.
 */
'use client'

import { userCanEditJob } from '@/lib/access/bookingAccess'
import { canOpenJobScheduling } from '@/lib/permissions'
import { useOperativeStore } from '@/lib/stores/operativeStore'

import Link from 'next/link'
import { CalendarDaysIcon, ClipboardDocumentCheckIcon, CubeIcon, ShieldCheckIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
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
  // 1.10.0 round 2 (`canEditJob`): a manager edits the details of a job they manage even without the toggle.
  const canEdit = userCanEditJob(user, project, isSmallWork ? 'smallWorks' : 'projects', useOperativeStore.getState().managers)
  // Rulebook §2 `canScheduleOperatives`: operatives never schedule, so they get no "This week on site" panel and no
  // Open scheduling button (owner 17 Nov: "they shouldn't even get to this stage").
  const showScheduling = canOpenJobScheduling(user)

  return (
    <ProjectWorkspaceChrome project={project} basePath={basePath} taskCount={taskCount}>
      <div className="pj-overview">
        {showScheduling ? (
          <section className="pj-card">
            <div className="pj-card-h">
              <span className="pj-ico" aria-hidden="true">
                <CalendarDaysIcon className="h-4 w-4" />
              </span>
              <h2 className="pj-card-title">This week on site</h2>
              <Link href={`${basePath}/schedule`} className="pj-btn">
                Open scheduling
              </Link>
            </div>
            <div className="pj-card-b pj-card-b-schedule">
              <ProjectScheduleSection project={project} scheduleBasePath={`${basePath}/schedule`} variant="hub" />
            </div>
          </section>
        ) : null}
        <div className="pj-row3">
          <section className="pj-card">
            <div className="pj-card-h">
              <span className="pj-ico" aria-hidden="true">
                <ClipboardDocumentCheckIcon className="h-4 w-4" />
              </span>
              <h2 className="pj-card-title">Tasks</h2>
              <Link href={`${basePath}/tasks`} className="pj-link">
                All
              </Link>
            </div>
            <div className="pj-card-b">
              <p className="pj-muted">
                {taskCount ? `${taskCount} open task${taskCount === 1 ? '' : 's'} on this job.` : 'No open tasks. Create snags, variations and to-dos for this job.'}
              </p>
              <Link href={`${basePath}/tasks`} className="pj-btn">
                Tasks
              </Link>
            </div>
          </section>
          <section className="pj-card">
            <div className="pj-card-h">
              <span className="pj-ico" aria-hidden="true">
                <CubeIcon className="h-4 w-4" />
              </span>
              <h2 className="pj-card-title">Materials</h2>
              <Link href={`${basePath}/materials`} className="pj-link">
                All
              </Link>
            </div>
            <div className="pj-card-b">
              <p className="pj-muted">Order materials for delivery to site.</p>
              <Link href={`${basePath}/materials`} className="pj-btn">
                Order materials
              </Link>
            </div>
          </section>
          <section className="pj-card">
            <div className="pj-card-h">
              <span className="pj-ico" aria-hidden="true">
                <ShieldCheckIcon className="h-4 w-4" />
              </span>
              <h2 className="pj-card-title">Health & safety</h2>
              <Link href={`${basePath}/health-safety`} className="pj-link">
                Open
              </Link>
            </div>
            <div className="pj-card-b">
              <p className="pj-muted">Toolbox talks, RAMS and site documents for this job.</p>
            </div>
          </section>
        </div>
        <ProjectDetailsCard project={project} basePath={basePath} canEdit={canEdit} />
      </div>
    </ProjectWorkspaceChrome>
  )
}

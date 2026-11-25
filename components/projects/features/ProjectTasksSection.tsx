/**
 * The Tasks tab of a project or small works (rulebook 1.89.0 §34, owner tasks pack 24 Nov). Only this tab's content
 * changed: the page header, stats, tab buttons and every other tab are as before. The list, tabs, toolbar and the one
 * task popup are shared with the main Tasks page (`TaskList`); the location is filled in and locked on new tasks.
 */
'use client'

import { usePathname } from 'next/navigation'
import { TaskList } from '@/components/tasks/upgrade/TaskList'
import { taskLocationOf } from '@/components/tasks/upgrade/useTaskWorkspace'
import type { Project } from '@/types'

export function ProjectTasksSection({ project }: { project: Project }) {
  const pathname = usePathname() || ''
  const kind = pathname.includes('/small-works/') ? 'smallWorks' : 'project'
  return <TaskList mode="location" location={taskLocationOf(project, kind)} />
}

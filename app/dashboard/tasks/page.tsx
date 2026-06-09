'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useHolidayStore } from '@/lib/stores/holidayStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { TasksScreen } from '@/components/tasks/TasksScreen'

export default function TasksPage() {
  const { organization } = useAuthStore()
  const { loadTasks } = useTaskStore()
  const { loadBookings } = useHolidayStore()
  const { loadProjects, loadSmallWorks } = useProjectStore()
  const { loadOperatives, loadManagers } = useOperativeStore()
  const { loadUsers } = useOrgUserStore()

  useEffect(() => {
    if (!organization?.id) return
    loadTasks(organization.id)
    loadBookings(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    loadOperatives(organization.id)
    loadManagers(organization.id)
    loadUsers(organization.id)
  }, [
    organization?.id,
    loadTasks,
    loadBookings,
    loadProjects,
    loadSmallWorks,
    loadOperatives,
    loadManagers,
    loadUsers,
  ])

  return <TasksScreen />
}

'use client'

import { useEffect } from 'react'
import { isOperativeMode } from '@/lib/permissions'
import { useAuthStore } from '@/lib/stores/authStore'
import { useDeadlineStore } from '@/lib/stores/deadlineStore'

/** Operatives also see jobs they are assigned a deadline on. Managers are not filtered. */
export function useDeadlineAssignedProjectIds(): Set<string> | undefined {
  const { user, organization } = useAuthStore()
  const assignedProjectIds = useDeadlineStore((state) => state.assignedProjectIds)
  const loadAssignedProjectIds = useDeadlineStore((state) => state.loadAssignedProjectIds)
  const operative = isOperativeMode(user)

  useEffect(() => {
    if (!operative || !organization?.id || !user?.id) return
    void loadAssignedProjectIds(organization.id, user.id)
  }, [operative, organization?.id, user?.id, loadAssignedProjectIds])

  if (!operative) return undefined
  return new Set(assignedProjectIds)
}

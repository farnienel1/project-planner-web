/**
 * Rulebook 1.91.0 §34 decision A (review of #458): whether the visible task list can be trusted yet. An admin sees
 * every task, so it is ready at once. Anyone else is matched by job manager fields, assignment and creator, so the
 * list waits for the job lists (unless the screen already holds the job it shows), the Managers and Operatives rows
 * and the users roster as the server answered it — never a short list, an empty "No tasks" or a false "no access"
 * while they load. Display only: it decides nothing about who sees what.
 */

import type { StaffAccountRole } from '@/lib/canonical'

export interface TaskVisibilityReadyInput {
  role: StaffAccountRole | null | undefined
  orgId: string | null | undefined
  /** The screen already holds the job(s) it shows (a job page): the job lists need not have loaded. */
  hasOwnJobs?: boolean
  projectsLoadedOrgId?: string | null
  smallWorksLoadedOrgId?: string | null
  operativesLoadedOrgId?: string | null
  managersLoadedOrgId?: string | null
  rosterServerOrgId?: string | null
}

export function taskVisibilityReady(input: TaskVisibilityReadyInput): boolean {
  const orgId = input.orgId
  if (!orgId || !input.role) return false
  if (input.role.isAdmin) return true
  const jobsReady = input.hasOwnJobs === true || (input.projectsLoadedOrgId === orgId && input.smallWorksLoadedOrgId === orgId)
  return (
    jobsReady &&
    input.operativesLoadedOrgId === orgId &&
    input.managersLoadedOrgId === orgId &&
    input.rosterServerOrgId === orgId
  )
}

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

/** How long a list may wait for its loads before it says so (no server answer). */
export const TASK_VISIBILITY_TIMEOUT_MS = 15_000

export const TASK_VISIBILITY_FAILED_MESSAGE = 'Tasks did not finish loading. Check the connection and try again.'

export type TaskVisibilityPhase = 'ready' | 'loading' | 'failed'

/**
 * Re-check of #459: never an endless spinner. Ready as `taskVisibilityReady`; otherwise failed when a load it waits for
 * reported an error, or no answer came within `TASK_VISIBILITY_TIMEOUT_MS` (`timedOut`); else loading.
 */
export function taskVisibilityPhase(
  input: TaskVisibilityReadyInput & { loadErrors?: ReadonlyArray<string | null | undefined>; timedOut?: boolean }
): TaskVisibilityPhase {
  if (taskVisibilityReady(input)) return 'ready'
  if (input.timedOut || (input.loadErrors || []).some((e) => Boolean(e))) return 'failed'
  return 'loading'
}

/**
 * Re-check of #459: remembered filters are pruned only once every input they are judged against has loaded — for
 * every role, admins included — so a job or creator key is never dropped because its list had not arrived yet.
 */
export function taskFilterInputsLoaded(input: {
  orgId: string | null | undefined
  tasksLoadedOrgId?: string | null
  projectsLoadedOrgId?: string | null
  smallWorksLoadedOrgId?: string | null
  operativesLoadedOrgId?: string | null
  managersLoadedOrgId?: string | null
  rosterServerOrgId?: string | null
}): boolean {
  const o = input.orgId
  if (!o) return false
  return [
    input.tasksLoadedOrgId,
    input.projectsLoadedOrgId,
    input.smallWorksLoadedOrgId,
    input.operativesLoadedOrgId,
    input.managersLoadedOrgId,
    input.rosterServerOrgId,
  ].every((id) => id === o)
}

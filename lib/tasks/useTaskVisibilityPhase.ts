'use client'

/**
 * Re-check of #459: the visible-task phase for a screen (`taskVisibilityPhase`) with the 15 s no-answer timer and a
 * Retry that asks every load again. Shared by the Tasks pages and `useVisibleTasksState`.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  TASK_VISIBILITY_TIMEOUT_MS,
  taskVisibilityPhase,
  type TaskVisibilityPhase,
  type TaskVisibilityReadyInput,
} from '@/lib/tasks/taskVisibilityReady'

export function useTaskVisibilityPhase(
  input: TaskVisibilityReadyInput & { loadErrors: ReadonlyArray<string | null | undefined> },
  reload: () => void
): { phase: TaskVisibilityPhase; retry: () => void } {
  const [timedOutKey, setTimedOutKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${input.orgId || ''}|${attempt}`
  const base = taskVisibilityPhase({ ...input, timedOut: false })
  useEffect(() => {
    if (base !== 'loading') return
    const timer = setTimeout(() => setTimedOutKey(key), TASK_VISIBILITY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [base, key])
  const phase = taskVisibilityPhase({ ...input, timedOut: timedOutKey === key })
  const retry = useCallback(() => {
    setAttempt((n) => n + 1)
    reload()
  }, [reload])
  return { phase, retry }
}

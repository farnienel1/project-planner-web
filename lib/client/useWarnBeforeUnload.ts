'use client'

import { useEffect } from 'react'

/**
 * While `active`, the browser asks before the page is closed or reloaded. Used while a save is still waiting for the
 * server (review of #371): Firestore keeps queued writes in memory only, so a reload throws them away.
 */
export function useWarnBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
}

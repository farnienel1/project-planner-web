'use client'

/**
 * Rulebook 1.38.0 §27: runs the data check while the app is open — on open (once the listeners have had time to
 * deliver their first snapshot), when the tab returns to the foreground and on a timer. The rule
 * (`dataParityCheckDue`) decides whether a trigger actually runs; never blocks the UI (fire and forget).
 */
import { useEffect } from 'react'
import { DATA_PARITY_MIN_INTERVAL_MS } from '@/lib/canonical'
import { useDataParityStore } from '@/lib/dataParity/dataParityMonitor'

/** Listeners usually deliver their first snapshot well within this after the app opens. */
const OPEN_DELAY_MS = 20_000

export function useDataParityMonitor(organizationId: string | null | undefined): void {
  useEffect(() => {
    if (!organizationId || typeof window === 'undefined') return
    const run = useDataParityStore.getState().run
    useDataParityStore.getState().load(organizationId)
    const open = window.setTimeout(() => void run(organizationId, 'open').catch(() => undefined), OPEN_DELAY_MS)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run(organizationId, 'timer').catch(() => undefined)
    }, DATA_PARITY_MIN_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run(organizationId, 'foreground').catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(open)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [organizationId])
}

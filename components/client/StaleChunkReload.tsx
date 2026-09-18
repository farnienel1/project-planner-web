'use client'

import { useEffect } from 'react'
import {
  clearStaleChunkReloadFlag,
  reloadOnceOnStaleChunk,
} from '@/lib/client/chunkLoadError'

/** Reloads once when a deploy has replaced hashed JS the current page still asks for. */
export function StaleChunkReload() {
  useEffect(() => {
    clearStaleChunkReloadFlag()

    function onError(event: ErrorEvent) {
      reloadOnceOnStaleChunk(event.error || event.message)
    }
    function onRejection(event: PromiseRejectionEvent) {
      reloadOnceOnStaleChunk(event.reason)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}

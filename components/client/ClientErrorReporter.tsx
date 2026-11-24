'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/clientErrors/reportClientError'
import { isChunkLoadError } from '@/lib/client/chunkLoadError'

/** Sends anonymous error reports (rulebook §32, D7) for uncaught errors and unhandled promise rejections. */
export function ClientErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const error = event.error ?? event.message
      if (isChunkLoadError(error)) return
      void reportClientError('window', error)
    }
    function onRejection(event: PromiseRejectionEvent) {
      if (isChunkLoadError(event.reason)) return
      void reportClientError('promise', event.reason)
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

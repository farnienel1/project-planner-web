'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ToastViewport } from '@/components/ui/overlays'

const ToastContext = createContext<(message: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const toast = useCallback((next: string) => {
    setMessage(next)
    window.setTimeout(() => setMessage(null), 2400)
  }, [])
  const value = useMemo(() => toast, [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport message={message} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type LeaveFn = () => void

type SettingsDirtyContextValue = {
  dirty: boolean
  setDirty: (dirty: boolean) => void
  requestLeave: (proceed: LeaveFn) => void
}

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null)

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<LeaveFn | null>(null)

  const requestLeave = useCallback(
    (proceed: LeaveFn) => {
      if (!dirty) {
        proceed()
        return
      }
      setPending(() => proceed)
    },
    [dirty]
  )

  useEffect(() => {
    if (!dirty) return
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  return (
    <SettingsDirtyContext.Provider value={{ dirty, setDirty, requestLeave }}>
      {children}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-unsaved-title"
            className="w-full max-w-md rounded-2xl bg-[var(--card)] p-5 shadow-xl"
          >
            <h2 id="settings-unsaved-title" className="text-[17px] font-bold text-[var(--ink)]">
              Unsaved changes
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink2)]">
              You have changes that have not been saved. Leave this page and discard them?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-[14px] font-semibold text-[var(--ink2)] hover:bg-[var(--soft)]"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--blue)] px-4 py-2 text-[14px] font-semibold text-white hover:opacity-90"
                onClick={() => {
                  const proceed = pending
                  setPending(null)
                  setDirty(false)
                  proceed()
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsDirtyContext.Provider>
  )
}

export function useSettingsDirty(dirty: boolean) {
  const ctx = useContext(SettingsDirtyContext)
  useEffect(() => {
    ctx?.setDirty(dirty)
    return () => ctx?.setDirty(false)
  }, [ctx, dirty])
}

export function useSettingsLeave() {
  const ctx = useContext(SettingsDirtyContext)
  return ctx?.requestLeave ?? ((proceed: LeaveFn) => proceed())
}

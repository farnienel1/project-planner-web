import { create } from 'zustand'

/**
 * Review of #363 (17 Nov): an export's background delivery (PDFs, backups, the email) never fails silently.
 * - One delivery per organisation at a time: Export is disabled while one is pending (`exportDeliveryPending`).
 * - The result is kept per organisation and survives navigation (this store) and a reload (`localStorage`); the
 *   Exported tab shows it until dismissed. A delivery still "sending" when the page was closed or reloaded reads as
 *   possibly not sent, with the pointer to Download PDF (`exportDeliveryNotice`).
 * - While a delivery is pending the browser asks before the tab is closed or reloaded (`beforeunload`).
 */

export type ExportDeliveryEntry = {
  /** One export run (its start time and pay run), so a later run never takes over an earlier run's message. */
  runKey: string
  status: 'sending' | 'done' | 'failed'
  message: string
  atMs: number
}

const STORAGE_PREFIX = 'pp.timesheetExportDelivery:'

function readStored(organizationId: string): ExportDeliveryEntry | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + organizationId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExportDeliveryEntry
    return parsed && typeof parsed.runKey === 'string' && typeof parsed.message === 'string' ? parsed : null
  } catch {
    return null
  }
}

function writeStored(organizationId: string, entry: ExportDeliveryEntry | null) {
  try {
    if (entry) window.localStorage.setItem(STORAGE_PREFIX + organizationId, JSON.stringify(entry))
    else window.localStorage.removeItem(STORAGE_PREFIX + organizationId)
  } catch {
    /* storage unavailable: the in-memory store still holds it for this page */
  }
}

/** The text the Exported tab shows for an entry. `live` = this page is the one delivering (not a leftover). */
export function exportDeliveryNotice(entry: ExportDeliveryEntry | null | undefined, live: boolean): string | null {
  if (!entry) return null
  if (entry.status === 'sending' && !live) {
    return `${entry.message} The page was closed or reloaded before sending finished, so some PDFs or the email may not have been sent. Open Exported to download any timesheet again (Download PDF).`
  }
  return entry.message
}

type ExportDeliveryState = {
  entries: Record<string, ExportDeliveryEntry>
  /** Run keys this page is delivering now. */
  live: Record<string, string>
  start: (organizationId: string, runKey: string, message: string) => void
  finish: (organizationId: string, runKey: string, status: 'done' | 'failed', message: string) => void
  load: (organizationId: string) => void
  dismiss: (organizationId: string) => void
}

let unloadGuards = 0
function guardUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}
function addUnloadGuard() {
  if (typeof window === 'undefined') return
  if (unloadGuards++ === 0) window.addEventListener('beforeunload', guardUnload)
}
function removeUnloadGuard() {
  if (typeof window === 'undefined') return
  unloadGuards = Math.max(0, unloadGuards - 1)
  if (unloadGuards === 0) window.removeEventListener('beforeunload', guardUnload)
}

export const useExportDeliveryStore = create<ExportDeliveryState>((set, get) => ({
  entries: {},
  live: {},
  start: (organizationId, runKey, message) => {
    const entry: ExportDeliveryEntry = { runKey, status: 'sending', message, atMs: Date.now() }
    writeStored(organizationId, entry)
    addUnloadGuard()
    set({ entries: { ...get().entries, [organizationId]: entry }, live: { ...get().live, [organizationId]: runKey } })
  },
  finish: (organizationId, runKey, status, message) => {
    if (get().live[organizationId] === runKey) removeUnloadGuard()
    // Only the run that started it may write its result.
    if (get().entries[organizationId]?.runKey !== runKey) return
    const entry: ExportDeliveryEntry = { runKey, status, message, atMs: Date.now() }
    writeStored(organizationId, entry)
    const live = { ...get().live }
    delete live[organizationId]
    set({ entries: { ...get().entries, [organizationId]: entry }, live })
  },
  load: (organizationId) => {
    if (get().entries[organizationId]) return
    const stored = typeof window === 'undefined' ? null : readStored(organizationId)
    if (stored) set({ entries: { ...get().entries, [organizationId]: stored } })
  },
  dismiss: (organizationId) => {
    if (get().live[organizationId]) return
    writeStored(organizationId, null)
    const entries = { ...get().entries }
    delete entries[organizationId]
    set({ entries })
  },
}))

/** Whether this page is delivering an export for the organisation (Export stays disabled until it finishes). */
export function exportDeliveryPending(state: Pick<ExportDeliveryState, 'live'>, organizationId: string | null | undefined): boolean {
  return Boolean(organizationId && state.live[organizationId])
}

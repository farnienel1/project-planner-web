import { create } from 'zustand'

/**
 * Review of #363 (17 Nov): an export's background delivery (PDFs, backups, the email) never fails silently.
 * - One delivery per organisation at a time, across tabs: Export is disabled while one is live in this tab or another
 *   tab of this browser (`exportDeliveryPending`). A sending tab writes a heartbeat; a "sending" entry whose heartbeat
 *   is older than `EXPORT_DELIVERY_STALE_MS` belongs to a tab that was closed or reloaded.
 * - The result is kept per organisation and survives navigation (this store) and a reload (`localStorage`); other tabs
 *   pick it up through `storage` events. The Exported tab shows it until dismissed. A send whose tab was closed mid-way
 *   reads as possibly not sent, with the pointer to Download PDF (`exportDeliveryNotice`).
 * - While this tab is sending, the browser asks before the tab is closed or reloaded (`beforeunload`).
 */

export type ExportDeliveryEntry = {
  /** One export run (its start time and pay run), so a later run never takes over an earlier run's message. */
  runKey: string
  status: 'sending' | 'done' | 'failed'
  message: string
  atMs: number
  /** The tab sending it, and when that tab last said it was still sending. */
  ownerTab?: string
  heartbeatMs?: number
}

/** How often a sending tab writes its heartbeat, and when a silent "sending" entry counts as abandoned. */
export const EXPORT_DELIVERY_HEARTBEAT_MS = 5_000
export const EXPORT_DELIVERY_STALE_MS = 20_000

const STORAGE_PREFIX = 'pp.timesheetExportDelivery:'

/** This page's id (one per load). */
export const EXPORT_DELIVERY_TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** A "sending" entry another tab is still working on (heartbeat recent). */
export function exportDeliveryLiveElsewhere(entry: ExportDeliveryEntry | null | undefined, tabId: string, nowMs: number): boolean {
  if (!entry || entry.status !== 'sending' || !entry.ownerTab || entry.ownerTab === tabId) return false
  const beat = entry.heartbeatMs ?? entry.atMs
  return nowMs - beat < EXPORT_DELIVERY_STALE_MS
}

/**
 * The text the Exported tab shows. `liveHere` = this tab is sending it; `liveElsewhere` = another tab still is. A
 * "sending" entry neither is sending was left by a page closed or reloaded mid-way.
 */
export function exportDeliveryNotice(entry: ExportDeliveryEntry | null | undefined, liveHere: boolean, liveElsewhere = false): string | null {
  if (!entry) return null
  if (entry.status === 'sending' && liveElsewhere) return `${entry.message} (sending in another tab)`
  if (entry.status === 'sending' && !liveHere) {
    return `${entry.message} The page was closed or reloaded before sending finished, so some PDFs or the email may not have been sent. Open Exported to download any timesheet again (Download PDF).`
  }
  return entry.message
}

function readStored(organizationId: string): ExportDeliveryEntry | null {
  try {
    return parseEntry(window.localStorage.getItem(STORAGE_PREFIX + organizationId))
  } catch {
    return null
  }
}

function parseEntry(raw: string | null): ExportDeliveryEntry | null {
  if (!raw) return null
  try {
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

type ExportDeliveryState = {
  entries: Record<string, ExportDeliveryEntry>
  /** Run keys this tab is delivering now. */
  live: Record<string, string>
  /** Re-read time, so a silent other tab's entry turns stale on screen. */
  nowMs: number
  start: (organizationId: string, runKey: string, message: string) => void
  finish: (organizationId: string, runKey: string, status: 'done' | 'failed', message: string) => void
  load: (organizationId: string) => void
  dismiss: (organizationId: string) => void
}

let unloadGuardOn = false
function guardUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}
/** One listener for the page, on while this tab sends anything (nit 6: never one per start). */
function syncUnloadGuard(live: Record<string, string>) {
  if (typeof window === 'undefined') return
  const wanted = Object.keys(live).length > 0
  if (wanted && !unloadGuardOn) window.addEventListener('beforeunload', guardUnload)
  if (!wanted && unloadGuardOn) window.removeEventListener('beforeunload', guardUnload)
  unloadGuardOn = wanted
}

const heartbeats = new Map<string, ReturnType<typeof setInterval>>()
let staleTimer: ReturnType<typeof setTimeout> | null = null

export const useExportDeliveryStore = create<ExportDeliveryState>((set, get) => ({
  entries: {},
  live: {},
  nowMs: Date.now(),
  start: (organizationId, runKey, message) => {
    const now = Date.now()
    const entry: ExportDeliveryEntry = { runKey, status: 'sending', message, atMs: now, ownerTab: EXPORT_DELIVERY_TAB_ID, heartbeatMs: now }
    writeStored(organizationId, entry)
    const live = { ...get().live, [organizationId]: runKey }
    syncUnloadGuard(live)
    clearInterval(heartbeats.get(organizationId))
    if (typeof window !== 'undefined') {
      heartbeats.set(
        organizationId,
        setInterval(() => {
          const held = get().entries[organizationId]
          if (!held || held.runKey !== runKey || held.status !== 'sending') return
          const beat = { ...held, heartbeatMs: Date.now() }
          writeStored(organizationId, beat)
          set({ entries: { ...get().entries, [organizationId]: beat } })
        }, EXPORT_DELIVERY_HEARTBEAT_MS)
      )
    }
    set({ entries: { ...get().entries, [organizationId]: entry }, live })
  },
  finish: (organizationId, runKey, status, message) => {
    if (get().live[organizationId] !== runKey) return
    clearInterval(heartbeats.get(organizationId))
    heartbeats.delete(organizationId)
    const live = { ...get().live }
    delete live[organizationId]
    syncUnloadGuard(live)
    const entry: ExportDeliveryEntry = { runKey, status, message, atMs: Date.now() }
    writeStored(organizationId, entry)
    set({ entries: { ...get().entries, [organizationId]: entry }, live })
  },
  load: (organizationId) => {
    if (get().live[organizationId]) return
    const stored = typeof window === 'undefined' ? null : readStored(organizationId)
    if (stored) set({ entries: { ...get().entries, [organizationId]: stored }, nowMs: Date.now() })
    scheduleStaleCheck()
  },
  dismiss: (organizationId) => {
    const state = get()
    if (state.live[organizationId] || exportDeliveryLiveElsewhere(state.entries[organizationId], EXPORT_DELIVERY_TAB_ID, Date.now())) return
    writeStored(organizationId, null)
    const entries = { ...state.entries }
    delete entries[organizationId]
    set({ entries })
  },
}))

/** While another tab's entry is "sending", re-read the time so it turns stale on screen if that tab goes quiet. */
function scheduleStaleCheck() {
  if (typeof window === 'undefined' || staleTimer) return
  const state = useExportDeliveryStore.getState()
  const foreign = Object.values(state.entries).some((entry) => entry.status === 'sending' && entry.ownerTab !== EXPORT_DELIVERY_TAB_ID)
  if (!foreign) return
  staleTimer = setTimeout(() => {
    staleTimer = null
    useExportDeliveryStore.setState({ nowMs: Date.now() })
    scheduleStaleCheck()
  }, EXPORT_DELIVERY_HEARTBEAT_MS)
}

// Another tab of this browser started, beat, finished or dismissed a delivery: take its entry.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return
    const organizationId = event.key.slice(STORAGE_PREFIX.length)
    const state = useExportDeliveryStore.getState()
    if (state.live[organizationId]) return
    const entry = parseEntry(event.newValue)
    const entries = { ...state.entries }
    if (entry) entries[organizationId] = entry
    else delete entries[organizationId]
    useExportDeliveryStore.setState({ entries, nowMs: Date.now() })
    scheduleStaleCheck()
  })
}

/** Whether a delivery for the organisation is live in this tab or another tab (Export stays disabled until it ends). */
export function exportDeliveryPending(
  state: Pick<ExportDeliveryState, 'live' | 'entries' | 'nowMs'>,
  organizationId: string | null | undefined,
  tabId = EXPORT_DELIVERY_TAB_ID
): boolean {
  if (!organizationId) return false
  return Boolean(state.live[organizationId]) || exportDeliveryLiveElsewhere(state.entries[organizationId], tabId, state.nowMs)
}

'use client'

/**
 * Rulebook 1.38.0 §27 "Data check" (owner decision 11 Nov), web. Read-only: for every list in `DATA_PARITY_CHECKS`
 * that this browser listens to, the server's `count()` of exactly the listener's query is compared with the
 * documents the app holds for it (`dataParityCheck`). On a mismatch the app re-reads that list from the server and
 * re-attaches its listener (self-heal), checks again, and keeps the result in this browser only (`localStorage`,
 * the last `DATA_PARITY_LOG_LIMIT` results). Nothing is written to Firestore.
 *
 * Runs on open, when the tab returns to the foreground and every `DATA_PARITY_MIN_INTERVAL_MS` while open
 * (`dataParityCheckDue`; never offline; the last run is shared by every tab of this browser through `localStorage`),
 * and from Data health "Check now" (admins, only while the panel switch is on). A list with this device's unconfirmed
 * writes, or whose listener has not had a server answer yet, is not compared that time; a difference is re-read only
 * when a second look `DATA_PARITY_CONFIRM_DELAY_MS` later finds it again (`dataParityConfirm`).
 */

import { create } from 'zustand'
import { collection, getCountFromServer, query, waitForPendingWrites, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  DATA_PARITY_CHECKS,
  DATA_PARITY_CONFIRM_DELAY_MS,
  dataParityCheck,
  dataParityCheckDue,
  dataParityConfirm,
  dataParityLogAppend,
  dataParityLogEntry,
  dataParitySumCounts,
  isLegacyPlaceholderDocumentId,
  type DataParityListInput,
  type DataParityListKey,
  type DataParityLogEntry,
  type DataParityTrigger,
} from '@/lib/canonical'
import {
  countOrgCollectionFromServer,
  orgCollectionParitySource,
  reloadOrgCollectionFromServer,
} from '@/lib/firebase/subscribeOrgCollection'
import { countOrgPlanPartsFromServer, orgPlanParitySource, restartOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { waitForAuthToken } from '@/lib/firebase/waitForAuthToken'
import { liveRosterParitySource, reattachLiveRoster } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { readerDroppedJobDocuments } from '@/lib/firebase/orgCollectionMerge'

/** The listener key each list is held under on web (stores' own keys). */
export const WEB_DATA_PARITY_LISTENER_KEYS: Record<Exclude<DataParityListKey, 'users'>, string> = {
  projects: 'projectStore:projects',
  smallWorks: 'projectStore:smallWorks',
  operatives: 'operativeStore:operatives',
  managers: 'operativeStore:managers',
  clients: 'projectStore:clients',
  bookings: 'bookings',
  managerSiteBookings: 'managerSiteBookings',
  holidayBookings: 'holidayStore:holidayBookings',
  tasks: 'taskStore:tasks',
}

const LOG_KEY = (organizationId: string) => `pp.dataParity.v1:${organizationId}`
/** When any tab of this browser last started a check for the organisation (the throttle is per device, not per tab). */
const LAST_RUN_KEY = (organizationId: string) => `pp.dataParity.lastRun.v1:${organizationId}`

function readLastRunMs(organizationId: string): number | null {
  try {
    const value = Number(globalThis.localStorage?.getItem(LAST_RUN_KEY(organizationId)))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeLastRunMs(organizationId: string, atMs: number): void {
  try {
    globalThis.localStorage?.setItem(LAST_RUN_KEY(organizationId), String(atMs))
  } catch {
    /* Blocked storage: this tab still throttles itself. */
  }
}

/** The latest of the in-memory, logged and shared last-run times, read at check time. */
function lastCheckedAcrossTabs(organizationId: string, inMemory: number | null): number | null {
  const log = readLog(organizationId)
  const times = [inMemory, log.length > 0 ? log[log.length - 1].atMs : null, readLastRunMs(organizationId)].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  )
  return times.length > 0 ? Math.max(...times) : null
}

/**
 * True when every write this device has queued was confirmed by the server within `timeoutMs` (then no list has
 * unconfirmed writes, whatever its last snapshot said); false offline or when a write is still on its way.
 */
async function pendingWritesSettled(timeoutMs: number): Promise<boolean> {
  if (!db) return true
  const firestore = db
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      waitForPendingWrites(firestore).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const PENDING_WRITES_WAIT_MS = 5000

function readLog(organizationId: string): DataParityLogEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(LOG_KEY(organizationId))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as DataParityLogEntry[]) : []
  } catch {
    return []
  }
}

function writeLog(organizationId: string, log: DataParityLogEntry[]): void {
  try {
    globalThis.localStorage?.setItem(LOG_KEY(organizationId), JSON.stringify(log))
  } catch {
    /* Private window or blocked storage: the result stays in memory only. */
  }
}

type ListProbe = {
  input: DataParityListInput
  heal: () => Promise<boolean>
}

const NO_HEAL = async () => false

/** Skip a list this device has unconfirmed writes for (unless every write has just been confirmed), or one whose
 * listener has not had a server answer for its current query yet. */
function notComparable(
  key: DataParityListKey,
  source: { serverSnapshot: boolean; pendingWrites: boolean },
  writesSettled: boolean
): ListProbe | null {
  if (source.pendingWrites && !writesSettled) return { input: { key, skipped: 'pendingWrites' }, heal: NO_HEAL }
  if (!source.serverSnapshot) return { input: { key, skipped: 'awaitingServerSnapshot' }, heal: NO_HEAL }
  return null
}

async function probeList(key: DataParityListKey, organizationId: string, writesSettled: boolean): Promise<ListProbe | null> {
  if (key === 'users') {
    const source = liveRosterParitySource(organizationId)
    if (!source) return null
    const waiting = notComparable(key, source, writesSettled)
    if (waiting) return waiting
    let serverCount: number | null = null
    if (db) {
      try {
        await waitForAuthToken()
        const snap = await getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', organizationId)))
        serverCount = snap.data().count
      } catch {
        serverCount = null
      }
    }
    return { input: { key, serverCount, localIds: source.heldIds }, heal: () => reattachLiveRoster(organizationId) }
  }
  const listenerKey = WEB_DATA_PARITY_LISTENER_KEYS[key]
  const isJobs = key === 'projects' || key === 'smallWorks'
  const plan = orgPlanParitySource(listenerKey, organizationId)
  if (plan) {
    if (plan.documentReads) return { input: { key, skipped: 'documentReads' }, heal: NO_HEAL }
    if (!plan.settled) return null
    const waiting = notComparable(key, plan, writesSettled)
    if (waiting) return waiting
    const serverCount = dataParitySumCounts(await countOrgPlanPartsFromServer(listenerKey, organizationId))
    return {
      input: { key, serverCount, localIds: plan.docs.map((row) => row.id) },
      heal: async () => restartOrgPlan(listenerKey, organizationId),
    }
  }
  const source = orgCollectionParitySource(listenerKey, organizationId)
  if (!source) return null
  const waiting = notComparable(key, source, writesSettled)
  if (waiting) return waiting
  const serverCount = await countOrgCollectionFromServer(listenerKey, organizationId)
  if (isJobs) {
    // The store's own list (what the screens use), plus the placeholder document its reader leaves out.
    const state = useProjectStore.getState()
    const loadedOrg = key === 'projects' ? state.projectsLoadedOrgId : state.smallWorksLoadedOrgId
    const held = loadedOrg === organizationId ? (key === 'projects' ? state.projects : state.smallWorks) : null
    if (!held) return null
    return {
      input: {
        key,
        serverCount,
        localIds: held.map((row) => row.id),
        readerDroppedCount: readerDroppedJobDocuments(source.docs, isLegacyPlaceholderDocumentId),
      },
      heal: () => reloadOrgCollectionFromServer(listenerKey, organizationId),
    }
  }
  return {
    input: { key, serverCount, localIds: source.docs.map((row) => row.id) },
    heal: () => reloadOrgCollectionFromServer(listenerKey, organizationId),
  }
}

async function compareAll(organizationId: string, keys: ReadonlyArray<DataParityListKey>) {
  const probes = new Map<DataParityListKey, ListProbe>()
  const writesSettled = await pendingWritesSettled(PENDING_WRITES_WAIT_MS)
  await Promise.all(
    keys.map(async (key) => {
      const probe = await probeList(key, organizationId, writesSettled).catch(() => null)
      probes.set(key, probe ?? { input: { key, skipped: 'notListening' }, heal: NO_HEAL })
    })
  )
  const result = dataParityCheck({ lists: keys.map((key) => (probes.get(key) as ListProbe).input) })
  return { result, probes }
}

interface DataParityState {
  organizationId: string | null
  log: DataParityLogEntry[]
  running: boolean
  lastCheckedMs: number | null
  load: (organizationId: string) => void
  run: (organizationId: string, trigger: DataParityTrigger) => Promise<DataParityLogEntry | null>
}

const HEAL_SETTLE_MS = 1500

export const useDataParityStore = create<DataParityState>((set, get) => ({
  organizationId: null,
  log: [],
  running: false,
  lastCheckedMs: null,

  load: (organizationId) => {
    if (get().organizationId === organizationId) return
    const log = readLog(organizationId)
    set({ organizationId, log, lastCheckedMs: log.length > 0 ? log[log.length - 1].atMs : null })
  },

  run: async (organizationId, trigger) => {
    if (!organizationId || get().running) return null
    get().load(organizationId)
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
    const nowMs = Date.now()
    // Read at check time: another tab of this browser may have run the check since this one loaded its log.
    const lastCheckedMs = lastCheckedAcrossTabs(organizationId, get().lastCheckedMs)
    if (!dataParityCheckDue({ trigger, lastCheckedMs, nowMs, online })) return null
    writeLastRunMs(organizationId, nowMs)
    set({ running: true })
    try {
      const keys = DATA_PARITY_CHECKS.map((check) => check.key)
      const first = await compareAll(organizationId, keys)
      // The two-look rule: a difference is acted on only when a second look a few seconds later finds it again.
      let confirmed = first.result
      let probes = first.probes
      if (first.result.action === 'reload') {
        await new Promise((resolve) => setTimeout(resolve, DATA_PARITY_CONFIRM_DELAY_MS))
        const second = await compareAll(organizationId, first.result.reloadKeys)
        confirmed = dataParityConfirm({ first: first.result, confirm: second.result })
        probes = second.probes
      }
      let recheck = null
      if (confirmed.action === 'reload') {
        await Promise.all(confirmed.reloadKeys.map((key) => probes.get(key)?.heal().catch(() => false)))
        await new Promise((resolve) => setTimeout(resolve, HEAL_SETTLE_MS))
        recheck = (await compareAll(organizationId, confirmed.reloadKeys)).result
      }
      const entry = dataParityLogEntry({ atMs: Date.now(), trigger, first: confirmed, recheck })
      if (get().organizationId !== organizationId) return entry
      // Appended to the stored log (another tab may have written one since this tab loaded it).
      const log = dataParityLogAppend(readLog(organizationId), entry)
      writeLog(organizationId, log)
      set({ log, lastCheckedMs: entry.atMs })
      if (entry.mismatches.length > 0 && process.env.NODE_ENV !== 'production') {
        console.warn('DATA_PARITY_MISMATCH', JSON.stringify(entry.mismatches))
      }
      return entry
    } finally {
      set({ running: false })
    }
  },
}))

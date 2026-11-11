'use client'

/**
 * Rulebook 1.38.0 §27 "Data check" (owner decision 11 Nov), web. Read-only: for every list in `DATA_PARITY_CHECKS`
 * that this browser listens to, the server's `count()` of exactly the listener's query is compared with the
 * documents the app holds for it (`dataParityCheck`). On a mismatch the app re-reads that list from the server and
 * re-attaches its listener (self-heal), checks again, and keeps the result in this browser only (`localStorage`,
 * the last `DATA_PARITY_LOG_LIMIT` results). Nothing is written to Firestore.
 *
 * Runs on open, when the tab returns to the foreground and every `DATA_PARITY_MIN_INTERVAL_MS` while open
 * (`dataParityCheckDue`; never offline), and from Settings → Data health "Check now" (admins).
 */

import { create } from 'zustand'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  DATA_PARITY_CHECKS,
  dataParityCheck,
  dataParityCheckDue,
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

async function probeList(key: DataParityListKey, organizationId: string): Promise<ListProbe | null> {
  if (key === 'users') {
    const source = liveRosterParitySource(organizationId)
    if (!source) return null
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
    if (plan.documentReads) return { input: { key, skipped: 'documentReads' }, heal: async () => false }
    if (!plan.settled) return null
    const serverCount = dataParitySumCounts(await countOrgPlanPartsFromServer(listenerKey, organizationId))
    return {
      input: { key, serverCount, localIds: plan.docs.map((row) => row.id) },
      heal: async () => restartOrgPlan(listenerKey, organizationId),
    }
  }
  const source = orgCollectionParitySource(listenerKey, organizationId)
  if (!source) return null
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
  await Promise.all(
    keys.map(async (key) => {
      const probe = await probeList(key, organizationId).catch(() => null)
      probes.set(key, probe ?? { input: { key, skipped: 'notListening' }, heal: async () => false })
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
    if (!dataParityCheckDue({ trigger, lastCheckedMs: get().lastCheckedMs, nowMs: Date.now(), online })) return null
    set({ running: true })
    try {
      const keys = DATA_PARITY_CHECKS.map((check) => check.key)
      const first = await compareAll(organizationId, keys)
      let recheck = null
      if (first.result.action === 'reload') {
        await Promise.all(first.result.reloadKeys.map((key) => first.probes.get(key)?.heal().catch(() => false)))
        await new Promise((resolve) => setTimeout(resolve, HEAL_SETTLE_MS))
        recheck = (await compareAll(organizationId, first.result.reloadKeys)).result
      }
      const entry = dataParityLogEntry({ atMs: Date.now(), trigger, first: first.result, recheck })
      if (get().organizationId !== organizationId) return entry
      const log = dataParityLogAppend(get().log, entry)
      writeLog(organizationId, log)
      set({ log, lastCheckedMs: entry.atMs })
      if (entry.mismatches.length > 0) {
        console.warn('DATA_PARITY_MISMATCH', JSON.stringify(entry.mismatches))
      }
      return entry
    } finally {
      set({ running: false })
    }
  },
}))

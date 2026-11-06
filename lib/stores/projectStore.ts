'use client'

import { create } from 'zustand'
import {
  collection,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import type { Project, Client } from '@/types'
import {
  buildProjectFirestorePayload,
  projectToSaveInput,
  projectCollectionName,
  type ProjectSaveInput,
} from '@/lib/firebase/projectPayload'
import { subscribeOrgCollectionLoaded, forgetOrgCollectionDoc, unsubscribeOrgCollection, type OrgCollectionDoc, type OrgCollectionSnapshotMeta } from '@/lib/firebase/subscribeOrgCollection'
import { forgetOrgPlanDoc, subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { jobPlanParts, webJobAccessViewer } from '@/lib/access/readPlan'
import { securitySwitchesReady } from '@/lib/access/securitySwitches'
import { userCanChangeJobManagers } from '@/lib/access/bookingAccess'
import { jobWriteWithoutManagerList } from '@/lib/canonical'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAuthStore } from '@/lib/stores/authStore'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { parseClient as parseClientDoc, projectFromJobDocument, serializeClient } from '@/lib/ios-parity/converters'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { clientWriteFields } from '@/lib/canonical/peopleDocuments'
import { jobWriteFields } from '@/lib/canonical/workDocumentReaders'
import {
  isLegacyPlaceholderDocumentId,
  withoutLegacyPlaceholderDocuments,
} from '@/lib/projects/legacyPlaceholderWork'
import { removeFutureBookingsForProject } from '@/lib/bookings/removeBookingsOnDelete'

/**
 * A job document as the web `Project`. Reading is the rulebook's `parseJobDocument` (§1): ids in stored case,
 * the client id as stored (never a fresh id), start day `startDate` else `createdAt`, end day `endDate` else the start.
 */
export function mapProjectDoc(
  docId: string,
  data: Record<string, unknown>,
  organizationId: string,
  collection?: 'projects' | 'smallWorks'
): Project {
  const project = projectFromJobDocument(docId, data, organizationId)
  // Rulebook 1.11.0 `jobKind`: the collection decides the kind, never `jobType`.
  return collection ? { ...project, collection } : project
}

interface ProjectState {
  projects: Project[]
  smallWorks: Project[]
  clients: Client[]
  /** Set when a load for that company has finished, including a genuine empty list. */
  projectsLoadedOrgId: string | null
  smallWorksLoadedOrgId: string | null
  loading: boolean
  error: string | null
  /**
   * Rulebook 1.21.0 §21: the store keeps every project document the reader accepts, live or not; lists ask
   * `worksListMembership` / `visibleJobs` and pickers `bookableJobs`. No caller can make the store drop jobs.
   */
  loadProjects: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  loadSmallWorks: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  loadClients: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  getProject: (organizationId: string, projectId: string, collection?: 'projects' | 'smallWorks') => Promise<Project | null>
  saveProject: (
    input: ProjectSaveInput,
    collection?: 'projects' | 'smallWorks',
    /** `base`: the job as the editor opened it. */
    options?: { base?: Project | null }
  ) => Promise<string>
  deleteProject: (id: string, organizationId: string, collection?: 'projects' | 'smallWorks') => Promise<void>
  createClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client>
  updateClient: (
    organizationId: string,
    clientId: string,
    updates: Partial<Pick<Client, 'name' | 'email' | 'phone' | 'contactPerson' | 'address'>>
  ) => Promise<Client>
  deleteClient: (organizationId: string, clientId: string) => Promise<void>
}

let projectsOrgId = ''
let smallWorksOrgId = ''
let clientsOrgId = ''
/** Operatives: the jobs of their own bookings, tasks and deadlines (`jobQueryPlan` documentIds), set by readPlanSync. */
let jobPlanDocumentIds: string[] = []

export function setJobPlanDocumentIds(ids: ReadonlyArray<string>): boolean {
  const next = [...new Set(ids.filter(Boolean))].sort()
  if (next.join('|') === jobPlanDocumentIds.join('|')) return false
  jobPlanDocumentIds = next
  return true
}

/**
 * Rulebook 1.10.0 §17: a viewer who may not read the whole collection runs `jobQueryPlan` (1.33.0: only an operative,
 * their own jobs by id); everyone else keeps the whole-collection listener. Firestore rules are not filters,
 * so the whole collection is never asked for on their behalf.
 */
function subscribeJobs(
  key: string,
  organizationId: string,
  kind: 'projects' | 'smallWorks',
  onDocs: (docs: OrgCollectionDoc[], meta?: OrgCollectionSnapshotMeta) => void
): Promise<void> {
  const parts = jobPlanParts(webJobAccessViewer(useAuthStore.getState().user), kind, jobPlanDocumentIds)
  const handle = (docs: OrgCollectionDoc[], meta?: OrgCollectionSnapshotMeta) => {
    onDocs(docs, meta)
    void import('@/lib/access/readPlanSync').then((sync) => sync.jobsChanged()).catch(() => undefined)
  }
  if (parts === null) {
    unsubscribeOrgPlan(key)
    return subscribeOrgCollectionLoaded(key, organizationId, kind, handle)
  }
  unsubscribeOrgCollection(key)
  return subscribeOrgPlan(key, organizationId, kind, parts, handle)
}

/** Re-run the job plans with the current viewer and inputs (role, toggles or an operative's bookings changed). */
export function replanJobs(): void {
  const state = useProjectStore.getState()
  if (projectsOrgId) void state.loadProjects(projectsOrgId).catch(() => undefined)
  if (smallWorksOrgId) void state.loadSmallWorks(smallWorksOrgId).catch(() => undefined)
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  smallWorks: [],
  clients: [],
  projectsLoadedOrgId: null,
  smallWorksLoadedOrgId: null,
  loading: false,
  error: null,

  // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): projects, small works and clients are live while the app is open. The
  // load is the listener's first snapshot; later edits on any platform arrive through the same listener, so there is
  // no time-to-live cache. `force` (the global Refresh) re-reads through `refreshOrgCollections`.
  loadProjects: async (organizationId, _options?: { force?: boolean }) => {
    void _options
    if (!organizationId) return
    // Rulebook 1.26.0: plan for the `enforcedReads` switch as the rules read it now (first read of platformConfig/app).
    await securitySwitchesReady()
    void import('@/lib/access/readPlanSync').then((sync) => sync.followSecuritySwitches()).catch(() => undefined)
    if (get().projects.length === 0 || projectsOrgId !== organizationId) set({ loading: true, error: null })
    else set({ error: null })
    try {
      const planMode = jobPlanParts(webJobAccessViewer(useAuthStore.getState().user), 'projects', jobPlanDocumentIds) !== null
      await subscribeJobs('projectStore:projects', organizationId, 'projects', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        let projects = docs
          .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
          .map((entry) => mapProjectDoc(entry.id, entry.data, organizationId, 'projects'))
        const previous = projectsOrgId === organizationId ? get().projects : []
        // A plan's parts are exact queries: a job that left them (manager removed) leaves the list now.
        projects = withoutLegacyPlaceholderDocuments(
          planMode ? projects : retainScopedRows(`projects:${organizationId}`, previous, projects, meta)
        )
        projectsOrgId = organizationId
        set({ projects, loading: false, projectsLoadedOrgId: organizationId })
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load projects', loading: false })
      throw error
    }
  },

  loadSmallWorks: async (organizationId, _options?: { force?: boolean }) => {
    void _options
    if (!organizationId) return
    // Rulebook 1.26.0: plan for the `enforcedReads` switch as the rules read it now (first read of platformConfig/app).
    await securitySwitchesReady()
    void import('@/lib/access/readPlanSync').then((sync) => sync.followSecuritySwitches()).catch(() => undefined)
    if (get().smallWorks.length === 0 || smallWorksOrgId !== organizationId) set({ loading: true, error: null })
    else set({ error: null })
    try {
      const planMode = jobPlanParts(webJobAccessViewer(useAuthStore.getState().user), 'smallWorks', jobPlanDocumentIds) !== null
      await subscribeJobs('projectStore:smallWorks', organizationId, 'smallWorks', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        const mapped = docs
          .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
          .map((entry) => mapProjectDoc(entry.id, entry.data, organizationId, 'smallWorks'))
        const previous = smallWorksOrgId === organizationId ? get().smallWorks : []
        const smallWorks = withoutLegacyPlaceholderDocuments(
          planMode ? mapped : retainScopedRows(`smallWorks:${organizationId}`, previous, mapped, meta)
        )
        smallWorksOrgId = organizationId
        set({ smallWorks, loading: false, smallWorksLoadedOrgId: organizationId })
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load small works', loading: false })
      throw error
    }
  },

  loadClients: async (organizationId, _options?: { force?: boolean }) => {
    void _options
    if (!organizationId) return
    try {
      await subscribeOrgCollectionLoaded('projectStore:clients', organizationId, 'clients', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        const clients: Client[] = []
        for (const entry of docs) {
          if (isLegacyPlaceholderDocumentId(entry.id)) continue
          const parsed = parseClientDoc(entry.id, entry.data, organizationId)
          if (!parsed.ok || isLegacyPlaceholderDocumentId(parsed.value.id)) continue
          clients.push(parsed.value)
        }
        const previous = clientsOrgId === organizationId ? get().clients : []
        const kept = withoutLegacyPlaceholderDocuments(retainScopedRows(`clients:${organizationId}`, previous, clients, meta))
        clientsOrgId = organizationId
        set({ clients: kept })
      })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load clients' })
      throw error
    }
  },

  getProject: async (organizationId, projectId, collectionName = 'projects') => {
    if (isLegacyPlaceholderDocumentId(projectId)) return null
    const needle = String(projectId || '').trim().toLowerCase()
    const cachedList = collectionName === 'smallWorks' ? get().smallWorks : get().projects
    const cached = cachedList.find((row) => row.id.toLowerCase() === needle)
    if (cached) return cached
    const snap = await getDoc(doc(db, 'organizations', organizationId, collectionName, projectId))
    if (!snap.exists() || isLegacyPlaceholderDocumentId(snap.id)) {
      const other = collectionName === 'smallWorks' ? get().projects : get().smallWorks
      return other.find((row) => row.id.toLowerCase() === needle && !isLegacyPlaceholderDocumentId(row.id)) || null
    }
    return mapProjectDoc(snap.id, snap.data() as Record<string, unknown>, organizationId, collectionName)
  },

  saveProject: async (input, collectionOverride, options) => {
    if (isLegacyPlaceholderDocumentId(input.id)) {
      throw new Error('Cannot save the legacy starter placeholder. Create a project with a job number and site name.')
    }
    // Rulebook 1.11.0 `jobKind`: an existing job stays in the collection it was read from, whatever its job type.
    const existingRow = [...get().projects, ...get().smallWorks].find((row) => row.id === input.id)
    const collectionName = collectionOverride || existingRow?.collection || projectCollectionName(input.jobType)
    const id = input.id || newUuid()
    const isNew = ![...get().projects, ...get().smallWorks].some((row) => row.id === id)
    const built = buildProjectFirestorePayload({ ...input, id })
    // Rulebook 1.10.0 §16 (`canChangeJobManagers`): a manager without the Projects / Small works toggle edits a job's
    // details but never its manager list — those fields are left as stored (`jobWriteWithoutManagerList`).
    const kind = collectionName === 'smallWorks' ? 'smallWorks' : 'projects'
    const mayChangeManagers = userCanChangeJobManagers(useAuthStore.getState().user, kind)
    const payload: Record<string, unknown> = mayChangeManagers ? built : jobWriteWithoutManagerList(built)
    if (!mayChangeManagers) delete payload.manager
    // The job as the editor opened it (else the store copy): the save writes what this editor changed, never a stale
    // field over another device's edit.
    const opened = isNew ? null : options?.base ?? existingRow ?? null
    let base: Record<string, unknown> | null = null
    if (opened) {
      const openedBuilt = buildProjectFirestorePayload(projectToSaveInput(opened, input.organizationId))
      base = mayChangeManagers ? openedBuilt : jobWriteWithoutManagerList(openedBuilt)
      if (!mayChangeManagers) delete base.manager
    }
    // Rulebook §1: a partial update of the changed fields (`jobWriteFields`), never a merge-set of the whole job.
    await savePartialDocument(doc(db, 'organizations', input.organizationId, collectionName, id), payload, jobWriteFields, {
      userId: auth.currentUser?.uid ?? null,
      // Rulebook 1.9.0: an edit of a job deleted on another device is refused, never re-created.
      missing: isNew ? 'create' : 'refuse',
      base,
    })
    const saved = mapProjectDoc(id, payload as Record<string, unknown>, input.organizationId, collectionName)
    if (collectionName === 'smallWorks') {
      const { smallWorks } = get()
      set({ smallWorks: [...smallWorks.filter((p) => p.id !== id), saved] })
    } else {
      const { projects } = get()
      set({ projects: [...projects.filter((p) => p.id !== id), saved] })
    }
    void trackEvent(isNew ? (collectionName === 'smallWorks' ? 'small_work_created' : 'project_created') : 'project_updated', {
      userId: useAuthStore.getState().user?.id,
      organizationId: input.organizationId,
      metadata: { projectId: id, collection: collectionName },
    })
    return id
  },

  deleteProject: async (id, organizationId, collectionName = 'projects') => {
    // Rulebook: bookings from today on go with the job; past ones stay as "Deleted job".
    await removeFutureBookingsForProject(db, { organizationId, projectId: id })
    await deleteDoc(doc(db, 'organizations', organizationId, collectionName, id))
    markRowsRemoved(`${collectionName === 'smallWorks' ? 'smallWorks' : 'projects'}:${organizationId}`, [id])
    forgetOrgCollectionDoc(collectionName === 'smallWorks' ? 'projectStore:smallWorks' : 'projectStore:projects', organizationId, id)
    forgetOrgPlanDoc(collectionName === 'smallWorks' ? 'projectStore:smallWorks' : 'projectStore:projects', organizationId, id)
    if (collectionName === 'smallWorks') {
      set({ smallWorks: get().smallWorks.filter((p) => p.id !== id) })
    } else {
      set({ projects: get().projects.filter((p) => p.id !== id) })
    }
  },

  createClient: async (clientData) => {
    const organizationId = clientData.organizationId || ''
    const now = new Date()
    const id = newUuid()
    const client: Client = {
      ...clientData,
      id,
      name: clientData.name.trim(),
      contactPerson: clientData.contactPerson?.trim() || undefined,
      email: clientData.email?.trim() || undefined,
      phone: clientData.phone?.trim() || undefined,
      address: clientData.address?.trim() || undefined,
      organizationId,
      createdAt: now,
      updatedAt: now,
    }
    const payload = serializeClient(client)
    await setDoc(doc(db, 'organizations', organizationId, 'clients', id), payload)
    set({ clients: [...get().clients, client] })
    return client
  },

  updateClient: async (organizationId, clientId, updates) => {
    const existing = get().clients.find((c) => c.id === clientId)
    if (!existing) throw new Error('Client not found')

    const base: Record<string, unknown> = {
      name: existing.name,
      email: existing.email ?? '',
      phone: existing.phone ?? '',
      contactPerson: existing.contactPerson ?? '',
      address: existing.address ?? '',
    }
    const payload: Record<string, unknown> = {
      name: updates.name?.trim() ?? existing.name,
      email: updates.email?.trim() ?? existing.email ?? '',
      phone: updates.phone?.trim() ?? existing.phone ?? '',
      contactPerson: updates.contactPerson?.trim() ?? existing.contactPerson ?? '',
      address: updates.address?.trim() ?? existing.address ?? '',
      updatedAt: Timestamp.now(),
    }

    // Partial update of the changed fields only (rulebook §1, `clientWriteFields`).
    await savePartialDocument(doc(db, 'organizations', organizationId, 'clients', clientId), payload, clientWriteFields, {
      userId: auth?.currentUser?.uid,
      missing: 'refuse',
      // Only the fields this edit changed from the client it started from.
      base,
    })

    const updated: Client = {
      ...existing,
      ...updates,
      name: String(payload.name),
      email: payload.email ? String(payload.email) : undefined,
      phone: payload.phone ? String(payload.phone) : undefined,
      updatedAt: new Date(),
    }
    set({ clients: get().clients.map((c) => (c.id === clientId ? updated : c)) })
    return updated
  },

  deleteClient: async (organizationId, clientId) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'clients', clientId))
    markRowsRemoved(`clients:${organizationId}`, [clientId])
    forgetOrgCollectionDoc('projectStore:clients', organizationId, clientId)
    set({ clients: get().clients.filter((c) => c.id !== clientId) })
  },
}))

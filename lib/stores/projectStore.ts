'use client'

import { create } from 'zustand'
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { Project, Client } from '@/types'
import {
  buildProjectFirestorePayload,
  projectCollectionName,
  type ProjectSaveInput,
} from '@/lib/firebase/projectPayload'
import { optionsForUnappliedOrg, runOrgLoad } from '@/lib/stores/orgLoadCache'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAuthStore } from '@/lib/stores/authStore'
import { parseFirestoreDate, parseNumber, parseOptionalString, parseString, newUuid } from '@/lib/firebase/firestoreUtils'
import { parseClient as parseClientDoc, serializeClient } from '@/lib/ios-parity/converters'
import {
  isLegacyPlaceholderDocumentId,
  withoutLegacyPlaceholderDocuments,
} from '@/lib/projects/legacyPlaceholderWork'

function parseClient(data: unknown): Client {
  const c = (data || {}) as Record<string, unknown>
  return {
    id: parseString(c.id),
    name: parseString(c.name),
    email: parseOptionalString(c.email),
    phone: parseOptionalString(c.phone),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function mapProjectDoc(docId: string, data: Record<string, unknown>, organizationId: string): Project {
  const managerIds = Array.isArray(data.managerIds)
    ? (data.managerIds as string[]).filter((id) => typeof id === 'string')
    : data.managerId
      ? [parseString(data.managerId)]
      : []

  return {
    id: docId,
    jobNumber: parseString(data.jobNumber),
    siteName: parseString(data.siteName),
    addressLine1: parseString(data.addressLine1),
    addressLine2: parseOptionalString(data.addressLine2),
    townCity: parseString(data.townCity),
    postcode: parseString(data.postcode),
    client: parseClient(data.client),
    startDate: parseFirestoreDate(data.startDate) || new Date(),
    endDate: parseFirestoreDate(data.endDate) || new Date(),
    jobType: parseString(data.jobType, 'CAT A'),
    customJobType: parseOptionalString(data.customJobType),
    manager: {
      name: parseString(data.manager, 'Project Manager'),
      email: '',
    },
    managerId: parseOptionalString(data.managerId) || managerIds[0],
    managerIds,
    isLive: data.isLive !== false,
    description: parseOptionalString(data.description),
    notes: parseOptionalString(data.notes),
    siteAddress: parseOptionalString(data.siteAddress),
    latitude: parseNumber(data.latitude),
    longitude: parseNumber(data.longitude),
    usesMapPinForLocation: data.usesMapPinForLocation === true,
    hiddenManagerUserIds: Array.isArray(data.hiddenManagerUserIds)
      ? (data.hiddenManagerUserIds as string[]).filter((id) => typeof id === 'string')
      : [],
    hiddenOperativeUserIds: Array.isArray(data.hiddenOperativeUserIds)
      ? (data.hiddenOperativeUserIds as string[]).filter((id) => typeof id === 'string')
      : [],
    status: parseOptionalString(data.status),
    organizationId,
    createdAt: parseFirestoreDate(data.createdAt) || new Date(),
    updatedAt: parseFirestoreDate(data.updatedAt) || new Date(),
  }
}

interface ProjectState {
  projects: Project[]
  smallWorks: Project[]
  clients: Client[]
  loading: boolean
  error: string | null
  loadProjects: (organizationId: string, includeInactive?: boolean, options?: { force?: boolean }) => Promise<void>
  loadSmallWorks: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  loadClients: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  getProject: (organizationId: string, projectId: string, collection?: 'projects' | 'smallWorks') => Promise<Project | null>
  saveProject: (input: ProjectSaveInput, collection?: 'projects' | 'smallWorks') => Promise<string>
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  smallWorks: [],
  clients: [],
  loading: false,
  error: null,

  loadProjects: async (organizationId, includeInactive = false, options?: { force?: boolean }) => {
    const cacheKey = `projectStore:projects:${includeInactive ? 'all' : 'live'}`
    const loadOptions = optionsForUnappliedOrg(cacheKey, organizationId, projectsOrgId === organizationId, options)
    await runOrgLoad(
      cacheKey,
      organizationId,
      async () => {
        if (get().projects.length === 0) set({ loading: true, error: null })
        else set({ error: null })
        try {
          const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'projects'))
          let projects = snapshot.docs
            .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
            .map((entry) => mapProjectDoc(entry.id, entry.data() as Record<string, unknown>, organizationId))
          if (!includeInactive) projects = projects.filter((p) => p.isLive)
          const previous = projectsOrgId === organizationId ? get().projects : []
          projects = withoutLegacyPlaceholderDocuments(
            retainScopedRows(`projects:${organizationId}`, previous, projects)
          )
          projectsOrgId = organizationId
          set({ projects, loading: false })
        } catch (error: unknown) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load projects',
            loading: false,
          })
          throw error
        }
      },
      loadOptions
    )
  },

  loadSmallWorks: async (organizationId, options?: { force?: boolean }) => {
    const loadOptions = optionsForUnappliedOrg(
      'projectStore:smallWorks',
      organizationId,
      smallWorksOrgId === organizationId,
      options
    )
    await runOrgLoad(
      'projectStore:smallWorks',
      organizationId,
      async () => {
        if (get().smallWorks.length === 0) set({ loading: true, error: null })
        else set({ error: null })
        try {
          const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'smallWorks'))
          const mapped = snapshot.docs
            .filter((entry) => !isLegacyPlaceholderDocumentId(entry.id))
            .map((entry) => mapProjectDoc(entry.id, entry.data() as Record<string, unknown>, organizationId))
          const previous = smallWorksOrgId === organizationId ? get().smallWorks : []
          const smallWorks = withoutLegacyPlaceholderDocuments(
            retainScopedRows(`smallWorks:${organizationId}`, previous, mapped)
          )
          smallWorksOrgId = organizationId
          set({ smallWorks, loading: false })
        } catch (error: unknown) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load small works',
            loading: false,
          })
          throw error
        }
      },
      loadOptions
    )
  },

  loadClients: async (organizationId, options?: { force?: boolean }) => {
    await runOrgLoad(
      'projectStore:clients',
      organizationId,
      async () => {
        try {
          const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'clients'))
          const clients: Client[] = []
          for (const entry of snapshot.docs) {
            if (isLegacyPlaceholderDocumentId(entry.id)) continue
            const parsed = parseClientDoc(entry.id, entry.data() as Record<string, unknown>, organizationId)
            if (!parsed.ok || isLegacyPlaceholderDocumentId(parsed.value.id)) continue
            clients.push(parsed.value)
          }
          const previous = clientsOrgId === organizationId ? get().clients : []
          const kept = withoutLegacyPlaceholderDocuments(
            retainScopedRows(
              `clients:${organizationId}`,
              previous,
              clients.filter((client) => !isLegacyPlaceholderDocumentId(client.id))
            )
          )
          clientsOrgId = organizationId
          set({ clients: kept })
        } catch (error: unknown) {
          set({ error: error instanceof Error ? error.message : 'Failed to load clients' })
          throw error
        }
      },
      options
    )
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
    return mapProjectDoc(snap.id, snap.data() as Record<string, unknown>, organizationId)
  },

  saveProject: async (input, collectionOverride) => {
    if (isLegacyPlaceholderDocumentId(input.id)) {
      throw new Error('Cannot save the legacy starter placeholder. Create a project with a job number and site name.')
    }
    const collectionName = collectionOverride || projectCollectionName(input.jobType)
    const id = input.id || newUuid()
    const isNew = ![...get().projects, ...get().smallWorks].some((row) => row.id === id)
    const payload = buildProjectFirestorePayload({ ...input, id })
    await setDoc(doc(db, 'organizations', input.organizationId, collectionName, id), payload, { merge: true })
    const saved = mapProjectDoc(id, payload as Record<string, unknown>, input.organizationId)
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
    await deleteDoc(doc(db, 'organizations', organizationId, collectionName, id))
    markRowsRemoved(`${collectionName === 'smallWorks' ? 'smallWorks' : 'projects'}:${organizationId}`, [id])
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

    const payload: Record<string, unknown> = {
      name: updates.name?.trim() ?? existing.name,
      email: updates.email?.trim() ?? existing.email ?? '',
      phone: updates.phone?.trim() ?? existing.phone ?? '',
      contactPerson: updates.contactPerson?.trim() ?? existing.contactPerson ?? '',
      address: updates.address?.trim() ?? existing.address ?? '',
      updatedAt: Timestamp.now(),
    }

    await setDoc(doc(db, 'organizations', organizationId, 'clients', clientId), payload, { merge: true })

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
    set({ clients: get().clients.filter((c) => c.id !== clientId) })
  },
}))

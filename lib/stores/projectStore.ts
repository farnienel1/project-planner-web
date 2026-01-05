'use client'

import { create } from 'zustand'
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { Project, Client } from '@/types'
import { JobType } from '@/types'

interface ProjectState {
  projects: Project[]
  clients: Client[]
  loading: boolean
  error: string | null
  loadProjects: (organizationId: string) => Promise<void>
  loadClients: (organizationId: string) => Promise<void>
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string, organizationId: string) => Promise<void>
  createClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  clients: [],
  loading: false,
  error: null,
  
  loadProjects: async (organizationId: string) => {
    set({ loading: true, error: null })
    try {
      const projectsRef = collection(db, 'organizations', organizationId, 'projects')
      const snapshot = await getDocs(projectsRef)
      const projects = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          jobNumber: data.jobNumber || '',
          siteName: data.siteName || '',
          addressLine1: data.addressLine1 || '',
          addressLine2: data.addressLine2,
          townCity: data.townCity || '',
          postcode: data.postcode || '',
          client: data.client || { id: '', name: '', createdAt: new Date(), updatedAt: new Date() },
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          jobType: (data.jobType as JobType) || JobType.PROJECT,
          customJobType: data.customJobType,
          manager: data.manager || { name: '', email: '' },
          managerId: data.managerId,
          isLive: data.isLive !== false,
          description: data.description,
          notes: data.notes,
          organizationId: organizationId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Project
      }).filter(p => p.isLive)
      set({ projects, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },
  
  loadClients: async (organizationId: string) => {
    try {
      const clientsRef = collection(db, 'organizations', organizationId, 'clients')
      const snapshot = await getDocs(clientsRef)
      const clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Client[]
      set({ clients })
    } catch (error: any) {
      set({ error: error.message })
    }
  },
  
  createProject: async (projectData) => {
    const { projects } = get()
    const organizationId = projectData.organizationId || ''
    
    try {
      const projectRef = collection(db, 'organizations', organizationId, 'projects')
      const newProject = {
        ...projectData,
        startDate: Timestamp.fromDate(new Date(projectData.startDate)),
        endDate: Timestamp.fromDate(new Date(projectData.endDate)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const docRef = await addDoc(projectRef, newProject)
      set({ 
        projects: [...projects, { ...projectData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as Project]
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  updateProject: async (id, updates) => {
    const { projects, clients } = get()
    const project = projects.find(p => p.id === id)
    if (!project) return
    
    const organizationId = project.client.organizationId || ''
    
    try {
      const projectRef = doc(db, 'organizations', organizationId, 'projects', id)
      await updateDoc(projectRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      })
      set({ 
        projects: projects.map(p => 
          p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
        )
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  deleteProject: async (id, organizationId) => {
    const { projects } = get()
    try {
      const projectRef = doc(db, 'organizations', organizationId, 'projects', id)
      await deleteDoc(projectRef)
      set({ projects: projects.filter(p => p.id !== id) })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  createClient: async (clientData) => {
    const { clients } = get()
    const organizationId = clientData.organizationId || ''
    
    try {
      const clientsRef = collection(db, 'organizations', organizationId, 'clients')
      const newClient = {
        name: clientData.name,
        email: clientData.email || '',
        phone: clientData.phone || '',
        address: clientData.address || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const docRef = await addDoc(clientsRef, newClient)
      set({ 
        clients: [...clients, { ...clientData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as Client]
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
}))

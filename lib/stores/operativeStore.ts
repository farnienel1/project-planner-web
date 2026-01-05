'use client'

import { create } from 'zustand'
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { Operative, Manager, Skill, Qualification } from '@/types'

interface OperativeState {
  operatives: Operative[]
  managers: Manager[]
  skills: Skill[]
  qualifications: Qualification[]
  loading: boolean
  error: string | null
  loadOperatives: (organizationId: string) => Promise<void>
  loadManagers: (organizationId: string) => Promise<void>
  loadSkills: (organizationId: string) => Promise<void>
  loadQualifications: (organizationId: string) => Promise<void>
  createOperative: (operative: Omit<Operative, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateOperative: (id: string, updates: Partial<Operative>) => Promise<void>
  deleteOperative: (id: string, organizationId: string) => Promise<void>
  createManager: (manager: Omit<Manager, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateManager: (id: string, updates: Partial<Manager>) => Promise<void>
}

export const useOperativeStore = create<OperativeState>((set, get) => ({
  operatives: [],
  managers: [],
  skills: [],
  qualifications: [],
  loading: false,
  error: null,
  
  loadOperatives: async (organizationId: string) => {
    set({ loading: true, error: null })
    try {
      const operativesRef = collection(db, 'organizations', organizationId, 'operatives')
      const snapshot = await getDocs(operativesRef)
      const operatives = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone,
          startDate: data.startDate?.toDate() || new Date(),
          hourlyRate: data.hourlyRate || 0,
          skills: data.skills || [],
          qualifications: data.qualifications || [],
          isActive: data.isActive !== false,
          organizationId: organizationId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Operative
      }).filter(o => o.isActive)
      set({ operatives, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },
  
  loadManagers: async (organizationId: string) => {
    try {
      const managersRef = collection(db, 'organizations', organizationId, 'managers')
      const snapshot = await getDocs(managersRef)
      const managers = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone,
          mobile: data.mobile,
          department: data.department,
          isActive: data.isActive !== false,
          organizationId: organizationId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Manager
      }).filter(m => m.isActive)
      set({ managers })
    } catch (error: any) {
      set({ error: error.message })
    }
  },
  
  loadSkills: async (organizationId: string) => {
    try {
      const skillsRef = collection(db, 'organizations', organizationId, 'skills')
      const snapshot = await getDocs(skillsRef)
      const skills = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Skill[]
      set({ skills })
    } catch (error: any) {
      set({ error: error.message })
    }
  },
  
  loadQualifications: async (organizationId: string) => {
    try {
      const qualsRef = collection(db, 'organizations', organizationId, 'qualifications')
      const snapshot = await getDocs(qualsRef)
      const qualifications = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          endDate: data.endDate?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Qualification
      })
      set({ qualifications })
    } catch (error: any) {
      set({ error: error.message })
    }
  },
  
  createOperative: async (operativeData) => {
    const { operatives } = get()
    const organizationId = operativeData.organizationId || ''
    
    try {
      const operativesRef = collection(db, 'organizations', organizationId, 'operatives')
      const newOperative = {
        ...operativeData,
        startDate: Timestamp.fromDate(new Date(operativeData.startDate)),
        skills: operativeData.skills || [],
        qualifications: operativeData.qualifications || [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const docRef = await addDoc(operativesRef, newOperative)
      set({ 
        operatives: [...operatives, { ...operativeData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as Operative]
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  updateOperative: async (id, updates) => {
    const { operatives } = get()
    const operative = operatives.find(o => o.id === id)
    if (!operative) return
    
    const organizationId = operative.organizationId || ''
    
    try {
      const operativeRef = doc(db, 'organizations', organizationId, 'operatives', id)
      await updateDoc(operativeRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      })
      set({ 
        operatives: operatives.map(o => 
          o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o
        )
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  deleteOperative: async (id, organizationId) => {
    const { operatives } = get()
    try {
      const operativeRef = doc(db, 'organizations', organizationId, 'operatives', id)
      await deleteDoc(operativeRef)
      set({ operatives: operatives.filter(o => o.id !== id) })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  createManager: async (managerData) => {
    const { managers } = get()
    const organizationId = managerData.organizationId || ''
    
    try {
      const managersRef = collection(db, 'organizations', organizationId, 'managers')
      const newManager = {
        ...managerData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const docRef = await addDoc(managersRef, newManager)
      set({ 
        managers: [...managers, { ...managerData, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as Manager]
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  updateManager: async (id, updates) => {
    const { managers } = get()
    const manager = managers.find(m => m.id === id)
    if (!manager) return
    
    const organizationId = manager.organizationId || ''
    
    try {
      const managerRef = doc(db, 'organizations', organizationId, 'managers', id)
      await updateDoc(managerRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      })
      set({ 
        managers: managers.map(m => 
          m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m
        )
      })
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
}))

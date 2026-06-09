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
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { db } from '@/lib/firebase/config'
import type { Operative, Manager, Skill, Qualification } from '@/types'
import { filterRealManagers, isPlaceholderManager } from '@/lib/staff/managerRosterUtils'

interface OperativeState {
  operatives: Operative[]
  managers: Manager[]
  placeholderManagerCount: number
  skills: Skill[]
  qualifications: Qualification[]
  loading: boolean
  error: string | null
  loadOperatives: (organizationId: string) => Promise<void>
  loadManagers: (organizationId: string) => Promise<void>
  loadSkills: (organizationId: string) => Promise<void>
  loadQualifications: (organizationId: string) => Promise<void>
  getOperative: (organizationId: string, id: string) => Promise<Operative | null>
  getManager: (organizationId: string, id: string) => Promise<Manager | null>
  saveOperative: (organizationId: string, operative: Operative) => Promise<string>
  saveManager: (organizationId: string, manager: Manager) => Promise<string>
  deleteOperative: (id: string, organizationId: string) => Promise<void>
  deleteManager: (id: string, organizationId: string) => Promise<void>
  cleanupLegacyPlaceholderManagers: (organizationId: string) => Promise<number>
}

export const useOperativeStore = create<OperativeState>((set, get) => ({
  operatives: [],
  managers: [],
  placeholderManagerCount: 0,
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
        const qualificationExpiryDates: Record<string, Date> = {}
        if (data.qualificationExpiryDates && typeof data.qualificationExpiryDates === 'object') {
          for (const [key, value] of Object.entries(data.qualificationExpiryDates as Record<string, unknown>)) {
            const date = (value as { toDate?: () => Date })?.toDate?.()
            if (date) qualificationExpiryDates[key] = date
          }
        }
        const qualificationCertificateURLs: Record<string, string> = {}
        if (data.qualificationCertificateURLs && typeof data.qualificationCertificateURLs === 'object') {
          for (const [key, value] of Object.entries(data.qualificationCertificateURLs as Record<string, string>)) {
            if (typeof value === 'string') qualificationCertificateURLs[key] = value
          }
        }
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
          qualificationExpiryDates,
          qualificationCertificateURLs,
          isActive: data.isActive !== false,
          organizationId: organizationId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Operative
      })
      set({ operatives, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },
  
  loadManagers: async (organizationId: string) => {
    try {
      const managersRef = collection(db, 'organizations', organizationId, 'managers')
      const snapshot = await getDocs(managersRef)
      const allManagers = snapshot.docs.map(doc => {
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
      })
      set({
        managers: filterRealManagers(allManagers),
        placeholderManagerCount: allManagers.filter(isPlaceholderManager).length,
      })
    } catch (error: any) {
      set({ error: error.message })
    }
  },
  
  loadSkills: async (organizationId: string) => {
    try {
      const skillsRef = collection(db, 'organizations', organizationId, 'skills')
      const snapshot = await getDocs(skillsRef)
      const skills = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name,
          trade: typeof data.trade === 'string' ? data.trade.trim() : '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      }) as Skill[]
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
  
  getOperative: async (organizationId, id) => {
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'operatives', id))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      id: snap.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone,
      startDate: data.startDate?.toDate() || new Date(),
      hourlyRate: data.hourlyRate || data.dayRate || 0,
      skills: data.skills || [],
      qualifications: data.qualifications || [],
      isActive: data.isActive !== false,
      organizationId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Operative
  },

  getManager: async (organizationId, id) => {
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'managers', id))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      id: snap.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone,
      mobile: data.mobileNumber || data.mobile,
      department: data.department,
      isActive: data.isActive !== false,
      organizationId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Manager
  },

  saveOperative: async (organizationId, operative) => {
    const id = operative.id || newUuid()
    const payload = {
      id,
      firstName: operative.firstName.trim(),
      lastName: operative.lastName.trim(),
      name: `${operative.firstName} ${operative.lastName}`.trim(),
      email: operative.email.trim(),
      phone: operative.phone || '',
      startDate: Timestamp.fromDate(operative.startDate),
      skills: operative.skills || [],
      qualifications: operative.qualifications || [],
      isActive: operative.isActive,
      hourlyRate: operative.hourlyRate || 0,
      currencySymbol: '£',
      notes: '',
      dayRate: operative.hourlyRate || 0,
      tradeTypePreset: '',
      tradeTypeCustom: '',
      organizationId,
      createdAt: Timestamp.fromDate(operative.createdAt || new Date()),
      updatedAt: Timestamp.now(),
    }
    await setDoc(doc(db, 'organizations', organizationId, 'operatives', id), payload)
    const saved = { ...operative, id, updatedAt: new Date() }
    set({ operatives: [...get().operatives.filter((o) => o.id !== id), saved] })
    return id
  },

  saveManager: async (organizationId, manager) => {
    const id = manager.id || newUuid()
    const payload = {
      id,
      firstName: manager.firstName.trim(),
      lastName: manager.lastName.trim(),
      email: manager.email.trim(),
      mobileNumber: manager.mobile || manager.phone || '',
      department: manager.department || '',
      isActive: manager.isActive,
      notes: '',
      tradeTypePreset: '',
      tradeTypeCustom: '',
      organizationId,
      createdAt: Timestamp.fromDate(manager.createdAt || new Date()),
      updatedAt: Timestamp.now(),
    }
    await setDoc(doc(db, 'organizations', organizationId, 'managers', id), payload)
    const saved = { ...manager, id, updatedAt: new Date() }
    set({ managers: [...get().managers.filter((m) => m.id !== id), saved] })
    return id
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
  
  deleteManager: async (id, organizationId) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'managers', id))
    set({ managers: get().managers.filter((m) => m.id !== id) })
  },

  cleanupLegacyPlaceholderManagers: async (organizationId) => {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'managers'))
    const placeholderIds = snapshot.docs
      .map((entry) => {
        const data = entry.data()
        const manager = {
          id: entry.id,
          firstName: String(data.firstName || ''),
          lastName: String(data.lastName || ''),
          email: String(data.email || ''),
        } as Manager
        return isPlaceholderManager(manager) ? entry.id : null
      })
      .filter((id): id is string => Boolean(id))

    for (const id of placeholderIds) {
      await deleteDoc(doc(db, 'organizations', organizationId, 'managers', id))
    }

    await get().loadManagers(organizationId)
    return placeholderIds.length
  },
}))





'use client'

import { create } from 'zustand'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import type { Operative, User, UserPermissions } from '@/types'
import { auth, db } from '@/lib/firebase/config'
import { buildSaveUserPayload } from '@/lib/firebase/userPayload'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'

interface UserStoreState {
  saving: boolean
  error: string | null
  getUser: (userId: string) => Promise<User | null>
  saveUser: (user: User) => Promise<void>
  setUserActive: (userId: string, isActive: boolean) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  applyAccountType: (user: User, accountType: 'operative' | 'manager' | 'admin') => User
  syncLinkedOperative: (organizationId: string, user: User, operatives: Operative[]) => Promise<void>
}

function permissionsForAccountType(accountType: 'operative' | 'manager' | 'admin'): UserPermissions {
  const base: UserPermissions = {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: false,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    siteAudit: true,
    subContractors: false,
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
  }

  if (accountType === 'admin') {
    return {
      ...base,
      adminAccess: true,
      manager: true,
      operatives: true,
      skills: true,
      qualifications: true,
      subContractors: true,
    }
  }

  if (accountType === 'manager') {
    return {
      ...base,
      manager: true,
      operatives: true,
      skills: true,
      qualifications: true,
      subContractors: true,
    }
  }

  return { ...base, operativeMode: true, materials: true, siteAudit: true }
}

export const useUserStore = create<UserStoreState>(() => ({
  saving: false,
  error: null,

  getUser: async (userId) => {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    return parseOrgUser(snap.id, snap.data() as Record<string, unknown>)
  },

  saveUser: async (user) => {
    await setDoc(doc(db, 'users', user.id), buildSaveUserPayload(user), { merge: true })
    await setDoc(doc(db, 'organizations', user.organizationId, 'userEmails', user.email.toLowerCase().trim()), {
      userId: user.id,
    })
  },

  setUserActive: async (userId, isActive) => {
    await updateDoc(doc(db, 'users', userId), { isActive, updatedAt: Timestamp.now() })
  },

  deleteUser: async (userId) => {
    await deleteDoc(doc(db, 'users', userId))
  },

  sendPasswordReset: async (email) => {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim())
  },

  applyAccountType: (user, accountType) => ({
    ...user,
    permissions: permissionsForAccountType(accountType),
    isSuperAdmin: accountType === 'admin' ? user.isSuperAdmin : false,
  }),

  syncLinkedOperative: async (organizationId, user, operatives) => {
    if (!user.permissions.operativeMode) return
    const linked = findOperativeForUser(user, operatives)
    if (!linked) return

    await setDoc(
      doc(db, 'organizations', organizationId, 'operatives', linked.id),
      {
        firstName: user.firstName.trim(),
        lastName: user.surname.trim(),
        name: `${user.firstName} ${user.surname}`.trim(),
        email: user.email.trim(),
        isActive: user.isActive,
        ...(user.dayRate != null && user.dayRate > 0
          ? { dayRate: user.dayRate, hourlyRate: user.dayRate }
          : {}),
        ...(user.tradeTypePreset ? { tradeTypePreset: user.tradeTypePreset } : {}),
        ...(user.tradeTypeCustom ? { tradeTypeCustom: user.tradeTypeCustom } : {}),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  },
}))

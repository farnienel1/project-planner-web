'use client'

import { create } from 'zustand'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, Timestamp, where } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import type { Operative, User } from '@/types'
import { auth, db } from '@/lib/firebase/config'
import { applyExclusiveRateFields, buildSaveUserPayload } from '@/lib/firebase/userPayload'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { applyAccountTypeChange } from '@/lib/staff/accountTypeChange'

interface UserStoreState {
  saving: boolean
  error: string | null
  getUser: (userId: string) => Promise<User | null>
  saveUser: (user: User, organizationId?: string, previousEmail?: string) => Promise<void>
  transferSuperAdmin: (organizationId: string, fromUserId: string, toUserId: string, roster: User[]) => Promise<void>
  setUserActive: (userId: string, isActive: boolean, organizationId?: string) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  applyAccountType: (user: User, accountType: 'operative' | 'manager' | 'admin') => User
  syncLinkedOperative: (organizationId: string, user: User, operatives: Operative[]) => Promise<void>
}

function identityFields(user: User): Record<string, unknown> {
  const firstName = user.firstName.trim()
  const surname = user.surname.trim()
  const displayName = `${firstName} ${surname}`.trim()
  return {
    firstName,
    surname,
    lastName: surname,
    name: displayName,
    displayName,
    updatedAt: Timestamp.now(),
  }
}

async function updateSameEmailUsers(user: User, previousEmail?: string): Promise<void> {
  const emails = [user.email, previousEmail || '']
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, all) => value.includes('@') && all.indexOf(value) === index)
  for (const email of emails) {
    const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(10)))
    for (const entry of snapshot.docs) {
      if (entry.id === user.id) continue
      await updateDoc(entry.ref, identityFields(user))
    }
  }
}

async function updateLinkedStaffNames(organizationId: string, user: User, previousEmail?: string): Promise<void> {
  const emails = new Set(
    [user.email, previousEmail || ''].map((value) => value.trim().toLowerCase()).filter(Boolean)
  )
  if (emails.size === 0) return
  const fields = identityFields(user)
  for (const collectionName of ['operatives', 'managers'] as const) {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, collectionName))
    for (const entry of snapshot.docs) {
      const email = String(entry.data().email || '').trim().toLowerCase()
      if (!emails.has(email)) continue
      await updateDoc(entry.ref, fields)
    }
  }
}

async function writeMembershipFlags(
  userId: string,
  organizationId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const ref = doc(db, 'users', userId, 'orgMemberships', organizationId)
  try {
    await updateDoc(ref, fields)
  } catch (error) {
    const code = (error as { code?: string }).code || ''
    if (code !== 'not-found') return
    const nested: Record<string, unknown> = { ...fields }
    if (nested['permissions.adminAccess'] === true) {
      delete nested['permissions.adminAccess']
      nested.permissions = { adminAccess: true }
    }
    await setDoc(ref, nested, { merge: true })
  }
}

const roleFields = {
  isSuperAdmin: false,
  adminAccess: true,
  role: 'admin',
  'permissions.adminAccess': true,
} as const

export const useUserStore = create<UserStoreState>(() => ({
  saving: false,
  error: null,

  getUser: async (userId) => {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    const orgOnDoc = typeof data.organizationId === 'string' ? data.organizationId.trim() : ''
    if (orgOnDoc) return parseOrgUser(snap.id, data)
    const { useAuthStore } = await import('@/lib/stores/authStore')
    const fallback = useAuthStore.getState().organization?.id || useAuthStore.getState().user?.organizationId || ''
    if (!fallback) return parseOrgUser(snap.id, data)
    return parseOrgUser(snap.id, { ...data, organizationId: fallback })
  },

  saveUser: async (user, organizationId, previousEmail) => {
    const names = identityFields(user)
    const payload = buildSaveUserPayload(user)
    delete payload.organizationId
    Object.assign(payload, names)
    await updateDoc(doc(db, 'users', user.id), payload)
    const orgId = organizationId?.trim() || user.organizationId
    const email = user.email.toLowerCase().trim()
    if (orgId && email) {
      await setDoc(doc(db, 'organizations', orgId, 'userEmails', email), { userId: user.id })
    }
    await updateSameEmailUsers(user, previousEmail)
    if (orgId) await updateLinkedStaffNames(orgId, user, previousEmail)
    if (
      orgId &&
      (user.permissions.operativeMode ||
        user.permissions.manager ||
        user.permissions.adminAccess ||
        user.isSuperAdmin)
    ) {
      const profile: Record<string, unknown> = { userId: user.id, updatedAt: Timestamp.now() }
      applyExclusiveRateFields(profile, user)
      await setDoc(doc(db, 'organizations', orgId, 'operativeProfiles', user.id), profile, { merge: true })
    }
  },

  transferSuperAdmin: async (organizationId, fromUserId, toUserId, roster) => {
    if (!organizationId || !toUserId || fromUserId === toUserId) return
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const previousCreator = orgSnap.exists() ? String(orgSnap.data().creatorUserId || '') : ''
    const updatedAt = Timestamp.now()
    await updateDoc(doc(db, 'organizations', organizationId), { creatorUserId: toUserId, updatedAt })

    const demote = new Set<string>()
    for (const person of roster) {
      if (person.isSuperAdmin) demote.add(person.id)
    }
    if (fromUserId) demote.add(fromUserId)
    if (previousCreator) demote.add(previousCreator)
    demote.delete(toUserId)

    const promote = { isSuperAdmin: true, adminAccess: true, role: 'admin', 'permissions.adminAccess': true, updatedAt }
    await updateDoc(doc(db, 'users', toUserId), promote)
    await writeMembershipFlags(toUserId, organizationId, promote)

    for (const userId of demote) {
      const demotion = { ...roleFields, updatedAt }
      await updateDoc(doc(db, 'users', userId), demotion)
      await writeMembershipFlags(userId, organizationId, demotion)
    }
  },

  setUserActive: async (userId, isActive, organizationId) => {
    if (!isActive) {
      const existing = await getDoc(doc(db, 'users', userId))
      if (existing.exists() && existing.data().isSuperAdmin === true) {
        throw new Error('The super admin cannot be deactivated.')
      }
    }
    const updatedAt = Timestamp.now()
    await updateDoc(doc(db, 'users', userId), { isActive, updatedAt })
    const orgId = organizationId?.trim()
    if (!orgId) return
    // Admins can update a membership but cannot read another user's membership doc.
    // A get() here throws "Missing or insufficient permissions" and the screen rolls the toggle back.
    try {
      await updateDoc(doc(db, 'users', userId, 'orgMemberships', orgId), { accountActive: isActive, updatedAt })
    } catch (error) {
      const code = (error as { code?: string }).code || ''
      if (code === 'not-found' || code === 'permission-denied') return
      throw error
    }
  },

  deleteUser: async (userId) => {
    const existing = await getDoc(doc(db, 'users', userId))
    if (existing.exists() && existing.data().isSuperAdmin === true) {
      throw new Error('The super admin cannot be deleted.')
    }
    await deleteDoc(doc(db, 'users', userId))
  },

  sendPasswordReset: async (email) => {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim(), passwordResetActionSettings(email))
  },

  applyAccountType: (user, accountType) => applyAccountTypeChange(user, accountType),

  syncLinkedOperative: async (organizationId, user, operatives) => {
    if (!user.permissions.operativeMode) return
    const linked = findOperativeForUser(user, operatives)
    if (!linked) return

    const payload: Record<string, unknown> = {
      firstName: user.firstName.trim(),
      lastName: user.surname.trim(),
      name: `${user.firstName} ${user.surname}`.trim(),
      email: user.email.trim(),
      isActive: user.isActive,
      ...(user.tradeTypePreset ? { tradeTypePreset: user.tradeTypePreset } : {}),
      ...(user.tradeTypeCustom ? { tradeTypeCustom: user.tradeTypeCustom } : {}),
      updatedAt: Timestamp.now(),
    }
    applyExclusiveRateFields(payload, user)
    await setDoc(doc(db, 'organizations', organizationId, 'operatives', linked.id), payload, { merge: true })
  },
}))

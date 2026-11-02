'use client'

import { create } from 'zustand'
import { collection, deleteField, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, Timestamp, where, writeBatch } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import type { Operative, User } from '@/types'
import { auth, db } from '@/lib/firebase/config'
import { applyExclusiveRateFields, buildSaveUserPayload, changedUserPayload } from '@/lib/firebase/userPayload'
import {
  ORG_MEMBERSHIP_PERMISSION_KEYS,
  USER_DELETE_REFUSAL_MESSAGES,
  orgMembershipWriteFields,
  canChangePersonPay,
  operativeProfileWriteFields,
  organizationTimeZone,
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  userDeleteRefusal,
  userDeleteWrites,
  writeMetadataFields,
} from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import { useAuthStore } from '@/lib/stores/authStore'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { operativeRecordForUser } from '@/lib/operatives/operativeRosterUtils'
import { applyAccountTypeChange } from '@/lib/staff/accountTypeChange'
import { parseFormerUserIds } from '@/lib/canonical'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { operativeRowWriteFields } from '@/lib/canonical/peopleDocuments'

interface UserStoreState {
  saving: boolean
  error: string | null
  getUser: (userId: string) => Promise<User | null>
  /**
   * `options.baseline`: the copy the editor loaded. With it only changed fields are written
   * (never a stale photo, mobile or rate from a copy loaded before another device saved).
   */
  saveUser: (
    user: User,
    organizationId?: string,
    previousEmail?: string,
    options?: {
      baseline?: User | null
      /** Rulebook 1.10.0 §8: pay history rows (`payHistoryBatchRows`) written in the same batch as the profile. */
      payHistoryRows?: ReadonlyArray<{ id: string; fields: Record<string, unknown> }>
    }
  ) => Promise<void>
  transferSuperAdmin: (organizationId: string, fromUserId: string, toUserId: string, roster: User[]) => Promise<void>
  setUserActive: (userId: string, isActive: boolean, organizationId?: string) => Promise<void>
  deleteUser: (userId: string, opts?: { organizationId?: string; email?: string }) => Promise<void>
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

/**
 * An admin's change to someone's membership (rulebook 1.10.0, `orgMembershipWriteFields` shape): role, super admin
 * and the nested `permissions.{key}` flags only — a flat flag key is written as its nested key, never flat. Admins
 * cannot read another person's membership, so an update is sent blind and a missing document is created whole.
 */
async function writeMembershipFlags(
  userId: string,
  organizationId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const ref = doc(db, 'users', userId, 'orgMemberships', organizationId)
  const update: Record<string, unknown> = {}
  const permissions: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(fields)) {
    const flag = key.startsWith('permissions.') ? key.slice('permissions.'.length) : key
    if ((ORG_MEMBERSHIP_PERMISSION_KEYS as readonly string[]).includes(flag) && typeof value === 'boolean') {
      permissions[flag] = value
      update[`permissions.${flag}`] = value
    } else if (!key.startsWith('permissions.')) {
      update[key] = value
    }
  }
  try {
    await updateDoc(ref, update)
  } catch (error) {
    const code = (error as { code?: string }).code || ''
    if (code !== 'not-found') return
    const create = orgMembershipWriteFields({
      organizationId,
      stored: null,
      next: {
        role: typeof fields.role === 'string' ? fields.role : null,
        isSuperAdmin: typeof fields.isSuperAdmin === 'boolean' ? fields.isSuperAdmin : null,
        permissions,
      },
      writer: 'admin',
      now: serverTimestamp(),
    })
    if (create) await setDoc(ref, create.fields)
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

  saveUser: async (user, organizationId, previousEmail, options) => {
    const names = identityFields(user)
    const full = buildSaveUserPayload(user)
    delete full.organizationId
    Object.assign(full, names)
    // Always a partial update (rulebook §1, §11, `userProfileWriteFields`): against the copy the editor
    // loaded, else the stored document read now. Never a whole-document rewrite from a possibly stale copy.
    let baseline = options?.baseline && options.baseline.id === user.id ? options.baseline : null
    if (!baseline) {
      const stored = await getDoc(doc(db, 'users', user.id))
      if (stored.exists()) {
        const data = stored.data() as Record<string, unknown>
        baseline = parseOrgUser(stored.id, {
          ...data,
          organizationId: (typeof data.organizationId === 'string' && data.organizationId.trim()) || user.organizationId,
          email: (typeof data.email === 'string' && data.email.trim()) || user.email,
        })
      }
    }
    let payload = full
    if (baseline) {
      const before = buildSaveUserPayload(baseline)
      delete before.organizationId
      Object.assign(before, identityFields(baseline))
      payload = changedUserPayload(full, before)
    }
    payload.updatedAt = serverTimestamp()
    // updatedBy / updatedFrom only where firestore.rules lets them change: the person themselves
    // or an admin. A manager editing an operative is limited to a fixed changedKeys() list
    // (canManagerUpdateOperativeProfile) that does not include them yet.
    const saverId = auth?.currentUser?.uid || ''
    const saver = useAuthStore.getState().user
    const saverIsAdmin = Boolean(saver && (saver.isSuperAdmin || saver.permissions.adminAccess))
    const metadata = writeMetadataFields(saverId, 'web')
    if (metadata && (saverId === user.id || saverIsAdmin)) Object.assign(payload, metadata)
    const orgId = organizationId?.trim() || user.organizationId
    const historyRows = options?.payHistoryRows ?? []
    if (historyRows.length > 0 && orgId) {
      // One batch: the profile and its pay history are saved together or not at all (rulebook 1.10.0 §8).
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.id), payload)
      for (const row of historyRows) batch.set(doc(db, 'organizations', orgId, 'operativeDayRateHistory', row.id), row.fields)
      await batch.commit()
    } else {
      await updateDoc(doc(db, 'users', user.id), payload)
    }
    const email = user.email.toLowerCase().trim()
    if (orgId && email) {
      await setDoc(doc(db, 'organizations', orgId, 'userEmails', email), { userId: user.id })
    }
    await updateSameEmailUsers(user, previousEmail)
    if (orgId) await updateLinkedStaffNames(orgId, user, previousEmail)
    // The operativeProfiles mirror holds pay, so only someone who may change this person's pay
    // writes it (`canChangePersonPay`; firestore.rules `canChangePayOf`). A person's own save
    // never touches it.
    const mayWritePay = canChangePersonPay(
      {
        userId: saverId,
        isAdmin: saverIsAdmin || Boolean(saver?.role === 'admin' && !saver?.permissions.operativeMode),
        isManager: Boolean(saver && (saver.permissions.manager || saver.role === 'manager')),
        hasOperativesAccess: Boolean(saver?.permissions.operatives),
        isOperativeMode: Boolean(saver?.permissions.operativeMode),
      },
      { userId: user.id, isOperative: Boolean(user.permissions.operativeMode || user.role === 'operative') }
    )
    if (
      orgId &&
      mayWritePay &&
      (user.permissions.operativeMode ||
        user.permissions.manager ||
        user.permissions.adminAccess ||
        user.isSuperAdmin)
    ) {
      const profile: Record<string, unknown> = { userId: user.id }
      applyExclusiveRateFields(profile, user)
      // Rulebook 1.8.0: a partial update of the mirror (`operativeProfileWriteFields`); unchanged pay writes nothing.
      await savePartialDocument(
        doc(db, 'organizations', orgId, 'operativeProfiles', user.id),
        profile,
        operativeProfileWriteFields,
        { userId: saverId }
      )
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

  deleteUser: async (userId, opts) => {
    // Rulebook 1.10.0 §11 (`canDeleteUser`, `userDeleteWrites`): gate first, then one plan in order. The first
    // batch deletes users/{uid} with the documents only it guards, so a refusal changes nothing.
    const existing = await getDoc(doc(db, 'users', userId))
    const stored = existing.exists() ? (existing.data() as Record<string, unknown>) : {}
    const orgId = (opts?.organizationId || String(stored.organizationId || '')).trim()
    const email = (opts?.email || String(stored.email || '')).trim().toLowerCase()
    const target = parseOrgUser(userId, { ...stored, organizationId: orgId, email })
    const actor = useAuthStore.getState().user
    let creatorUserId: string | null = null
    if (orgId) {
      const orgSnap = await getDoc(doc(db, 'organizations', orgId)).catch(() => null)
      creatorUserId = orgSnap?.exists() ? String(orgSnap.data().creatorUserId || '') || null : null
    }
    const refusal = userDeleteRefusal(
      actor ? { id: actor.id, email: actor.email, role: staffAccountRole(actor), formerUserIds: actor.formerUserIds } : null,
      { id: userId, email, role: staffAccountRole(target), formerUserIds: parseFormerUserIds(stored) },
      { creatorUserId }
    )
    if (refusal) throw new Error(USER_DELETE_REFUSAL_MESSAGES[refusal])
    if (!orgId) throw new Error('Organisation not loaded.')

    const personIds = [userId, ...parseFormerUserIds(stored)]
    const byEmail = async (collectionName: 'operatives' | 'managers') =>
      email
        ? (await getDocs(query(collection(db, 'organizations', orgId, collectionName), where('email', '==', email))).catch(() => null))
            ?.docs.map((row) => ({ id: row.id, email: String(row.data().email || '') })) ?? []
        : []
    const [operativeRows, managerRows] = await Promise.all([byEmail('operatives'), byEmail('managers')])
    const lookup = Array.from(
      new Set([...personIds, ...operativeRows.map((row) => row.id)].flatMap((id) => [id, id.toUpperCase(), id.toLowerCase()]))
    )
    const bookings: Array<{ id: string; operativeId: string; dateMs: number }> = []
    const managerSiteBookings: Array<{ id: string; userId: string; dateMs: number }> = []
    for (let i = 0; i < lookup.length; i += 30) {
      const chunk = lookup.slice(i, i + 30)
      const [labour, site] = await Promise.all([
        getDocs(query(collection(db, 'organizations', orgId, 'bookings'), where('operativeId', 'in', chunk))),
        getDocs(query(collection(db, 'organizations', orgId, 'managerSiteBookings'), where('userId', 'in', chunk))),
      ])
      for (const row of labour.docs) {
        const parsed = parseBookingDocument(row.id, row.data() as Record<string, unknown>)
        if (parsed.ok) bookings.push({ id: row.id, operativeId: parsed.booking.operativeId, dateMs: parsed.booking.dateMs })
      }
      for (const row of site.docs) {
        const parsed = parseManagerSiteBookingDocument(row.id, row.data() as Record<string, unknown>)
        if (parsed.ok) managerSiteBookings.push({ id: row.id, userId: parsed.booking.userId, dateMs: parsed.booking.dateMs })
      }
    }
    const invitations = email
      ? ((await getDocs(query(collection(db, 'invitations'), where('organizationId', '==', orgId), where('email', '==', email))).catch(() => null))
          ?.docs.map((row) => ({ id: row.id, email: String(row.data().email || '') })) ?? [])
      : []
    const orgData = useOrganizationDocumentStore.getState().data
    const steps = userDeleteWrites({
      orgId,
      user: { id: userId, email, role: staffAccountRole(target), formerUserIds: parseFormerUserIds(stored) },
      actorUserId: auth?.currentUser?.uid || actor?.id || '',
      platform: 'web',
      bookings,
      managerSiteBookings,
      operativeRows,
      managerRows,
      invitations,
      nowIso: new Date().toISOString(),
      tz: organizationTimeZone(orgData && typeof orgData.countryCode === 'string' ? orgData.countryCode : null),
    })
    for (const step of steps) {
      const batch = writeBatch(db)
      for (const write of step.writes) {
        const ref = doc(db, write.path)
        if (write.op === 'delete') batch.delete(ref)
        else if (write.op === 'update') {
          batch.update(ref, Object.fromEntries(write.deleteFields.map((key) => [key, deleteField()])))
        } else {
          batch.set(ref, {
            ...write.fields,
            ...Object.fromEntries(write.serverTimestampFields.map((key) => [key, serverTimestamp()])),
          })
        }
      }
      await batch.commit()
    }
  },

  sendPasswordReset: async (email) => {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim(), passwordResetActionSettings(email))
  },

  applyAccountType: (user, accountType) => applyAccountTypeChange(user, accountType),

  syncLinkedOperative: async (organizationId, user, operatives) => {
    if (!user.permissions.operativeMode) return
    const linked = operativeRecordForUser(user, operatives)
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
    // Partial update of the changed fields only (rulebook §1, `operativeRowWriteFields`).
    await savePartialDocument(
      doc(db, 'organizations', organizationId, 'operatives', linked.id),
      payload,
      operativeRowWriteFields,
      { userId: auth?.currentUser?.uid }
    )
  },
}))

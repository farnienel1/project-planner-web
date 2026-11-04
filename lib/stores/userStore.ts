'use client'

import { create } from 'zustand'
import { addPayProfileWrite } from '@/lib/pay/payProfileService'
import { payEditorRecord } from '@/lib/pay/payProfileOverlay'
import { collection, deleteField, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, Timestamp, where, writeBatch } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import type { Operative, User } from '@/types'
import { auth, db } from '@/lib/firebase/config'
import { applyExclusiveRateFields, buildSaveUserPayload, changedUserPayload } from '@/lib/firebase/userPayload'
import {
  ORG_MEMBERSHIP_PERMISSION_KEYS,
  JOB_MANAGER_REMOVED_NOTICE_TYPE,
  USER_DELETE_REFUSAL_MESSAGES,
  canManageOperatives,
  jobManagerRemovalWrites,
  jobManagerRemovedNoticeText,
  superAdminTransferWrites,
  userActiveWrites,
  type PersonAccessChange,
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
import { accountTypeChangeWrites } from '@/lib/canonical/permissionLevels'
import { parseFormerUserIds, sharedDocumentPayWrite } from '@/lib/canonical'
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { addPartialDocumentToBatch, firestoreUpdateFields, savePartialDocument } from '@/lib/firebase/partialWrite'
import { notifyCompanyActivity } from '@/lib/notifications/companyActivity'
import { operativeRowWriteFields } from '@/lib/canonical/peopleDocuments'

interface UserStoreState {
  saving: boolean
  error: string | null
  /**
   * `options.payEditor` (rulebook 1.26.1 §8, `payEditorStartingValues`): the copy a pay editor starts from and diffs its
   * save against — while `privatePay` is on for the organisation the person's pay profile is laid over the users
   * document (the same pay the people profile shows); while it is off the users document exactly as stored.
   */
  getUser: (userId: string, options?: { payEditor?: boolean }) => Promise<User | null>
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
  /** Rulebook 1.31.0 `userActiveWrites`: `roster` is every users document of the organisation (same-email copies). */
  setUserActive: (userId: string, isActive: boolean, organizationId?: string, roster?: ReadonlyArray<User>) => Promise<void>
  deleteUser: (userId: string, opts?: { organizationId?: string; email?: string; roster?: ReadonlyArray<User> }) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  applyAccountType: (user: User, accountType: 'operative' | 'manager' | 'admin') => User
  /**
   * Rulebook 1.11.0 `accountTypeChangeWrites`: write the new user type to every document that decides it in this
   * organisation (users docs, `members.{uid}`, the membership). Throws the rulebook's message when refused.
   */
  changeAccountType: (
    user: User,
    accountType: 'operative' | 'manager' | 'admin',
    organizationId: string,
    roster: ReadonlyArray<User>,
    permissions?: object | null
  ) => Promise<string | null>
  syncLinkedOperative: (organizationId: string, user: User, operatives: Operative[]) => Promise<void>
  /**
   * Rulebook 1.31.0 `jobManagerRemovalWrites`: a person made an operative, deactivated or deleted is taken off every
   * job they manage (one batch) and the admins are told (`job_manager_removed`). Returns the number of jobs changed.
   */
  removeFromManagedJobs: (
    person: User,
    change: PersonAccessChange,
    organizationId: string,
    roster: ReadonlyArray<User>
  ) => Promise<number>
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

/**
 * The person's other users documents with the same email in THIS organisation (rulebook §11). The query names the
 * organisation: a users query on email alone can never be allowed by the rules for another person. Another company's
 * document is never rewritten. A refused read is logged and leaves the list empty (the profile still saves).
 */
/**
 * Rulebook 1.31.1 (F5): a pending invite placeholder (`passwordSet` not true) is synced only by an admin — the rules let
 * a same-email account write it only after accepting that invitation, so a person's own save leaves it alone instead
 * of failing the whole batch.
 */
async function sameEmailUserRefs(user: User, organizationId: string, previousEmail: string | undefined, includePending: boolean) {
  const org = organizationId.trim()
  if (!org) return []
  const emails = [user.email, previousEmail || '']
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, all) => value.includes('@') && all.indexOf(value) === index)
  const refs: ReturnType<typeof doc>[] = []
  for (const email of emails) {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users'), where('organizationId', '==', org), where('email', '==', email), limit(10))
      )
      for (const entry of snapshot.docs) {
        if (entry.id === user.id || refs.some((ref) => ref.id === entry.id)) continue
        if (!includePending && entry.data().passwordSet !== true) continue
        refs.push(entry.ref)
      }
    } catch (error) {
      console.warn('[userStore] same-email users read skipped', error)
    }
  }
  return refs
}

/** The `operatives` / `managers` rows on the person's email (old or new), for the name sync. */
async function linkedStaffRefs(organizationId: string, user: User, previousEmail?: string) {
  const emails = new Set(
    [user.email, previousEmail || ''].map((value) => value.trim().toLowerCase()).filter(Boolean)
  )
  const refs: ReturnType<typeof doc>[] = []
  if (emails.size === 0) return refs
  for (const collectionName of ['operatives', 'managers'] as const) {
    try {
      const snapshot = await getDocs(collection(db, 'organizations', organizationId, collectionName))
      for (const entry of snapshot.docs) {
        const email = String(entry.data().email || '').trim().toLowerCase()
        if (emails.has(email)) refs.push(entry.ref)
      }
    } catch (error) {
      console.warn(`[userStore] ${collectionName} read skipped`, error)
    }
  }
  return refs
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

  getUser: async (userId, options) => {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    const stored = snap.data() as Record<string, unknown>
    const orgOnDoc = typeof stored.organizationId === 'string' ? stored.organizationId.trim() : ''
    const openOrgId = useAuthStore.getState().organization?.id || ''
    // Rulebook 1.26.1 §8 (`payEditorStartingValues`): a pay editor's copy has the pay profile laid over only while
    // `privatePay` is on for the open organisation; off (and for every other caller) `stored` is used unchanged.
    const data = options?.payEditor ? await payEditorRecord(openOrgId || orgOnDoc, snap.id, stored) : stored
    if (orgOnDoc) return parseOrgUser(snap.id, data)
    const fallback = openOrgId || useAuthStore.getState().user?.organizationId || ''
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
        // Rulebook 1.26.1 §8 (`payEditorStartingValues`): the pay half of the baseline is the pay profile while
        // `privatePay` is on (where the pay is saved), the users document while it is off.
        const data = await payEditorRecord(
          organizationId?.trim() || user.organizationId,
          stored.id,
          stored.data() as Record<string, unknown>
        )
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
    // Rulebook 1.13.0 (Q1): someone who may change this person's pay also writes the changed pay fields to their
    // private pay profile (organizations/{orgId}/payProfiles/{uid}), in the same batch.
    const payWriter = canChangePersonPay(
      {
        userId: saverId,
        isAdmin: saverIsAdmin || Boolean(saver?.role === 'admin' && !saver?.permissions.operativeMode),
        isManager: Boolean(saver && (saver.permissions.manager || saver.role === 'manager')),
        hasOperativesAccess: Boolean(saver?.permissions.operatives),
        isOperativeMode: Boolean(saver?.permissions.operativeMode),
      },
      { userId: user.id, isOperative: Boolean(user.permissions.operativeMode || user.role === 'operative') }
    )
    // Rulebook 1.31.0 §11 (audit finding 8): ONE batch — the profile, its pay history and pay profile, the email
    // claim, the same-email copies' names, the linked operatives / managers rows' names and the operativeProfiles
    // mirror land together or not at all. Before 1.31.0 only the first three were batched and the rest followed one by
    // one, so a refusal half way left the documents disagreeing. Everything is read first.
    const email = user.email.toLowerCase().trim()
    const [sameEmail, linkedRows] = orgId
      ? await Promise.all([sameEmailUserRefs(user, orgId, previousEmail, saverIsAdmin), linkedStaffRefs(orgId, user, previousEmail)])
      : [[], []]
    const batch = writeBatch(db)
    // Rulebook 1.26.0 (`sharedDocumentPayWrite`): with `privatePay` on for this organisation, the users document takes
    // no pay value (the rules refuse it); pay goes to the pay profile and the rate history in the same batch.
    await securitySwitchesReady()
    batch.update(doc(db, 'users', user.id), sharedDocumentPayWrite(payload, { privatePay: orgId ? privatePayFor(orgId) : false }))
    if (orgId) {
      for (const row of historyRows) batch.set(doc(db, 'organizations', orgId, 'operativeDayRateHistory', row.id), row.fields)
      if (payWriter) addPayProfileWrite(batch, orgId, user.id, payload, saverId)
      if (email) batch.set(doc(db, 'organizations', orgId, 'userEmails', email), { userId: user.id })
      for (const ref of sameEmail) batch.update(ref, identityFields(user))
      for (const ref of linkedRows) batch.update(ref, identityFields(user))
      // The operativeProfiles mirror holds pay, so only someone who may change this person's pay writes it
      // (`canChangePersonPay`; firestore.rules `canChangePayOf`). A person's own save never touches it.
      if (
        payWriter &&
        (user.permissions.operativeMode || user.permissions.manager || user.permissions.adminAccess || user.isSuperAdmin)
      ) {
        const profile: Record<string, unknown> = { userId: user.id }
        applyExclusiveRateFields(profile, user)
        // Rulebook 1.8.0: a partial update of the mirror (`operativeProfileWriteFields`); unchanged pay writes nothing.
        await addPartialDocumentToBatch(
          batch,
          doc(db, 'organizations', orgId, 'operativeProfiles', user.id),
          profile,
          operativeProfileWriteFields,
          { userId: saverId }
        )
      }
    }
    await batch.commit()
  },

  transferSuperAdmin: async (organizationId, fromUserId, toUserId, roster) => {
    if (!organizationId || !toUserId || fromUserId === toUserId) return
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const previousCreator = orgSnap.exists() ? String(orgSnap.data().creatorUserId || '') : ''
    // Rulebook 1.31.0 `superAdminTransferWrites`: one batch — the organisation's creator and members entry, the new
    // Super Admin (both self-manage toggles on), and every outgoing Super Admin (kept self-approved when they have no
    // line manager). Before 1.31.0 these were separate writes and the outgoing Super Admin lost self-approval.
    const writes = superAdminTransferWrites({
      organizationId,
      fromUserId,
      toUserId,
      previousCreatorUserId: previousCreator || null,
      roster: roster.map((row) => ({
        id: row.id,
        email: row.email,
        organizationId: row.organizationId,
        isActive: row.isActive,
        role: row.role,
        isSuperAdmin: row.isSuperAdmin,
        formerUserIds: row.formerUserIds ?? [],
        assignedManagerUserIds: row.assignedManagerUserIds ?? null,
        assignedManagerUserId: row.assignedManagerUserId ?? null,
        hasNoLineManager: row.hasNoLineManager ?? null,
        permissions: row.permissions as unknown as Record<string, unknown>,
      })),
    })
    if (!writes) return
    const batch = writeBatch(db)
    const metadata = writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}
    for (const write of writes) {
      const ref = doc(db, ...(write.path.split('/') as [string, ...string[]]))
      if (write.kind === 'membership') {
        // Admins may not read another person's membership: a merge-set of the nested flags (created when missing).
        const nested: Record<string, unknown> = {}
        const flat: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(write.fields)) {
          if (key.startsWith('permissions.')) nested[key.slice('permissions.'.length)] = value
          else flat[key] = value
        }
        batch.set(ref, { organizationId, ...flat, permissions: nested, updatedAt: serverTimestamp() }, { merge: true })
      } else if (write.kind === 'userProfile') {
        batch.update(ref, { ...write.fields, ...metadata, updatedAt: serverTimestamp() })
      } else {
        batch.update(ref, { ...write.fields, updatedAt: serverTimestamp() })
      }
    }
    await batch.commit()
  },

  setUserActive: async (userId, isActive, organizationId, roster) => {
    if (!isActive) {
      const existing = await getDoc(doc(db, 'users', userId))
      if (existing.exists() && existing.data().isSuperAdmin === true) {
        throw new Error('The super admin cannot be deactivated.')
      }
    }
    const orgId = organizationId?.trim()
    if (!orgId) {
      await updateDoc(doc(db, 'users', userId), { isActive, updatedAt: Timestamp.now() })
      return
    }
    // Rulebook 1.31.0 `userActiveWrites` (audit finding 9): every users document of the person in this organisation
    // (their same-email copies included) and the membership, in one batch. Before 1.31.0 only one document changed.
    const person = (roster || []).find((row) => row.id === userId)
    const writes = userActiveWrites({
      organizationId: orgId,
      person: { id: userId, email: person?.email ?? null },
      isActive,
      roster: (roster || []).map((row) => ({ id: row.id, email: row.email, organizationId: row.organizationId })),
    })
    const batch = writeBatch(db)
    const updatedAt = Timestamp.now()
    const actor = useAuthStore.getState().user
    const actorIsAdmin = Boolean(actor && (actor.isSuperAdmin || actor.permissions.adminAccess || actor.role === 'admin'))
    for (const write of writes) {
      const ref = doc(db, ...(write.path.split('/') as [string, ...string[]]))
      // Admins can update a membership but cannot read it: a merge-set of the flag (created when missing). A manager
      // with the Operatives permission (1.31.0) writes the users documents only — memberships are admin writes.
      if (write.kind === 'membership' && !actorIsAdmin) continue
      if (write.kind === 'membership') batch.set(ref, { ...write.fields, updatedAt }, { merge: true })
      else batch.update(ref, { ...write.fields, updatedAt })
    }
    await batch.commit()
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
    // Rulebook 1.31.0 (owner decision 7): a manager with the Operatives permission deletes operatives too.
    const refusal = userDeleteRefusal(
      actor ? { id: actor.id, email: actor.email, role: staffAccountRole(actor), formerUserIds: actor.formerUserIds } : null,
      { id: userId, email, role: staffAccountRole(target), formerUserIds: parseFormerUserIds(stored) },
      { creatorUserId, actorManagesOperatives: Boolean(actor && canManageOperatives(actor.permissions ? { ...actor.permissions, role: actor.role } : actor)) }
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
    const orgMembers = orgData && typeof orgData.members === 'object' && orgData.members ? (orgData.members as Record<string, unknown>) : null
    const actorManagesOperatives = Boolean(
      actor && !(actor.isSuperAdmin || actor.permissions.adminAccess || actor.role === 'admin') &&
        canManageOperatives({ ...actor.permissions, role: actor.role })
    )
    const steps = userDeleteWrites({
      actorManagesOperatives,
      // 1.31.0: remove `members.{uid}` only when it is listed (an operatives manager may remove only a listed entry).
      listedInMembers: orgMembers ? Object.prototype.hasOwnProperty.call(orgMembers, userId) : true,
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
    // Rulebook 1.31.0 §13: the admins hear that an operative was deleted (`operative_deleted`, company activity,
    // never the actor). Best effort — the delete is done.
    if (target && staffAccountRole(target).isOperativeMode && !staffAccountRole(target).isAdmin) {
      const name = `${target.firstName || ''} ${target.surname || ''}`.trim() || email || 'An operative'
      void notifyCompanyActivity({
        organizationId: orgId,
        type: 'operative_deleted',
        title: 'Operative deleted',
        message: `${name} was deleted.`,
        relatedId: userId,
        actor,
        users: opts?.roster ?? [],
      }).catch((error) => console.warn('[userStore] operative_deleted notice skipped', error))
    }
  },

  removeFromManagedJobs: async (person, change, organizationId, roster) => {
    const org = organizationId.trim()
    if (!org) return 0
    const [projects, smallWorks, managers] = await Promise.all([
      getDocs(collection(db, 'organizations', org, 'projects')),
      getDocs(collection(db, 'organizations', org, 'smallWorks')),
      getDocs(collection(db, 'organizations', org, 'managers')).catch(() => null),
    ])
    const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
    const jobs = [
      ...projects.docs.map((row) => ({ row, collection: 'projects' as const })),
      ...smallWorks.docs.map((row) => ({ row, collection: 'smallWorks' as const })),
    ].map(({ row, collection: kind }) => {
      const data = row.data() as Record<string, unknown>
      return {
        id: row.id,
        collection: kind,
        managerId: typeof data.managerId === 'string' ? data.managerId : null,
        managerIds: ids(data.managerIds),
        managerUserIds: ids(data.managerUserIds),
        assignedManagerUserIds: ids(data.assignedManagerUserIds),
      }
    })
    // Rulebook 1.31.0 `jobManagerRemovalWrites`: every id of the person (same-email documents, the catalogue rows on
    // their email) off each job; the job stays, with no manager when none is left.
    const writes = jobManagerRemovalWrites({
      organizationId: org,
      person: { id: person.id, email: person.email, role: person.role, ...person.permissions },
      change,
      jobs,
      roster: roster.map((row) => ({ id: row.id, email: row.email, isActive: row.isActive, formerUserIds: row.formerUserIds ?? [] })),
      managers: managers?.docs.map((row) => ({ id: row.id, email: String(row.data().email || '') })) ?? [],
    })
    if (writes.length === 0) return 0
    const metadata = writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db)
      for (const write of writes.slice(i, i + 400)) {
        batch.update(doc(db, ...(write.path.split('/') as [string, ...string[]])), {
          ...firestoreUpdateFields({ set: write.set, remove: write.remove }),
          ...metadata,
          updatedAt: serverTimestamp(),
        })
      }
      await batch.commit()
    }
    const name = `${person.firstName || ''} ${person.surname || ''}`.trim() || person.email
    const text = jobManagerRemovedNoticeText(name, writes.length)
    void notifyCompanyActivity({
      organizationId: org,
      type: JOB_MANAGER_REMOVED_NOTICE_TYPE,
      title: text.title,
      message: text.message,
      relatedId: person.id,
      actor: useAuthStore.getState().user,
      users: roster,
    }).catch((error) => console.warn('[userStore] job_manager_removed notice skipped', error))
    return writes.length
  },

  sendPasswordReset: async (email) => {
    await sendPasswordResetEmail(auth, email.toLowerCase().trim(), passwordResetActionSettings(email))
  },

  applyAccountType: (user, accountType) => applyAccountTypeChange(user, accountType),

  changeAccountType: async (user, accountType, organizationId, roster, permissions) => {
    const stored = await getDoc(doc(db, 'users', user.id))
    const person = { ...(stored.exists() ? (stored.data() as Record<string, unknown>) : {}), id: user.id, email: user.email }
    // Rulebook 1.30.3: the roster screens hold one document per email (the fold), so a same-email duplicate was never
    // in `roster` and kept the old level — after admin → manager → admin the two documents disagreed and the fold could
    // show the stale one. Read this organisation's documents on the email so `accountTypeChangeWrites` updates them all.
    const rows = new Map(roster.map((row) => [row.id, { id: row.id, email: row.email, organizationId: row.organizationId }]))
    const email = user.email.trim().toLowerCase()
    if (email.includes('@')) {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'users'), where('organizationId', '==', organizationId), where('email', '==', email), limit(10))
        )
        for (const entry of snapshot.docs) {
          if (!rows.has(entry.id)) rows.set(entry.id, { id: entry.id, email, organizationId })
        }
      } catch (error) {
        console.warn('[userStore] same-email users read skipped', error)
      }
    }
    // Rulebook 1.31.0 (audit finding 3): same-email documents already listed in `members` get the new role too.
    const orgData = useOrganizationDocumentStore.getState().data
    const members =
      orgData && typeof orgData.members === 'object' && orgData.members ? (orgData.members as Record<string, unknown>) : null
    const buildPlan = (rosterRows: Array<{ id: string; email: string; organizationId?: string }>) =>
      accountTypeChangeWrites({
        person,
        kind: accountType,
        organizationId,
        roster: rosterRows,
        permissions: (permissions as Record<string, unknown> | null | undefined) ?? null,
        members,
      })
    const plan = buildPlan([...rows.values()])
    if (!plan.ok) throw new Error(plan.message)
    // Rulebook 1.12.2: one atomic batch — users documents, `members.{uid}` and the membership land together or not at
    // all. Before 1.12.2 the membership was written after the batch and a refusal there was swallowed, so a change
    // could stop half way (the rules read `members.{uid}` and the membership, the screens read the users document).
    // The membership is a merge-set of its role and nested `permissions` (admins may not read another person's
    // membership on older rules, so it cannot be read first); a missing one is created, status and dates are kept.
    const batch = writeBatch(db)
    const metadata = writeMetadataFields(auth?.currentUser?.uid, 'web') ?? {}
    for (const write of plan.writes) {
      const ref = doc(db, ...(write.path.split('/') as [string, ...string[]]))
      if (write.kind === 'membership') {
        const permissions: Record<string, boolean> = {}
        for (const key of ORG_MEMBERSHIP_PERMISSION_KEYS) {
          const value = (write.permissions as Record<string, unknown>)[key]
          if (typeof value === 'boolean') permissions[key] = value
        }
        batch.set(ref, { organizationId, role: write.role, permissions, updatedAt: serverTimestamp() }, { merge: true })
        continue
      }
      batch.update(ref, write.kind === 'userProfile' ? { ...write.fields, ...metadata, updatedAt: serverTimestamp() } : write.fields)
    }
    await batch.commit()
    return plan.note
  },

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

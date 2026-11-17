'use client'

import { create } from 'zustand'
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { auth, db } from '@/lib/firebase/config'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { managerRowWriteFields, operativeRowWriteFields, parseSkillDocument } from '@/lib/canonical/peopleDocuments'
import { sharedDocumentPayWrite } from '@/lib/canonical/payProfile'
import type { Operative, Manager, Skill, Qualification } from '@/types'
import { filterRealManagers, isPlaceholderManager } from '@/lib/staff/managerRosterUtils'
import { forgetOrgCollectionDoc, subscribeOrgCollectionLoaded } from '@/lib/firebase/subscribeOrgCollection'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import { applyExclusiveRateFields } from '@/lib/firebase/userPayload'
import {
  mergeOperativeQualificationWrite,
  removedQualificationCertificateIds,
} from '@/lib/canonical/operativeQualifications'
import { parseManager, parseOperative, serializeManager, serializeOperative } from '@/lib/ios-parity/converters'
import { currentOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { readStoredRates } from '@/lib/timesheets/payBasis'
import { markRowsRemoved, retainScopedRows } from '@/lib/staff/rosterRetain'
import { removeFutureBookingsForPerson } from '@/lib/bookings/removeBookingsOnDelete'
import { formerPersonNeededFor, isPermissionDenied } from '@/lib/people/formerPeople'
import { DELETED_PEOPLE_COLLECTION, formerPersonRecordFields } from '@/lib/canonical/formerPeople'

/** 1 when any labour booking (any date) is filed under the id, else 0; null when it could not be read. */
async function countBookingsUnder(organizationId: string, id: string): Promise<number | null> {
  try {
    const spellings = Array.from(new Set([id, id.toUpperCase(), id.toLowerCase()]))
    const snap = await getDocs(query(collection(db, 'organizations', organizationId, 'bookings'), where('operativeId', 'in', spellings), limit(1)))
    return snap.empty ? 0 : 1
  } catch {
    return null
  }
}
import { privatePayFor, securitySwitchesReady } from '@/lib/access/securitySwitches'
import {
  noteOperativeRows,
  notePayOperativesOverlaid,
  onPayProfileCacheChange,
  overlayRosterPay,
  payEditorRecord,
  payProfileCacheVersion,
} from '@/lib/pay/payProfileOverlay'

const OPERATIVES_KEY = 'operativeStore:operatives'
const MANAGERS_KEY = 'operativeStore:managers'
let operativesOrgId = ''
let managersOrgId = ''
let skillsOrgId = ''
let qualificationsOrgId = ''

/** Bumped around each operative write so an older roster fetch cannot put the previous certificate back. */
let operativeMutationEpoch = 0

interface OperativeState {
  operatives: Operative[]
  managers: Manager[]
  placeholderManagerCount: number
  skills: Skill[]
  qualifications: Qualification[]
  loading: boolean
  error: string | null
  operativesLoadedOrgId: string | null
  managersLoadedOrgId: string | null
  loadOperatives: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  loadManagers: (organizationId: string) => Promise<void>
  loadSkills: (organizationId: string) => Promise<void>
  loadQualifications: (organizationId: string) => Promise<void>
  getOperative: (organizationId: string, id: string) => Promise<Operative | null>
  getManager: (organizationId: string, id: string) => Promise<Manager | null>
  saveOperative: (organizationId: string, operative: Operative) => Promise<string>
  patchOperativeQualifications: (organizationId: string, operative: Operative) => Promise<string>
  saveManager: (organizationId: string, manager: Manager) => Promise<string>
  /** `formerRecordSkipped` true when the former-person record (rulebook 1.59.0) was refused; the row was deleted. */
  deleteOperative: (id: string, organizationId: string) => Promise<{ formerRecordSkipped: boolean }>
  deleteManager: (id: string, organizationId: string) => Promise<void>
  cleanupLegacyPlaceholderManagers: (organizationId: string) => Promise<number>
}

/** Re-reads the pay profiles (1.27.0 catalogue operatives); a change re-reads the operatives rows (listener below). */
async function refreshCatalogueOperativePay(organizationId: string): Promise<void> {
  try {
    const [{ refreshPayProfiles }, { useAuthStore }, { useOrgUserStore }] = await Promise.all([
      import('@/lib/pay/payProfileOverlay'),
      import('@/lib/stores/authStore'),
      import('@/lib/stores/siteAuditStore'),
    ])
    // A change re-reads the rows through the cache-change listener below.
    await refreshPayProfiles(organizationId, useAuthStore.getState().user as never, useOrgUserStore.getState().users as never)
  } catch {
    // A refused or failed read keeps the rows as read (rulebook 1.26.0).
  }
}

// Pay strip: the pay-profile cache changed after the operatives rows were parsed — read them again through it (once
// per cache version), so a catalogue operative's rate is never the stripped row's.
let operativesRereadForVersion = -1
onPayProfileCacheChange((organizationId) => {
  if (operativesOrgId !== organizationId) return
  const version = payProfileCacheVersion()
  if (operativesRereadForVersion === version) return
  operativesRereadForVersion = version
  void import('@/lib/firebase/subscribeOrgCollection')
    .then(({ unsubscribeOrgCollection }) => {
      if (!liveResultStillCurrent(organizationId)) return undefined
      unsubscribeOrgCollection(OPERATIVES_KEY)
      return useOperativeStore.getState().loadOperatives(organizationId, { force: true })
    })
    .catch(() => undefined)
})

export const useOperativeStore = create<OperativeState>((set, get) => ({
  operatives: [],
  managers: [],
  placeholderManagerCount: 0,
  skills: [],
  qualifications: [],
  loading: false,
  error: null,
  operativesLoadedOrgId: null,
  managersLoadedOrgId: null,
  
  // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): operatives, managers, skills and qualifications are live listeners. The
  // load resolves on the first snapshot; edits on any platform arrive through it, so there is no time-to-live cache.
  loadOperatives: async (organizationId: string, _options?: { force?: boolean }) => {
    void _options
    if (!organizationId) return
    if (get().operatives.length === 0 || operativesOrgId !== organizationId) set({ loading: true, error: null })
    else set({ error: null })
    try {
      await subscribeOrgCollectionLoaded(OPERATIVES_KEY, organizationId, 'operatives', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        // Rulebook 1.27.0 §8 (`catalogueOperativePaySubjects`): the pay-profile plan includes the catalogue operatives.
        // When the rows that could be catalogue operatives change while `privatePay` is on, the pay profiles are read
        // again and the rows re-read through the overlay (a non-admin with the Operatives toggle now reads them).
        if (noteOperativeRows(organizationId, docs.map((entry) => ({ ...entry.data, id: entry.id }))) && privatePayFor(organizationId)) {
          void refreshCatalogueOperativePay(organizationId)
        }
        // Pay strip: the pay-profile cache version these rows are parsed with.
        const payVersion = payProfileCacheVersion()
        const mapped = docs.flatMap((entry) => {
          // Rulebook 1.26.0 §8: a catalogue operative's pay is read from its pay profile first (`overlayPayProfile`).
          const parsed = parseOperative(entry.id, overlayRosterPay(organizationId, entry.id, entry.data), organizationId)
          return parsed.ok ? [parsed.value] : []
        })
        const previous = operativesOrgId === organizationId ? get().operatives : []
        const operatives = retainScopedRows(`operatives:${organizationId}`, previous, mapped, meta)
        operativesOrgId = organizationId
        set({ operatives, loading: false, operativesLoadedOrgId: organizationId })
        notePayOperativesOverlaid(organizationId, payVersion)
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load operatives', loading: false })
      throw error
    }
  },

  loadManagers: async (organizationId: string) => {
    if (!organizationId) return
    try {
      await subscribeOrgCollectionLoaded(MANAGERS_KEY, organizationId, 'managers', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        const allManagers = docs.flatMap((entry) => {
          const parsed = parseManager(entry.id, entry.data, organizationId)
          return parsed.ok ? [parsed.value] : []
        })
        const realManagers = filterRealManagers(allManagers)
        const previous = managersOrgId === organizationId ? get().managers : []
        const managers = retainScopedRows(`managers:${organizationId}`, previous, realManagers, meta)
        managersOrgId = organizationId
        set({
          managers,
          placeholderManagerCount: allManagers.filter(isPlaceholderManager).length,
          managersLoadedOrgId: organizationId,
        })
      })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load managers' })
      throw error
    }
  },

  loadSkills: async (organizationId: string) => {
    if (!organizationId) return
    try {
      await subscribeOrgCollectionLoaded('operativeStore:skills', organizationId, 'skills', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        // `parseSkillDocument` (rulebook 1.6.0): id as stored, a row without a name is skipped.
        const skills: Skill[] = docs.flatMap((entry) => {
          const parsed = parseSkillDocument(entry.id, entry.data)
          if (!parsed) return []
          return [
            {
              id: parsed.id,
              name: parsed.name,
              trade: parsed.trade,
              createdAt: parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date(),
              updatedAt: parsed.updatedAtMs != null ? new Date(parsed.updatedAtMs) : new Date(),
            } as Skill,
          ]
        })
        const previous = skillsOrgId === organizationId ? get().skills : []
        const kept = retainScopedRows(`skills:${organizationId}`, previous, skills, meta)
        skillsOrgId = organizationId
        set({ skills: kept })
      })
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to load skills' })
    }
  },

  loadQualifications: async (organizationId: string) => {
    if (!organizationId) return
    try {
      await subscribeOrgCollectionLoaded('operativeStore:qualifications', organizationId, 'qualifications', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        const qualifications = docs.map((entry) => {
          const data = entry.data as Record<string, any>
          return {
            id: entry.id,
            ...data,
            endDate: data.endDate?.toDate?.(),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Qualification
        })
        const previous = qualificationsOrgId === organizationId ? get().qualifications : []
        const kept = retainScopedRows(`qualifications:${organizationId}`, previous, qualifications, meta)
        qualificationsOrgId = organizationId
        set({ qualifications: kept })
      })
    } catch (error: any) {
      set({ error: error?.message ?? 'Failed to load qualifications' })
    }
  },

  getOperative: async (organizationId, id) => {
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'operatives', id))
    if (!snap.exists()) return null
    // Rulebook 1.26.1 §8 (`payEditorStartingValues`): the catalogue operative form starts from (and its save and
    // rate history diff against) the row's pay profile `payProfiles/{rowId}` while `privatePay` is on; while it is
    // off, the row exactly as stored.
    const data: ReturnType<typeof snap.data> = await payEditorRecord(organizationId, snap.id, snap.data() as Record<string, unknown>)
    const parsed = parseOperative(snap.id, data, organizationId)
    if (parsed.ok) return parsed.value
    const stored = readStoredRates(data)
    return {
      id: snap.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone,
      startDate: data.startDate?.toDate() || new Date(),
      payBasis: stored.payBasis ?? undefined,
      dayRate: stored.payBasis === 'day' && stored.dayRate != null ? stored.dayRate : undefined,
      hourlyRate: stored.payBasis === 'hourly' && stored.hourlyRate != null ? stored.hourlyRate : 0,
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
    const parsed = parseManager(snap.id, data, organizationId)
    if (parsed.ok) return parsed.value
    const stored = readStoredRates(data)
    return {
      id: snap.id,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone,
      mobile: data.mobileNumber || data.mobile,
      department: data.department,
      isActive: data.isActive !== false,
      payBasis: stored.payBasis ?? undefined,
      dayRate: stored.payBasis === 'day' && stored.dayRate != null ? stored.dayRate : undefined,
      hourlyRate: stored.payBasis === 'hourly' && stored.hourlyRate != null ? stored.hourlyRate : undefined,
      organizationId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Manager
  },

  saveOperative: async (organizationId, operative) => {
    const id = operative.id || newUuid()
    await securitySwitchesReady()
    // Rulebook 1.26.0 (`sharedDocumentPayWrite`): with `privatePay` on, pay goes only to the pay profile.
    const payload = sharedDocumentPayWrite(
      serializeOperative({ ...operative, id, organizationId }, { currencyCode: currentOrganizationCurrency() }),
      { privatePay: privatePayFor(organizationId) }
    )
    operativeMutationEpoch += 1
    // Partial update of the changed fields only (rulebook §1, `operativeRowWriteFields`).
    await savePartialDocument(
      doc(db, 'organizations', organizationId, 'operatives', id),
      payload,
      operativeRowWriteFields,
      // Rulebook 1.9.0: an edit of an operative deleted elsewhere is refused, never re-created.
      { userId: auth?.currentUser?.uid, missing: get().operatives.some((row) => row.id === id) ? 'refuse' : 'create' }
    )
    operativeMutationEpoch += 1
    const saved = { ...operative, id, organizationId, updatedAt: new Date() }
    set({ operatives: [...get().operatives.filter((o) => o.id !== id), saved] })
    return id
  },

  /**
   * Qualification edits merge into the operative document.
   * A full rewrite would drop fields iOS stores on the same record.
   * The certificate map stays qualification UUID → download URL, which is what iOS reads.
   * Assignment write shape and map merge are lib/canonical/operativeQualifications.
   */
  patchOperativeQualifications: async (organizationId, operative) => {
    const id = operative.id
    if (!id) throw new Error('Operative profile is missing.')
    const existing = get().operatives.find((row) => row.id === id)
    const nextIds = (operative.qualifications || []).map((row) => String(row.id || '').trim()).filter(Boolean)
    const merged = mergeOperativeQualificationWrite({
      previous: {
        qualifications: existing?.qualifications,
        qualificationExpiryDates: existing?.qualificationExpiryDates,
        qualificationCertificateURLs: existing?.qualificationCertificateURLs,
      },
      next: {
        qualifications: operative.qualifications,
        qualificationExpiryDates: operative.qualificationExpiryDates,
        qualificationCertificateURLs: operative.qualificationCertificateURLs,
        removedCertificateIds: removedQualificationCertificateIds(
          existing?.qualificationCertificateURLs,
          operative.qualificationCertificateURLs,
          nextIds
        ),
      },
    })
    const mergedOperative: Operative = {
      ...existing,
      ...operative,
      id,
      organizationId,
      qualifications: merged.qualifications.map((row) => ({
        id: row.id,
        name: row.name,
        hasEndDate: row.hasEndDate,
        createdAt: new Date(row.createdAtIso),
        updatedAt: new Date(row.updatedAtIso),
        endDate: row.endDateIso ? new Date(row.endDateIso) : undefined,
      })),
      qualificationExpiryDates: Object.fromEntries(
        Object.entries(merged.qualificationExpiryDates).map(([key, iso]) => [key, new Date(iso)])
      ),
      qualificationCertificateURLs: merged.qualificationCertificateURLs,
      updatedAt: new Date(),
    }
    const payload = serializeOperative({ ...mergedOperative, organizationId }, { currencyCode: currentOrganizationCurrency() })
    operativeMutationEpoch += 1
    await setDoc(
      doc(db, 'organizations', organizationId, 'operatives', id),
      existing
        ? {
            qualifications: payload.qualifications,
            qualificationExpiryDates: payload.qualificationExpiryDates,
            qualificationCertificateURLs: payload.qualificationCertificateURLs,
            updatedAt: payload.updatedAt,
          }
        : sharedDocumentPayWrite(payload, { privatePay: privatePayFor(organizationId) }),
      { merge: true }
    )
    operativeMutationEpoch += 1
    set({ operatives: [...get().operatives.filter((row) => row.id !== id), mergedOperative] })
    return id
  },

  saveManager: async (organizationId, manager) => {
    const id = manager.id || newUuid()
    const serialized = serializeManager({ ...manager, id, organizationId })
    applyExclusiveRateFields(serialized, manager)
    await securitySwitchesReady()
    // Rulebook 1.26.0 (`sharedDocumentPayWrite`): with `privatePay` on, a manager's pay goes only to the pay profile.
    const payload = sharedDocumentPayWrite(serialized, { privatePay: privatePayFor(organizationId) })
    // Partial update of the changed fields only (rulebook §1, `managerRowWriteFields`).
    await savePartialDocument(
      doc(db, 'organizations', organizationId, 'managers', id),
      payload,
      managerRowWriteFields,
      { userId: auth?.currentUser?.uid, missing: get().managers.some((row) => row.id === id) ? 'refuse' : 'create' }
    )
    const saved = { ...manager, id, organizationId, updatedAt: new Date() }
    set({ managers: [...get().managers.filter((m) => m.id !== id), saved] })
    return id
  },

  deleteOperative: async (id, organizationId) => {
    const { operatives } = get()
    try {
      await removeFutureBookingsForPerson(db, { organizationId, operativeIds: [id] })
      const operativeRef = doc(db, 'organizations', organizationId, 'operatives', id)
      // Rulebook 1.59.0 §11: a catalogue operative with past bookings, leave or pay history keeps a former-person
      // record (written in the batch that deletes the row — the only place the rules accept it), so old bookings read
      // "Former: <name>". Older rules refuse it; the row is then deleted on its own.
      // Review of #370 (M1): the record holds only what the row itself carries (the rules check it against the row).
      const rowSnap = await getDoc(operativeRef).catch(() => null)
      const rowData = (rowSnap?.exists() ? rowSnap.data() : {}) as Record<string, unknown>
      const bookingsLeft = await countBookingsUnder(organizationId, id)
      const keep = await formerPersonNeededFor(db, organizationId, [id], { bookings: bookingsLeft, managerSiteBookings: 0 })
      const record = keep
        ? formerPersonRecordFields({
            person: {
              id,
              firstName: String(rowData.firstName ?? ''),
              lastName: String(rowData.lastName ?? ''),
              surname: String(rowData.surname ?? ''),
              displayName: typeof rowData.displayName === 'string' ? rowData.displayName : null,
              name: typeof rowData.name === 'string' ? rowData.name : null,
              email: String(rowData.email ?? ''),
              linkedIds: [rowData.linkedUserId, rowData.userId, rowData.uid],
            },
            deletedBy: auth?.currentUser?.uid || '',
          })
        : null
      let formerRecordSkipped = false
      if (record) {
        const batch = writeBatch(db)
        batch.delete(operativeRef)
        batch.set(doc(db, 'organizations', organizationId, DELETED_PEOPLE_COLLECTION, id), { ...record.fields, deletedAt: serverTimestamp() })
        try {
          await batch.commit()
        } catch (error) {
          if (!isPermissionDenied(error)) throw error
          console.warn('[operativeStore] former-person record skipped', error)
          formerRecordSkipped = true
          await deleteDoc(operativeRef)
        }
      } else {
        await deleteDoc(operativeRef)
      }
      markRowsRemoved(`operatives:${organizationId}`, [id])
      forgetOrgCollectionDoc(OPERATIVES_KEY, organizationId, id)
      set({ operatives: operatives.filter(o => o.id !== id) })
      return { formerRecordSkipped }
    } catch (error: any) {
      set({ error: error.message })
      throw error
    }
  },
  
  deleteManager: async (id, organizationId) => {
    await deleteDoc(doc(db, 'organizations', organizationId, 'managers', id))
    markRowsRemoved(`managers:${organizationId}`, [id])
    forgetOrgCollectionDoc(MANAGERS_KEY, organizationId, id)
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
    markRowsRemoved(`managers:${organizationId}`, placeholderIds)
    for (const placeholderId of placeholderIds) forgetOrgCollectionDoc(MANAGERS_KEY, organizationId, placeholderId)

    await get().loadManagers(organizationId)
    return placeholderIds.length
  },
}))





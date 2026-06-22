import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import type { GuidedSetupData } from '@/components/setup/GuidedOrgSetup'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { buildProjectFirestorePayload } from '@/lib/firebase/projectPayload'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { permissionsForAccountType } from '@/lib/orgSetup/accountPermissions'
import { inviteUserCore } from '@/lib/orgSetup/inviteUserCore'
import type { TeamOnboardingState } from '@/lib/orgSetup/teamOnboarding'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function mapEmploymentType(value: GuidedSetupData['operative']['employmentType']): 'paye' | 'selfEmployed' {
  return value === 'PAYE' ? 'paye' : 'selfEmployed'
}

function parseDayRate(value: string): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export type PersistGuidedSetupInput = {
  organizationId: string
  adminUserId: string
  guidedData: GuidedSetupData
}

export type PersistGuidedSetupResult = {
  managerUserId?: string
  operativeUserId?: string
  teamOnboarding: TeamOnboardingState
}

export async function persistGuidedSetup(
  input: PersistGuidedSetupInput
): Promise<PersistGuidedSetupResult> {
  const db = getFirebaseDb()
  const { organizationId, adminUserId, guidedData } = input
  const now = new Date()

  let managerUserId: string | undefined
  let managerRosterId: string | undefined
  let operativeUserId: string | undefined

  const manager = guidedData.manager
  if (
    manager.firstName.trim() &&
    manager.surname.trim() &&
    EMAIL_PATTERN.test(manager.email.trim())
  ) {
    const invited = await inviteUserCore({
      email: manager.email,
      organizationId,
      firstName: manager.firstName,
      surname: manager.surname,
      mobileNumber: manager.mobile,
      permissions: permissionsForAccountType('manager'),
      assignedManagerUserId: adminUserId,
      dayRate: parseDayRate(manager.dayRate),
      invitedBy: adminUserId,
    })
    managerUserId = invited.userId

    managerRosterId = newUuid()
    await setDoc(doc(db, 'organizations', organizationId, 'managers', managerRosterId), {
      id: managerRosterId,
      firstName: manager.firstName.trim(),
      lastName: manager.surname.trim(),
      email: manager.email.trim().toLowerCase(),
      mobileNumber: manager.mobile.trim() || '',
      department: '',
      isActive: true,
      notes: '',
      tradeTypePreset: '',
      tradeTypeCustom: '',
      organizationId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.now(),
    })
  }

  const operative = guidedData.operative
  if (
    operative.firstName.trim() &&
    operative.surname.trim() &&
    EMAIL_PATTERN.test(operative.email.trim())
  ) {
    const lineManagerId = managerUserId || adminUserId
    const invited = await inviteUserCore({
      email: operative.email,
      organizationId,
      firstName: operative.firstName,
      surname: operative.surname,
      mobileNumber: operative.mobile,
      permissions: permissionsForAccountType('operative'),
      assignedManagerUserId: lineManagerId,
      dayRate: parseDayRate(operative.dayRate),
      employmentType: mapEmploymentType(operative.employmentType),
      invitedBy: adminUserId,
    })
    operativeUserId = invited.userId

    const operativeRosterId = newUuid()
    const dayRate = parseDayRate(operative.dayRate) ?? 0
    await setDoc(doc(db, 'organizations', organizationId, 'operatives', operativeRosterId), {
      id: operativeRosterId,
      firstName: operative.firstName.trim(),
      lastName: operative.surname.trim(),
      name: `${operative.firstName} ${operative.surname}`.trim(),
      email: operative.email.trim().toLowerCase(),
      phone: operative.mobile.trim() || '',
      startDate: Timestamp.fromDate(now),
      skills: guidedData.skill.name.trim() ? [guidedData.skill.name.trim()] : [],
      qualifications: guidedData.qualification.name.trim()
        ? [guidedData.qualification.name.trim()]
        : [],
      isActive: true,
      hourlyRate: dayRate,
      dayRate,
      currencySymbol: '£',
      notes: '',
      tradeTypePreset: '',
      tradeTypeCustom: '',
      organizationId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.now(),
    })
  }

  if (guidedData.client.name.trim()) {
    const clientRef = await addDoc(collection(db, 'organizations', organizationId, 'clients'), {
      name: guidedData.client.name.trim(),
      email: guidedData.client.email.trim() || '',
      phone: guidedData.client.phone.trim() || '',
      contactPerson: '',
      address: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    const project = guidedData.project
    if (project.jobNumber.trim() && project.siteName.trim() && project.startDate && project.endDate) {
      const projectId = newUuid()
      const client = {
        id: clientRef.id,
        name: guidedData.client.name.trim(),
        email: guidedData.client.email.trim() || undefined,
        phone: guidedData.client.phone.trim() || undefined,
        organizationId,
        createdAt: now,
        updatedAt: now,
      }
      const payload = buildProjectFirestorePayload({
        id: projectId,
        organizationId,
        jobNumber: project.jobNumber,
        siteName: project.siteName,
        addressLine1: '',
        townCity: '',
        postcode: '',
        client,
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        jobType: project.jobType || 'CAT A',
        managerId: managerRosterId,
        managerIds: managerRosterId ? [managerRosterId] : undefined,
        isLive: true,
      })
      const collectionName = project.jobType === 'Small Works' ? 'smallWorks' : 'projects'
      await setDoc(doc(db, 'organizations', organizationId, collectionName, projectId), payload)
    }
  }

  if (guidedData.skill.name.trim() && guidedData.skill.trade.trim()) {
    const skillId = newUuid()
    await setDoc(doc(db, 'organizations', organizationId, 'skills', skillId), {
      name: guidedData.skill.name.trim(),
      trade: guidedData.skill.trade.trim(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }

  if (guidedData.qualification.name.trim()) {
    const qualificationId = newUuid()
    await setDoc(doc(db, 'organizations', organizationId, 'qualifications', qualificationId), {
      name: guidedData.qualification.name.trim(),
      hasEndDate: guidedData.qualification.hasEndDate,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }

  if (guidedData.jobType.name.trim()) {
    const settingsRef = doc(db, 'organizations', organizationId, 'settings', 'jobTypes')
    const existing = await getDoc(settingsRef)
    const current = existing.exists()
      ? (existing.data().jobTypes as string[] | undefined) ?? []
      : []
    const nextName = guidedData.jobType.name.trim()
    if (!current.includes(nextName)) {
      await setDoc(
        settingsRef,
        { jobTypes: [...current, nextName], updatedAt: Timestamp.now() },
        { merge: true }
      )
    }
  }

  const teamOnboarding: TeamOnboardingState = {
    status: managerUserId ? 'pending_manager' : operativeUserId ? 'pending_operative' : 'complete',
    managerUserId,
    operativeUserId,
    managerName: managerUserId ? `${manager.firstName} ${manager.surname}`.trim() : undefined,
    operativeName: operativeUserId ? `${operative.firstName} ${operative.surname}`.trim() : undefined,
    managerPermissionsConfigured: false,
    operativePermissionsConfigured: false,
  }

  if (!managerUserId && operativeUserId) {
    teamOnboarding.status = 'pending_operative'
  }
  if (!managerUserId && !operativeUserId) {
    teamOnboarding.status = 'complete'
  }

  await updateDoc(doc(db, 'organizations', organizationId), {
    teamOnboarding,
    guidedSetupPersistedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return { managerUserId, operativeUserId, teamOnboarding }
}

export async function saveGuidedSetupDraft(
  organizationId: string,
  guidedData: GuidedSetupData
): Promise<void> {
  const db = getFirebaseDb()
  await updateDoc(doc(db, 'organizations', organizationId), {
    guidedSetupDraft: guidedData,
    updatedAt: Timestamp.now(),
  })
}

export async function persistGuidedSetupDraftIfNeeded(
  organizationId: string,
  adminUserId: string
): Promise<PersistGuidedSetupResult | null> {
  const db = getFirebaseDb()
  const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
  if (!orgSnap.exists()) return null

  const data = orgSnap.data()
  if (data.guidedSetupPersistedAt) return null

  const draft = data.guidedSetupDraft as GuidedSetupData | undefined
  if (!draft) return null

  const result = await persistGuidedSetup({ organizationId, adminUserId, guidedData: draft })
  await updateDoc(doc(db, 'organizations', organizationId), {
    guidedSetupDraft: null,
    updatedAt: Timestamp.now(),
  })
  return result
}

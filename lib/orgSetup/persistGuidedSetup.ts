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
import type { TeamOnboardingState } from '@/lib/orgSetup/teamOnboarding'
import type { Subcontractor, SubcontractorContact, Wholesaler, WholesalerContact } from '@/types'

export type PersistGuidedSetupInput = {
  organizationId: string
  organizationName: string
  adminUserId: string
  guidedData: GuidedSetupData
}

export type PersistGuidedSetupResult = {
  teamOnboarding: TeamOnboardingState
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

async function createClientRecord(
  organizationId: string,
  params: { name: string; email?: string; phone?: string }
): Promise<{ id: string; name: string; email?: string; phone?: string }> {
  const db = getFirebaseDb()
  const name = params.name.trim()
  const clientRef = await addDoc(collection(db, 'organizations', organizationId, 'clients'), {
    name,
    email: params.email?.trim() || '',
    phone: params.phone?.trim() || '',
    contactPerson: '',
    address: '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return {
    id: clientRef.id,
    name,
    email: params.email?.trim() || undefined,
    phone: params.phone?.trim() || undefined,
  }
}

function buildWholesalerFromGuided(
  guided: GuidedSetupData['wholesaler'],
  now: Date
): Wholesaler | null {
  if (!guided.name.trim()) return null
  const contactId = newUuid()
  const contacts: WholesalerContact[] = []
  if (guided.contactName.trim() && guided.contactEmail.trim()) {
    contacts.push({
      id: contactId,
      name: guided.contactName.trim(),
      email: guided.contactEmail.trim(),
      isPrimary: true,
      createdAt: now,
    })
  }
  return {
    id: newUuid(),
    name: guided.name.trim(),
    address: guided.address.trim() || undefined,
    trade: guided.trade.trim() || undefined,
    accountNumber: guided.accountNumber.trim() || undefined,
    primaryContactId: contacts[0]?.id,
    contacts,
    createdAt: now,
    updatedAt: now,
  }
}

function buildSubcontractorFromGuided(
  guided: GuidedSetupData['subcontractor'],
  now: Date
): Subcontractor | null {
  if (!guided.name.trim() || !guided.tradeType.trim()) return null
  const contacts: SubcontractorContact[] = []
  if (guided.contactName.trim()) {
    contacts.push({
      id: newUuid(),
      name: guided.contactName.trim(),
      email: guided.contactEmail.trim() || '',
      contactNumber: guided.contactNumber.trim() || '',
      position: 'Installer',
      createdAt: now,
    })
  }
  return {
    id: newUuid(),
    name: guided.name.trim(),
    subcontractorType: guided.tradeType.trim(),
    website: guided.website.trim() || undefined,
    address: guided.address.trim() || undefined,
    contacts,
    createdAt: now,
    updatedAt: now,
  }
}

function wholesalerPayload(wholesaler: Wholesaler) {
  return {
    id: wholesaler.id,
    name: wholesaler.name.trim(),
    address: wholesaler.address?.trim() || null,
    trade: wholesaler.trade?.trim() || null,
    accountNumber: wholesaler.accountNumber?.trim() || null,
    primaryContactId: wholesaler.primaryContactId || null,
    contacts: wholesaler.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name.trim(),
      email: contact.email.trim(),
      isPrimary: contact.isPrimary,
      createdAt: Timestamp.fromDate(contact.createdAt),
    })),
    createdAt: Timestamp.fromDate(wholesaler.createdAt),
    updatedAt: Timestamp.fromDate(wholesaler.updatedAt),
  }
}

function subcontractorPayload(subcontractor: Subcontractor) {
  return {
    id: subcontractor.id,
    name: subcontractor.name.trim(),
    subcontractorType: subcontractor.subcontractorType.trim(),
    website: subcontractor.website?.trim() || null,
    address: subcontractor.address?.trim() || null,
    contacts: subcontractor.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name.trim(),
      email: contact.email.trim(),
      contactNumber: contact.contactNumber.trim(),
      position: contact.position,
      createdAt: Timestamp.fromDate(contact.createdAt),
    })),
    createdAt: Timestamp.fromDate(subcontractor.createdAt),
    updatedAt: Timestamp.fromDate(subcontractor.updatedAt),
  }
}

export async function persistGuidedSetup(
  input: PersistGuidedSetupInput
): Promise<PersistGuidedSetupResult> {
  const db = getFirebaseDb()
  const { organizationId, adminUserId, guidedData } = input
  const now = new Date()

  const project = guidedData.project
  const projectClientName = project.clientName.trim()
  const clientStepName = guidedData.client.name.trim()

  if (
    !project.jobNumber.trim() ||
    !project.siteName.trim() ||
    !project.startDate ||
    !project.endDate ||
    !projectClientName
  ) {
    throw new Error('Project setup is incomplete. Job number, site name, dates and client name are required.')
  }

  let projectClient: { id: string; name: string; email?: string; phone?: string }

  const namesDiffer =
    clientStepName &&
    projectClientName &&
    normalizeName(clientStepName) !== normalizeName(projectClientName)

  if (namesDiffer) {
    const fromProject = await createClientRecord(organizationId, {
      name: projectClientName,
    })
    await createClientRecord(organizationId, {
      name: clientStepName,
      email: guidedData.client.email,
      phone: guidedData.client.phone,
    })
    projectClient = fromProject
  } else {
    const resolvedName = clientStepName || projectClientName
    projectClient = await createClientRecord(organizationId, {
      name: resolvedName,
      email: guidedData.client.email,
      phone: guidedData.client.phone,
    })
  }

  const projectId = newUuid()
  const clientForProject = {
    id: projectClient.id,
    name: projectClient.name,
    email: projectClient.email,
    phone: projectClient.phone,
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
    client: clientForProject,
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    jobType: project.jobType || 'CAT A',
    isLive: true,
  })
  const collectionName = project.jobType === 'Small Works' ? 'smallWorks' : 'projects'
  await setDoc(doc(db, 'organizations', organizationId, collectionName, projectId), payload)

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
      hasEndDate: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  }

  const settingsRef = doc(db, 'organizations', organizationId, 'settings', 'jobTypes')
  const existing = await getDoc(settingsRef)
  const current = existing.exists()
    ? (existing.data().jobTypes as string[] | undefined) ?? []
    : []
  const jobTypeNames = new Set(current)
  const customJobType = guidedData.jobType.name.trim()
  if (customJobType) jobTypeNames.add(customJobType)
  if (project.jobType.trim()) jobTypeNames.add(project.jobType.trim())
  await setDoc(
    settingsRef,
    { jobTypes: Array.from(jobTypeNames), updatedAt: Timestamp.now() },
    { merge: true }
  )

  const wholesaler = buildWholesalerFromGuided(guidedData.wholesaler, now)
  if (wholesaler) {
    await setDoc(
      doc(db, 'organizations', organizationId, 'wholesalers', wholesaler.id),
      wholesalerPayload(wholesaler)
    )
  }

  const subcontractor = buildSubcontractorFromGuided(guidedData.subcontractor, now)
  if (subcontractor) {
    await setDoc(
      doc(db, 'organizations', organizationId, 'subcontractors', subcontractor.id),
      subcontractorPayload(subcontractor)
    )
  }

  const teamOnboarding: TeamOnboardingState = {
    status: 'pending_add_users',
    addUsersGuideShown: false,
  }

  await updateDoc(doc(db, 'organizations', organizationId), {
    teamOnboarding,
    guidedSetupPersistedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  const { ensurePrimaryOrgMembership } = await import('@/lib/orgMembership/membershipService')
  await ensurePrimaryOrgMembership(adminUserId, organizationId, 'admin')

  return { teamOnboarding }
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

  const result = await persistGuidedSetup({
    organizationId,
    organizationName: String(data.name || 'Your organisation'),
    adminUserId,
    guidedData: draft,
  })
  await updateDoc(doc(db, 'organizations', organizationId), {
    guidedSetupDraft: null,
    updatedAt: Timestamp.now(),
  })
  return result
}

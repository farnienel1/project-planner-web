import { Timestamp } from 'firebase/firestore'
import type { Client, Project } from '@/types'

export type ProjectSaveInput = {
  id: string
  organizationId: string
  jobNumber: string
  siteName: string
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
  client: Client
  startDate: Date
  endDate: Date
  jobType: string
  customJobType?: string
  managerId?: string
  managerIds?: string[]
  managerLegacy?: string
  isLive: boolean
  description?: string
  notes?: string
  latitude?: number
  longitude?: number
  usesMapPinForLocation?: boolean
  hiddenManagerUserIds?: string[]
  hiddenOperativeUserIds?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export function buildProjectFirestorePayload(input: ProjectSaveInput): Record<string, unknown> {
  const siteAddress = [input.addressLine1, input.addressLine2, input.townCity, input.postcode]
    .filter(Boolean)
    .join(', ')

  const payload: Record<string, unknown> = {
    jobNumber: input.jobNumber.trim(),
    siteName: input.siteName.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || '',
    townCity: input.townCity.trim(),
    postcode: input.postcode.trim(),
    siteAddress,
    client: {
      id: input.client.id,
      name: input.client.name,
      email: input.client.email || '',
      phone: input.client.phone || '',
    },
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    jobType: input.jobType,
    manager: input.managerLegacy || 'Project Manager',
    isLive: input.isLive,
    description: input.description?.trim() || '',
    notes: input.notes?.trim() || '',
    organizationId: input.organizationId,
    createdAt: Timestamp.fromDate(input.createdAt || new Date()),
    updatedAt: Timestamp.fromDate(input.updatedAt || new Date()),
    usesMapPinForLocation: input.usesMapPinForLocation === true,
    hiddenManagerUserIds: input.hiddenManagerUserIds ?? [],
    hiddenOperativeUserIds: input.hiddenOperativeUserIds ?? [],
  }

  if (input.customJobType?.trim()) payload.customJobType = input.customJobType.trim()
  if (input.managerId) payload.managerId = input.managerId
  if (input.managerIds && input.managerIds.length > 0) {
    payload.managerIds = input.managerIds
    if (!input.managerId) payload.managerId = input.managerIds[0]
  }
  if (input.latitude != null) payload.latitude = input.latitude
  if (input.longitude != null) payload.longitude = input.longitude

  return payload
}

export function projectCollectionName(jobType: string, isSmallWorksCollection?: boolean): 'projects' | 'smallWorks' {
  if (isSmallWorksCollection) return 'smallWorks'
  if (jobType === 'Small Works' || jobType === 'smallWork') return 'smallWorks'
  return 'projects'
}

export function projectToSaveInput(project: Project, organizationId: string): ProjectSaveInput {
  return {
    id: project.id,
    organizationId,
    jobNumber: project.jobNumber,
    siteName: project.siteName,
    addressLine1: project.addressLine1,
    addressLine2: project.addressLine2,
    townCity: project.townCity,
    postcode: project.postcode,
    client: project.client,
    startDate: project.startDate,
    endDate: project.endDate,
    jobType: project.jobType,
    customJobType: project.customJobType,
    managerId: project.managerId,
    managerIds: project.managerIds,
    managerLegacy: project.manager?.name,
    isLive: project.isLive,
    description: project.description,
    notes: project.notes,
    latitude: project.latitude,
    longitude: project.longitude,
    usesMapPinForLocation: project.usesMapPinForLocation,
    hiddenManagerUserIds: project.hiddenManagerUserIds ?? [],
    hiddenOperativeUserIds: project.hiddenOperativeUserIds ?? [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

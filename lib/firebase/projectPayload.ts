import { Timestamp } from 'firebase/firestore'
import type { Client, Project } from '@/types'
import { jobKind } from '@/lib/canonical/staffAccess'

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
  /** Rulebook 1.10.0: `jobManagerUserIds` — written with `managerIds` so the security rules know the managers. */
  managerUserIds?: string[]
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
    isLive: input.isLive,
    description: input.description?.trim() || '',
    organizationId: input.organizationId,
    createdAt: Timestamp.fromDate(input.createdAt || new Date()),
    updatedAt: Timestamp.fromDate(input.updatedAt || new Date()),
    usesMapPinForLocation: input.usesMapPinForLocation === true,
  }
  const managerName = input.managerLegacy?.trim()
  if (managerName && managerName.toLowerCase() !== 'custom') payload.manager = managerName
  if (input.hiddenManagerUserIds) payload.hiddenManagerUserIds = input.hiddenManagerUserIds
  if (input.hiddenOperativeUserIds) payload.hiddenOperativeUserIds = input.hiddenOperativeUserIds

  // Rulebook 1.31.0: null is a removal on an edit (`jobWriteFields` removes a field only when it is stored) and is
  // left out on a create. Switching a custom job type back to CAT A clears `customJobType`.
  payload.customJobType = input.customJobType?.trim() || null
  if (input.managerId) payload.managerId = input.managerId
  if (input.managerIds && input.managerIds.length > 0) {
    payload.managerIds = input.managerIds
    if (!input.managerId) payload.managerId = input.managerIds[0]
  } else if (input.managerIds) {
    // 1.31.0: clearing the managers removes all three fields together (as iOS does), never `managerUserIds: []` beside
    // a stale `managerIds` / `managerId`.
    payload.managerIds = null
    payload.managerId = null
    payload.managerUserIds = null
  }
  if (input.managerUserIds && input.managerUserIds.length > 0) payload.managerUserIds = input.managerUserIds
  else if (input.managerUserIds && payload.managerIds) payload.managerUserIds = []
  // 1.31.0: switching from a map pin to an address removes the pin's coordinates.
  payload.latitude = input.latitude != null ? input.latitude : input.usesMapPinForLocation === true ? undefined : null
  payload.longitude = input.longitude != null ? input.longitude : input.usesMapPinForLocation === true ? undefined : null
  if (payload.latitude === undefined) delete payload.latitude
  if (payload.longitude === undefined) delete payload.longitude

  return payload
}

/**
 * The collection a NEW job is saved to when the screen did not say (rulebook 1.11.0 `jobKind` with no collection
 * known). An existing job is always saved back to the collection it was read from (`Project.collection`).
 */
export function projectCollectionName(jobType: string, isSmallWorksCollection?: boolean): 'projects' | 'smallWorks' {
  if (isSmallWorksCollection) return 'smallWorks'
  return jobKind({ jobType }, null)
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
    // 1.31.0: the stored account ids too, so an edit's base matches what is stored (`jobWriteFields` groups the three).
    managerUserIds: project.managerUserIds,
    managerLegacy:
      project.manager?.name && project.manager.name.trim().toLowerCase() !== 'custom'
        ? project.manager.name
        : undefined,
    isLive: project.isLive,
    description: project.description,
    notes: project.notes,
    latitude: project.latitude,
    longitude: project.longitude,
    usesMapPinForLocation: project.usesMapPinForLocation,
    hiddenManagerUserIds: project.hiddenManagerUserIds,
    hiddenOperativeUserIds: project.hiddenOperativeUserIds,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

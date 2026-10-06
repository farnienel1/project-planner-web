/** New project and new small works share the iOS create gate: seven real fields, no starter name. */
export type ProjectCreateFieldInput = {
  jobNumber: string
  siteName: string
  addressLine1: string
  townCity: string
  postcode: string
  clientId: string
  managerIds: string[]
  useMapPin: boolean
  latitude: string
  longitude: string
}

export const PROJECT_CREATE_REQUIRED_FIELD_COUNT = 7

/** A new project or small work starts blank. Dates are filled separately; the name is not. */
export function emptyProjectCreateIdentity(): { jobNumber: string; siteName: string } {
  return { jobNumber: '', siteName: '' }
}

export function countFilledProjectCreateFields(form: ProjectCreateFieldInput): number {
  let count = 0
  if (form.jobNumber.trim()) count += 1
  if (form.siteName.trim()) count += 1
  const hasPin = Boolean(form.useMapPin && form.latitude && form.longitude)
  if (hasPin) count += 3
  else {
    if (form.addressLine1.trim()) count += 1
    if (form.townCity.trim()) count += 1
    if (form.postcode.trim()) count += 1
  }
  if (form.clientId) count += 1
  if (form.managerIds.length > 0) count += 1
  return count
}

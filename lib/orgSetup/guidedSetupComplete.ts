import type { GuidedSetupData } from '@/components/setup/GuidedOrgSetup'

/** True when the guided wizard collected enough to write a first project. */
export function hasRequiredGuidedProject(guidedData: GuidedSetupData): boolean {
  const project = guidedData.project
  const clientName = project.clientName.trim() || guidedData.client.name.trim()
  return Boolean(
    project.jobNumber.trim() &&
      project.siteName.trim() &&
      project.startDate &&
      project.endDate &&
      clientName
  )
}

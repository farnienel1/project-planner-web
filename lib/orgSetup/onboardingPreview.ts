/**
 * Rulebook 1.85.0 §33: the Getting started list on the setup wizard's last screen (Review & Pay), from the wizard's
 * draft as it will be written (`orgSetupSettingsToFirestoreFields`), through the one rule (`onboardingChecklist`).
 * The company has no other people, invitations or documents yet; the guided project counts as its first job.
 */

import { onboardingChecklist, type OnboardingChecklist } from '@/lib/canonical/onboardingChecklist'
import { orgSetupSettingsToFirestoreFields, type OrgSetupSettings } from '@/lib/orgSetup/orgSetupSettings'

export function setupOnboardingChecklist(input: {
  settings: OrgSetupSettings
  organizationName: string
  guidedProjectName?: string | null
}): OnboardingChecklist {
  const fields = orgSetupSettingsToFirestoreFields(input.settings, '')
  const logo = input.settings.identity.companyLogoURL || (input.settings.identity.logoFile ? 'pending-upload' : '')
  return onboardingChecklist(
    { ...fields, name: input.organizationName, companyLogoURL: logo },
    { people: 0, pendingInvites: 0, jobs: String(input.guidedProjectName ?? '').trim() ? 1 : 0, complianceDocuments: 0 }
  )
}

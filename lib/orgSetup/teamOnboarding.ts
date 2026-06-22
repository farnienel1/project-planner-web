export type TeamOnboardingStatus = 'pending_manager' | 'pending_operative' | 'complete'

export type TeamOnboardingState = {
  status: TeamOnboardingStatus
  managerUserId?: string
  operativeUserId?: string
  managerName?: string
  operativeName?: string
  managerPermissionsConfigured?: boolean
  operativePermissionsConfigured?: boolean
}

export function parseTeamOnboarding(data: unknown): TeamOnboardingState | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const status = raw.status
  if (status !== 'pending_manager' && status !== 'pending_operative' && status !== 'complete') {
    return null
  }
  return {
    status,
    managerUserId: typeof raw.managerUserId === 'string' ? raw.managerUserId : undefined,
    operativeUserId: typeof raw.operativeUserId === 'string' ? raw.operativeUserId : undefined,
    managerName: typeof raw.managerName === 'string' ? raw.managerName : undefined,
    operativeName: typeof raw.operativeName === 'string' ? raw.operativeName : undefined,
    managerPermissionsConfigured: raw.managerPermissionsConfigured === true,
    operativePermissionsConfigured: raw.operativePermissionsConfigured === true,
  }
}

export function shouldShowTeamOnboarding(
  onboarding: TeamOnboardingState | null | undefined,
  isAdmin: boolean
): boolean {
  if (!isAdmin || !onboarding) return false
  if (onboarding.status === 'complete') return false
  return onboarding.status === 'pending_manager' || onboarding.status === 'pending_operative'
}

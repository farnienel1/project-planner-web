export type TeamOnboardingStatus = 'pending_add_users' | 'complete'

export type TeamOnboardingState = {
  status: TeamOnboardingStatus
  addUsersGuideShown?: boolean
  /** @deprecated Legacy guided-setup manager flow */
  managerUserId?: string
  /** @deprecated Legacy guided-setup operative flow */
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
  if (
    status !== 'pending_add_users' &&
    status !== 'complete' &&
    status !== 'pending_manager' &&
    status !== 'pending_operative'
  ) {
    return null
  }

  const normalizedStatus: TeamOnboardingStatus =
    status === 'pending_manager' || status === 'pending_operative'
      ? 'complete'
      : (status as TeamOnboardingStatus)

  return {
    status: normalizedStatus,
    addUsersGuideShown: raw.addUsersGuideShown === true,
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
  return onboarding.status === 'pending_add_users' && !onboarding.addUsersGuideShown
}

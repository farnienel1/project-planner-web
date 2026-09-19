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

/** Close the first-login “add your team” prompt without waiting on Firestore. */
export function teamOnboardingAfterGuideShown(onboarding: TeamOnboardingState): TeamOnboardingState {
  return {
    status: 'complete',
    addUsersGuideShown: true,
    ...(onboarding.managerUserId ? { managerUserId: onboarding.managerUserId } : {}),
    ...(onboarding.operativeUserId ? { operativeUserId: onboarding.operativeUserId } : {}),
    ...(onboarding.managerName ? { managerName: onboarding.managerName } : {}),
    ...(onboarding.operativeName ? { operativeName: onboarding.operativeName } : {}),
    ...(onboarding.managerPermissionsConfigured
      ? { managerPermissionsConfigured: true }
      : {}),
    ...(onboarding.operativePermissionsConfigured
      ? { operativePermissionsConfigured: true }
      : {}),
  }
}

export function teamOnboardingWritePayload(onboarding: TeamOnboardingState): Record<string, unknown> {
  const next = teamOnboardingAfterGuideShown(onboarding)
  return JSON.parse(JSON.stringify(next)) as Record<string, unknown>
}

const dismissedOrgIds = new Set<string>()

export function teamOnboardingDismissStorageKey(organizationId: string): string {
  return `pp.teamOnboardingGuideShown.${organizationId}`
}

export function markTeamOnboardingDismissedLocally(organizationId: string): void {
  dismissedOrgIds.add(organizationId)
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(teamOnboardingDismissStorageKey(organizationId), '1')
  } catch {
    // private mode
  }
}

export function isTeamOnboardingDismissedLocally(organizationId: string | undefined): boolean {
  if (!organizationId) return false
  if (dismissedOrgIds.has(organizationId)) return true
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(teamOnboardingDismissStorageKey(organizationId)) === '1') {
      dismissedOrgIds.add(organizationId)
      return true
    }
  } catch {
    return false
  }
  return false
}

export function resetTeamOnboardingDismissalsForTests(): void {
  dismissedOrgIds.clear()
}

/** Hide the prompt for this session even if Firestore still says pending. */
export function shouldShowTeamOnboardingPrompt(
  onboarding: TeamOnboardingState | null | undefined,
  isAdmin: boolean,
  organizationId: string | undefined
): boolean {
  if (isTeamOnboardingDismissedLocally(organizationId)) return false
  return shouldShowTeamOnboarding(onboarding, isAdmin)
}

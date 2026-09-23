export const EXISTING_LOGIN_CODE = 'pp/existing-login'
export const SWITCH_ORGANISATION_PATH = '/dashboard/change-organisation'

export class ExistingProjectPlannerLoginError extends Error {
  readonly code: typeof EXISTING_LOGIN_CODE = EXISTING_LOGIN_CODE
  readonly signedIn: boolean
  readonly isAdmin: boolean

  constructor(opts?: { signedIn?: boolean; isAdmin?: boolean }) {
    super('EXISTING_PROJECT_PLANNER_LOGIN')
    this.name = 'ExistingProjectPlannerLoginError'
    this.signedIn = opts?.signedIn === true
    this.isAdmin = opts?.isAdmin === true
  }
}

export function isExistingProjectPlannerLoginError(error: unknown): error is ExistingProjectPlannerLoginError {
  if (error instanceof ExistingProjectPlannerLoginError) return true
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === EXISTING_LOGIN_CODE
  )
}

/** Public /setup may finish a first pending org. It must not attach a second live firm. */
export function shouldBlockPublicSetupForExistingLogin(input: {
  allowAdditionalOrganization: boolean
  isAdditionalOrganization: boolean
}): boolean {
  return input.allowAdditionalOrganization !== true && input.isAdditionalOrganization === true
}

export function existingLoginSignInHref(email: string): string {
  const params = new URLSearchParams()
  const trimmed = email.trim()
  if (trimmed) params.set('email', trimmed)
  params.set('next', SWITCH_ORGANISATION_PATH)
  return `/login?${params.toString()}`
}

export function existingLoginResetHref(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return '/reset-password'
  return `/reset-password?email=${encodeURIComponent(trimmed)}`
}

export function existingLoginModalCopy(input: { email: string; signedIn: boolean; isAdmin: boolean }): {
  title: string
  paragraphs: string[]
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string | null
  secondaryHref: string | null
} {
  const paragraphs: string[] = []
  if (input.isAdmin) {
    paragraphs.push('You have already set up an organisation and are an admin of it.')
  }
  paragraphs.push(
    'This email is already in use. You can run as many organisations as you need from that same login — you do not create a second password.'
  )
  paragraphs.push(
    input.signedIn
      ? 'Open Switch organisation, then Set up a new organisation. You can name the new firm and pay for it there. Your other organisations stay as they are.'
      : 'Sign in, open Switch organisation, then Set up a new organisation. You can name the new firm and pay for it there. Your other organisations stay as they are.'
  )
  paragraphs.push('You stay in whichever organisation you last switched to.')

  return {
    title: 'You already have a Project Planner login',
    paragraphs,
    primaryLabel: input.signedIn ? 'Switch organisation' : 'Sign in',
    primaryHref: input.signedIn ? SWITCH_ORGANISATION_PATH : existingLoginSignInHref(input.email),
    secondaryLabel: input.signedIn ? null : 'Forgot password',
    secondaryHref: input.signedIn ? null : existingLoginResetHref(input.email),
  }
}

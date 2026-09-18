export function authErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: string }).code ?? '')
  }
  return ''
}

export function errorMessageOf(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return error instanceof Error ? error.message : ''
}

export function isEmailInUseError(error: unknown): boolean {
  const code = authErrorCode(error)
  const message = errorMessageOf(error)
  return (
    code === 'auth/email-already-in-use' ||
    /email-already-in-use/i.test(message) ||
    /email address is already in use/i.test(message) ||
    /account with this email already exists/i.test(message)
  )
}

export function isExistingAccountSignInError(error: unknown): boolean {
  const code = authErrorCode(error)
  const message = errorMessageOf(error)
  return (
    isEmailInUseError(error) ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    /auth\/wrong-password/i.test(message) ||
    /auth\/invalid-credential/i.test(message)
  )
}

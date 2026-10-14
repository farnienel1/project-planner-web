export function resolveMfaSigningSecret(input: { secret?: string; nodeEnv?: string }): string {
  const secret = (input.secret || '').trim()
  if (secret) return secret
  if ((input.nodeEnv || '').trim() === 'production') {
    throw new Error('MFA_SIGNING_SECRET is not configured')
  }
  return 'project-planner-mfa-dev'
}

export function mfaSigningSecret(): string {
  return resolveMfaSigningSecret({
    secret: process.env.MFA_SIGNING_SECRET,
    nodeEnv: process.env.NODE_ENV,
  })
}

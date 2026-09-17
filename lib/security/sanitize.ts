export function clientSafeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  const message = error.message
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/re_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/whsec_[A-Za-z0-9]+/g, '[redacted]')
  if (message.length > 280) return fallback
  return message
}

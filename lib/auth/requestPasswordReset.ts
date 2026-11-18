import { sendPasswordResetEmail, type Auth } from 'firebase/auth'
import { passwordResetActionSettings } from '@/lib/auth/passwordResetSettings'
import { emulatorsRequested } from '@/lib/firebase/emulators'

export const PASSWORD_RESET_ROUTE = '/api/auth/password-reset'

/**
 * Asks for a password reset email (owner request 17 Nov: our branded email, not Firebase's default).
 * Posts to `PASSWORD_RESET_ROUTE`, which answers the same whether or not the account exists. Only when the server
 * says it cannot send at all (503 `fallback: 'firebase'`), or the app runs on the local Auth emulator, does it ask
 * Firebase to send its own default email, so a reset is never lost. Throws on any other failure (429, network).
 */
export async function requestPasswordReset(auth: Auth, rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  const settings = passwordResetActionSettings(email)
  if (emulatorsRequested()) {
    await sendPasswordResetEmail(auth, email, settings)
    return
  }
  const response = await fetch(PASSWORD_RESET_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, continueUrl: settings.url }),
  })
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; fallback?: string; error?: string }
  if (response.ok && data.ok) return
  if (response.status === 503 && data.fallback === 'firebase') {
    await sendPasswordResetEmail(auth, email, settings)
    return
  }
  if (response.status === 429) throw new Error(data.error || 'Too many requests. Please try again shortly.')
  throw new Error(data.error || 'Could not send the password reset email.')
}

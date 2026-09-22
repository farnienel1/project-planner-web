import type { ActionCodeSettings } from 'firebase/auth'
import { loginPathForResetEmail } from '@/lib/auth/emailAction'

export function passwordResetActionSettings(email: string): ActionCodeSettings {
  const envBase = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/$/, '')
      : envBase
  const base = origin || 'https://www.projectplanner.us'
  return {
    url: `${base}${loginPathForResetEmail(email)}`,
    handleCodeInApp: false,
  }
}

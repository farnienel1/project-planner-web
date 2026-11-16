/**
 * Base URLs for the Google REST APIs the server routes call. In production these are always Google's hosts.
 * They switch to the local emulators only when BOTH the harness switch `NEXT_PUBLIC_USE_EMULATORS=1` is set AND the
 * standard emulator variable (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`) names a loopback host
 * (127.0.0.1, localhost or [::1]) with a port (review of #348, L4). Only the owner-console e2e harness sets them.
 */

const projectId = () => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''

export function emulatorHost(name: 'FIRESTORE_EMULATOR_HOST' | 'FIREBASE_AUTH_EMULATOR_HOST'): string {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== '1') return ''
  const value = (process.env[name] || '').trim()
  // A loopback host and a port only; anything else is ignored rather than turned into a URL.
  return /^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(value) ? value : ''
}

/** `.../v1/projects/{project}/databases/(default)/documents` (no trailing slash). */
export function firestoreDocumentsBase(project = projectId()): string {
  const host = emulatorHost('FIRESTORE_EMULATOR_HOST')
  const root = host ? `http://${host}` : 'https://firestore.googleapis.com'
  return `${root}/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`
}

/** The Identity Toolkit v1 base: `.../identitytoolkit.googleapis.com/v1`. */
export function identityToolkitBase(): string {
  const host = emulatorHost('FIREBASE_AUTH_EMULATOR_HOST')
  return host ? `http://${host}/identitytoolkit.googleapis.com/v1` : 'https://identitytoolkit.googleapis.com/v1'
}

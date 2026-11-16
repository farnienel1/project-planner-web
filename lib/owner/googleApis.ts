/**
 * Base URLs for the Google REST APIs the server routes call. In production these are always Google's hosts.
 * The standard emulator variables (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`) switch them to the local
 * emulators; they are set only by the owner-console end-to-end harness (scripts/owner-e2e) and never on Netlify.
 */

const projectId = () => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''

function emulatorHost(name: 'FIRESTORE_EMULATOR_HOST' | 'FIREBASE_AUTH_EMULATOR_HOST'): string {
  const value = (process.env[name] || '').trim()
  // host:port only; anything else is ignored rather than turned into a URL.
  return /^[A-Za-z0-9.-]+:\d{2,5}$/.test(value) ? value : ''
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

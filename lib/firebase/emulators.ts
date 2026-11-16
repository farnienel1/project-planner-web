import { connectAuthEmulator, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, type Firestore } from 'firebase/firestore'

/**
 * Local emulators for the owner-console end-to-end harness (scripts/owner-e2e). Only a build made with
 * NEXT_PUBLIC_USE_EMULATORS=1 talks to them; production builds never set it, so this is a no-op there.
 */
export function emulatorsRequested(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
}

const connectedAuth = new WeakSet<Auth>()
const connectedFirestore = new WeakSet<Firestore>()

export function withAuthEmulator(auth: Auth): Auth {
  if (!emulatorsRequested() || connectedAuth.has(auth)) return auth
  connectedAuth.add(auth)
  connectAuthEmulator(auth, process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true })
  return auth
}

export function withFirestoreEmulator(db: Firestore): Firestore {
  if (!emulatorsRequested() || connectedFirestore.has(db)) return db
  connectedFirestore.add(db)
  const [host, port] = (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
  connectFirestoreEmulator(db, host, Number(port))
  return db
}

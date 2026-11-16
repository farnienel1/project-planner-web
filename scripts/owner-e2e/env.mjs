// Environment for the owner-console e2e build and server. Emulator-only values; no secret here is real.
import { SEED_PROJECT_ID } from '../owner-console-seed/seedData.mjs'

export const E2E_PORT = Number(process.env.OWNER_E2E_PORT || 3100)

export function e2eEnv() {
  return {
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_USE_EMULATORS: '1',
    NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    NEXT_PUBLIC_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-emulator-api-key-not-real',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${SEED_PROJECT_ID}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: SEED_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${SEED_PROJECT_ID}.appspot.com`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
    NEXT_PUBLIC_APP_URL: `http://localhost:${E2E_PORT}`,
    MFA_SIGNING_SECRET: process.env.MFA_SIGNING_SECRET || 'owner-e2e-signing-secret-emulator-only',
    OWNER_E2E_BASE_URL: `http://localhost:${E2E_PORT}`,
  }
}

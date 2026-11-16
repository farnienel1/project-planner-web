// Seed constants with no file access, so the Playwright suite (run as CommonJS) can import them.
export const SEED_PROJECT_ID = 'demo-owner-console'
/** Every seeded login uses this password. Emulator only. */
export const SEED_PASSWORD = 'Seed-Passw0rd!'
export const OWNER_EMAIL = 'info@projectplanner.us'

/** Seed time: every stored instant is fixed relative to this, so expected figures never drift. */
export const SEED_NOW_MS = Date.parse('2026-11-16T12:00:00.000Z')

/** Auth accounts (uid = users document id). The e2e suite signs in as these. */
export const SEED_AUTH_USERS = [
  { uid: 'owner-uid', email: OWNER_EMAIL, displayName: 'Platform Owner', role: 'owner' },
  { uid: 'su-large', email: 'superadmin@large.example', displayName: 'Sam Super', role: 'superAdmin' },
  { uid: 'adm-large-1', email: 'admin1@large.example', displayName: 'Alex Admin', role: 'admin' },
  { uid: 'mgr-large-1', email: 'manager1@large.example', displayName: 'Mia Manager', role: 'manager' },
  { uid: 'op-large-001', email: 'op001@large.example', displayName: 'Olly Operative', role: 'operative' },
]


/**
 * The "Sign in faster with a passkey" reminder (owner 24 Nov). Shown once in the app after a sign-in with password +
 * emailed code (never after a passkey sign-in), while passkeys are on and this browser can use them, unless the person
 * chose "Don't remind me again" in this browser or their account already has a passkey. The red ✕ closes it until the
 * next password + code sign-in.
 *
 * Storage (judgement call, OWNER_DECISIONS 24 Nov): this browser only, keyed by the account's uid. Passkeys belong to a
 * device, so a new browser is a good moment to remind again; nothing is written to `users/{uid}` (its own-profile
 * allowlist, rulebook 1.64.0 §16, would refuse a new field).
 */

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** sessionStorage: the uid whose password + code sign-in just finished in this tab. */
export const PASSKEY_REMINDER_DUE_KEY = 'pp.passkeyReminder.due'
/** localStorage, per uid: "Don't remind me again" in this browser. */
export const passkeyReminderSilencedKey = (uid: string) => `pp.passkeyReminder.never:${uid}`

export const PASSKEY_REMINDER_TITLE = 'Sign in faster with a passkey'
export const PASSKEY_REMINDER_BODY =
  'Use Face ID, Touch ID or Windows Hello instead of your password and the emailed code. Set one up in Settings → Sign-in & password.'
export const PASSKEY_REMINDER_GO_LABEL = 'Take me to passkeys'
export const PASSKEY_REMINDER_NEVER_LABEL = "Don't remind me again"
export const PASSKEY_REMINDER_CLOSE_LABEL = 'Close, remind me next time'
/** Settings → Sign-in & password, at the passkeys section. */
export const PASSKEY_SETTINGS_HREF = '/dashboard/settings/password#passkeys'

function safe<T>(run: () => T, fallback: T): T {
  try {
    return run()
  } catch {
    return fallback
  }
}

/** Called when a code sign-in into the app (not the developer console) succeeds. */
export function markPasskeyReminderDue(uid: string, destination: string, store?: KeyValueStore | null): void {
  if (!uid || !store) return
  if (!destination.startsWith('/dashboard')) return
  safe(() => store.setItem(PASSKEY_REMINDER_DUE_KEY, uid), undefined)
}

/** Reads and clears the due mark; true only when it was set for this account. One reminder per code sign-in. */
export function takePasskeyReminderDue(uid: string, store?: KeyValueStore | null): boolean {
  if (!uid || !store) return false
  const due = safe(() => store.getItem(PASSKEY_REMINDER_DUE_KEY), null)
  if (due === null) return false
  safe(() => store.removeItem(PASSKEY_REMINDER_DUE_KEY), undefined)
  return due === uid
}

/** Sign-out: a due mark never carries over to the next sign-in in this tab (review of #449). */
export function clearPasskeyReminderDue(store?: KeyValueStore | null): void {
  if (!store) return
  safe(() => store.removeItem(PASSKEY_REMINDER_DUE_KEY), undefined)
}

export function isPasskeyReminderSilenced(uid: string, store?: KeyValueStore | null): boolean {
  if (!uid || !store) return false
  return safe(() => store.getItem(passkeyReminderSilencedKey(uid)), null) === '1'
}

export function silencePasskeyReminder(uid: string, store?: KeyValueStore | null): void {
  if (!uid || !store) return
  safe(() => store.setItem(passkeyReminderSilencedKey(uid), '1'), undefined)
}

/** Whether to ask the server for the passkey list at all (the list is read only when the reminder would show). */
export function passkeyReminderWorthChecking(input: { due: boolean; available: boolean; silenced: boolean }): boolean {
  return input.due && input.available && !input.silenced
}

/**
 * Never on top of another screen that needs the person first (review of #449): the forced-update screen
 * (`WebUpdateGate`) or the analytics consent prompt. The reminder waits until they are gone.
 */
export function passkeyReminderBlocked(input: { updateGateShown: boolean; consentPromptShown: boolean }): boolean {
  return input.updateGateShown || input.consentPromptShown
}

/** Show only when the account has no passkey; an unknown count (the list failed) never shows it. */
export function passkeyReminderShows(input: { due: boolean; available: boolean; silenced: boolean; passkeyCount: number | null }): boolean {
  if (!passkeyReminderWorthChecking(input)) return false
  return input.passkeyCount === 0
}

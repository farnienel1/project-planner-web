export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 200

export const PASSWORD_RULE_TEXT =
  'Use at least 12 characters with upper and lower case, a number, and a symbol.'

export const PASSWORD_COMMON_TEXT = 'That password is too common. Choose a different one.'
export const PASSWORD_BREACH_TEXT = 'That password has appeared in a data breach. Choose a different one.'
export const PASSWORD_TOO_LONG_TEXT = 'Password is too long.'

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'password123!',
  'passw0rd',
  'passw0rd!',
  'p@ssw0rd',
  'p@ssw0rd!',
  'p@ssword',
  'p@ssword1',
  'qwerty',
  'qwerty123',
  'qwerty123!',
  'letmein',
  'letmein1',
  'welcome',
  'welcome1',
  'welcome1!',
  'admin',
  'admin123',
  'admin123!',
  'iloveyou',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'dragon',
  'master',
  'monkey',
  'shadow',
  'abc123',
  'trustno1',
  'changeme',
  'changeme1',
  'login',
  'starwars',
  'whatever',
  'summer',
  'winter',
  'spring',
  'autumn',
  'secret',
  'default',
  'guest',
  'root',
  'test',
  'testing',
])

export type PasswordCheck = { ok: true } | { ok: false; message: string }

/**
 * Sign-in must accept whatever password is already on the account.
 * Strength rules apply only when a password is created or changed.
 */
export function existingPasswordAllowedForSignIn(_password: string): true {
  return true
}

export function checkNewPassword(password: string): PasswordCheck {
  if (password.length > PASSWORD_MAX_LENGTH) return { ok: false, message: PASSWORD_TOO_LONG_TEXT }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return { ok: false, message: PASSWORD_RULE_TEXT }
  }
  if (isVeryCommonPassword(password)) return { ok: false, message: PASSWORD_COMMON_TEXT }
  return { ok: true }
}

export function newPasswordError(password: string): string | null {
  const result = checkNewPassword(password)
  return result.ok ? null : result.message
}

function isVeryCommonPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase()
  if (COMMON_PASSWORDS.has(normalized)) return true
  const letters = normalized.replace(/[^a-z]/g, '')
  const rest = normalized.replace(/[a-z]/g, '')
  return letters.length >= 4 && letters.length <= 16 && COMMON_PASSWORDS.has(letters) && rest.length > 0 && rest.length <= 8
}

export type BreachCheck = 'clear' | 'leaked' | 'skipped'

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Have I Been Pwned k-anonymity range API. Only the first 5 hex characters of the
 * SHA-1 are sent. If egress blocks api.pwnedpasswords.com, or the request fails,
 * skip the network check. A network error must not reject a strong password.
 */
export async function passwordBreachStatus(
  password: string,
  lookup?: (prefix: string) => Promise<string>
): Promise<BreachCheck> {
  try {
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const body = lookup ? await lookup(prefix) : await fetchHibpRange(prefix)
    const leaked = body.split(/\r?\n/).some((line) => {
      const [found, count] = line.trim().split(':')
      return found?.toUpperCase() === suffix && Number(count) > 0
    })
    return leaked ? 'leaked' : 'clear'
  } catch {
    return 'skipped'
  }
}

async function fetchHibpRange(prefix: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'ProjectPlanner-password-check',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`hibp ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function validateNewPassword(
  password: string,
  lookup?: (prefix: string) => Promise<string>
): Promise<PasswordCheck & { breachCheck?: BreachCheck }> {
  const local = checkNewPassword(password)
  if (!local.ok) return local
  const breachCheck = await passwordBreachStatus(password, lookup)
  if (breachCheck === 'leaked') return { ok: false, message: PASSWORD_BREACH_TEXT, breachCheck }
  return { ok: true, breachCheck }
}

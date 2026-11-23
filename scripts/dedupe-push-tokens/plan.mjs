/**
 * Pure helpers for `scripts/dedupe-push-tokens.mjs` (rulebook §13 push tokens). No Firestore, no FCM: the script reads,
 * these decide, the script writes (only with --apply). The token-failure rule is the push function's own
 * (`functions/prunePushTokens.js`, `isTerminalPushTokenFailure` / `isCredentialPushFailure`), passed in so there is one
 * rule for "this token is dead".
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A stored `pushTokens` value as a de-duplicated list, stored order kept (iOS writes the newest token first). */
export function storedTokenList(raw) {
  const list = Array.isArray(raw) ? raw : [raw]
  const out = []
  for (const value of list) {
    const token = text(value)
    if (token && !out.includes(token)) out.push(token)
  }
  return out
}

/** The last 10 characters, for printing. A whole token is never printed. */
export function tokenSuffix(token) {
  return text(token).slice(-10)
}

/** The dry-run message FCM validates for one token (`sendEach(messages, true)`: validate only, nothing delivered). */
export function validationMessage(token) {
  return { token, data: { pushTokenCheck: '1' } }
}

/**
 * After a dry-run send: the tokens FCM rejected as dead (not registered, invalid registration token), and whether any
 * failure was the project's own credentials. A credential failure fails every token the same way, so the caller must
 * then remove nothing (the push function's rule: pruning on it wiped every phone's token once).
 */
export function validationResult(tokens, responses, { isTerminal, isCredential }) {
  const dead = []
  const otherFailures = []
  let credentialProblem = false
  const limit = Math.min(tokens.length, Array.isArray(responses) ? responses.length : 0)
  for (let i = 0; i < limit; i++) {
    const response = responses[i]
    if (!response || response.success === true) continue
    if (isCredential(response.error)) {
      credentialProblem = true
      continue
    }
    if (isTerminal(response.error)) dead.push(tokens[i])
    else otherFailures.push(tokens[i])
  }
  return { dead, otherFailures, credentialProblem }
}

/**
 * `--keep-newest`: keep only the first stored token (the iOS app writes the device's current token first) and remove
 * the rest. Every other phone of that person adds its token again the next time the app opens (the app saves its token
 * when the signed-in user loads). Nothing to remove when one token or none is stored.
 */
export function keepNewestPlan(raw) {
  const tokens = storedTokenList(raw)
  return { keep: tokens.slice(0, 1), remove: tokens.slice(1) }
}

/** One map of users id → tokens to remove, adding `remove` to whatever is already planned for that document. */
export function mergeRemovals(planned, userId, remove) {
  const id = text(userId)
  if (!id || !Array.isArray(remove) || remove.length === 0) return planned
  const next = new Map(planned)
  const current = next.get(id) || []
  const merged = [...current]
  for (const token of remove) {
    const value = text(token)
    if (value && !merged.includes(value)) merged.push(value)
  }
  next.set(id, merged)
  return next
}

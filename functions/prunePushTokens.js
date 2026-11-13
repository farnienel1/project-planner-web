'use strict'

/**
 * Server-side FCM housekeeping for users/{uid}.pushTokens.
 * iOS caps writes at 8 and can drop a token in recordPushTokenFailure, but the
 * phone never sees sendEach results. This module is the one prune rule for
 * inbox-push (timesheet reminders, and any other type that actually sends).
 *
 * Only token-level failures are dropped (not registered, invalid registration token). A project-level credential
 * failure ("Invalid APNs credential", third-party-auth-error, mismatched-credential) is the server's fault, fails
 * every token the same way, and is logged loudly instead — pruning on it wiped every phone's token.
 */

const MAX_STORED_PUSH_TOKENS = 8

function trimmed(value) {
  return String(value ?? '').trim()
}

function tokenSuffix(token) {
  const value = trimmed(token)
  return value.slice(-10)
}

function failureText(error) {
  if (!error || typeof error !== 'object') return String(error ?? '')
  const parts = [error.code, error.message]
  if (error.errorInfo && typeof error.errorInfo === 'object') {
    parts.push(error.errorInfo.code, error.errorInfo.message)
  }
  return parts.filter(Boolean).join(' ')
}

function failureCode(error) {
  if (!error || typeof error !== 'object') return ''
  const code = trimmed(error.code) || (error.errorInfo && trimmed(error.errorInfo.code)) || ''
  return code.toLowerCase()
}

/**
 * Project-level failures: the server's APNs key / FCM credentials are wrong or missing. Every token fails the same
 * way, so pruning on these would wipe every phone's token while the real fault is in the Firebase console
 * (Project settings → Cloud Messaging → Apple app configuration). Never prune; log loudly instead.
 */
const CREDENTIAL_FAILURE_CODES = new Set([
  'messaging/third-party-auth-error',
  'messaging/mismatched-credential',
  'messaging/invalid-apns-credentials',
  'messaging/authentication-error',
  'app/invalid-credential',
])

function isCredentialPushFailure(error) {
  if (CREDENTIAL_FAILURE_CODES.has(failureCode(error))) return true
  const text = failureText(error).toLowerCase()
  if (!text) return false
  return (
    text.includes('invalid apns credential') ||
    text.includes('third-party-auth-error') ||
    text.includes('mismatched-credential') ||
    text.includes('auth error from apns') ||
    text.includes('sender id mismatch')
  )
}

/** Token-level failures only: this one token is dead or malformed. */
function isTerminalPushTokenFailure(error) {
  if (isCredentialPushFailure(error)) return false
  const code = failureCode(error)
  if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
    return true
  }
  const text = failureText(error).toLowerCase()
  if (!text) return false
  // invalid-argument is only about this token when the message says so (a bad payload is also invalid-argument).
  if (code === 'messaging/invalid-argument' || text.includes('invalid-argument')) {
    return text.includes('registration token') || text.includes('registration-token')
  }
  return (
    text.includes('registration-token-not-registered') ||
    text.includes('invalid-registration-token') ||
    text.includes('invalid registration token') ||
    text.includes('unregistered')
  )
}

/** One short line per failed token for the function log: suffix and code, never the whole token. */
function sendFailureSummaries(tokens, responses) {
  if (!Array.isArray(tokens) || !Array.isArray(responses)) return []
  const out = []
  const limit = Math.min(tokens.length, responses.length)
  for (let i = 0; i < limit; i++) {
    const response = responses[i]
    if (!response || response.success === true) continue
    const error = response.error
    out.push({
      tokenSuffix: tokenSuffix(tokens[i]),
      code: failureCode(error) || 'unknown',
      message: trimmed(error && (error.message || (error.errorInfo && error.errorInfo.message))),
      credentialProblem: isCredentialPushFailure(error),
      pruned: isTerminalPushTokenFailure(error),
    })
  }
  return out
}

function tokensToRemoveAfterSend(tokens, responses) {
  if (!Array.isArray(tokens) || !Array.isArray(responses)) return []
  const removed = []
  const limit = Math.min(tokens.length, responses.length)
  for (let i = 0; i < limit; i++) {
    const token = trimmed(tokens[i])
    const response = responses[i]
    if (!token || !response || response.success === true) continue
    if (isTerminalPushTokenFailure(response.error)) {
      removed.push(token)
    }
  }
  return removed
}

function nextStoredPushTokens(tokens, responses) {
  const remove = new Set(tokensToRemoveAfterSend(tokens, responses))
  const kept = []
  const seen = new Set()
  const list = Array.isArray(tokens) ? tokens : []
  for (const raw of list) {
    const token = trimmed(raw)
    if (!token || remove.has(token) || seen.has(token)) continue
    seen.add(token)
    kept.push(token)
  }
  if (kept.length > MAX_STORED_PUSH_TOKENS) {
    return kept.slice(kept.length - MAX_STORED_PUSH_TOKENS)
  }
  return kept
}

async function pruneDeadPushTokens({ db, userId, tokens, responses, logger }) {
  const uid = trimmed(userId)
  const credentialFailures = sendFailureSummaries(tokens, responses).filter((row) => row.credentialProblem)
  if (credentialFailures.length > 0 && logger && typeof logger.error === 'function') {
    logger.error('PUSH CREDENTIAL ERROR: APNs/FCM credentials rejected; tokens NOT pruned. Check Firebase console → Project settings → Cloud Messaging → Apple app configuration (APNs auth key, Key ID, Team ID).', {
      userId: uid,
      failures: credentialFailures,
    })
  }
  const removed = tokensToRemoveAfterSend(tokens, responses)
  if (!uid || removed.length === 0) return removed
  const { FieldValue } = require('firebase-admin/firestore')
  await db.doc(`users/${uid}`).update({
    pushTokens: FieldValue.arrayRemove(...removed),
  })
  if (logger && typeof logger.info === 'function') {
    logger.info('pruned dead push tokens', {
      userId: uid,
      suffixes: removed.map(tokenSuffix),
    })
  }
  return removed
}

module.exports = {
  MAX_STORED_PUSH_TOKENS,
  CREDENTIAL_FAILURE_CODES,
  tokenSuffix,
  failureCode,
  isCredentialPushFailure,
  isTerminalPushTokenFailure,
  sendFailureSummaries,
  tokensToRemoveAfterSend,
  nextStoredPushTokens,
  pruneDeadPushTokens,
}

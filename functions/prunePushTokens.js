'use strict'

/**
 * Server-side FCM housekeeping for users/{uid}.pushTokens.
 * iOS caps writes at 8 and can drop a token in recordPushTokenFailure, but the
 * phone never sees sendEach results. This module is the one prune rule for
 * inbox-push (timesheet reminders, and any other type that actually sends).
 *
 * Live failures that must be dropped (suffixes only): nRdb68cBqg, uVbSMai8lA.
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

function isTerminalPushTokenFailure(error) {
  const text = failureText(error).toLowerCase()
  if (!text) return false
  return (
    text.includes('invalid apns credential') ||
    text.includes('registration-token-not-registered') ||
    text.includes('invalid-registration-token') ||
    text.includes('invalid registration token') ||
    text.includes('unregistered')
  )
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
  tokenSuffix,
  isTerminalPushTokenFailure,
  tokensToRemoveAfterSend,
  nextStoredPushTokens,
  pruneDeadPushTokens,
}

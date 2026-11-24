import { NextRequest } from 'next/server'
import { apiFlag, apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimit, enforceRateLimitKey, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { isValidDocumentId } from '@/lib/security/validation'
import { ownerFreshnessRefusal, requireOwnerSession } from '@/lib/owner/requireOwner'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, beginOwnerAudit, type OwnerAuditRun } from '@/lib/owner/ownerAudit'
import { ownerJson } from '@/lib/owner/ownerReadRoute'
import { OwnerPersonNotFoundError, loadOwnerPerson, ownerPersonEmails } from '@/lib/owner/personServer'
import { ownerReasonError } from '@/lib/owner/personActions'
import { adminLookupAuthRecords, adminRevokeRefreshTokens, firebaseAdminConfigured } from '@/lib/owner/identityToolkitAdmin'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { maskEmail } from '@/lib/auth/maskEmail'

export const runtime = 'nodejs'

/**
 * POST /api/owner/actions/revoke-sessions `{ uid, reason, preview? }` — "Sign out everywhere" (PLAN §4, D14). Revokes
 * the Firebase refresh tokens of every Auth account of the person (each users document of theirs that is a login;
 * invite placeholders have none), so every device must sign in again once its current ID token runs out (at most an
 * hour; apps listening to the auth-claims marker sooner). Needs the server key. Never the owner. `preview: true` is a
 * dry run; the action needs a code entered within 10 minutes and a reason, and is audited before it acts.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-revoke-sessions', 20, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwnerSession(request)
  if (!isFirebaseUser(owner)) return owner
  const perOwner = enforceRateLimitKey('owner-revoke-sessions:uid', owner.uid, 20, 10 * 60 * 1000)
  if (perOwner) return perOwner
  const body = await readApiBody(request, apiObject({ uid: apiText(128), reason: apiText(1000), preview: apiFlag() }))
  if (!body.ok) return body.response
  const preview = body.value.preview === true
  const uid = (body.value.uid || '').trim()
  if (!isValidDocumentId(uid)) return jsonError('Choose a person first.', 400)
  if (!preview) {
    const reasonError = ownerReasonError(body.value.reason)
    if (reasonError) return jsonError(reasonError, 400)
  }
  const notFresh = ownerFreshnessRefusal(owner, preview)
  if (notFresh) return notFresh
  if (!firebaseAdminConfigured()) {
    return jsonError('Signing someone out needs the server key (FIREBASE_SERVICE_ACCOUNT_JSON) on Netlify. Nothing was changed.', 501)
  }

  let person: Awaited<ReturnType<typeof loadOwnerPerson>>
  try {
    person = await loadOwnerPerson(bearerToken(request), uid)
  } catch (error) {
    if (error instanceof OwnerPersonNotFoundError) return jsonError(error.message, 404)
    return jsonError('Could not read that person, so nothing was changed. Try again.', 503)
  }
  const ids = person.userDocs.map((doc) => doc.id)
  if (ids.includes(owner.uid) || ownerPersonEmails(person.userDocs).some((email) => isPlatformOwnerEmail(email))) {
    return jsonError('The owner account is not signed out from this console.', 400)
  }
  let accounts: Awaited<ReturnType<typeof adminLookupAuthRecords>>
  try {
    accounts = await adminLookupAuthRecords(ids)
  } catch {
    return jsonError('Could not look up the sign-in accounts. Nothing was changed. Try again.', 503)
  }
  const summary = accounts.map((account) => ({
    uid: account.uid,
    emailMasked: maskEmail(account.email),
    lastLoginAtMs: account.lastLoginAtMs,
    disabled: account.disabled,
  }))
  if (preview) return ownerJson({ preview: true, accounts: summary })
  if (!accounts.length) return jsonError('This person has no sign-in account, so there is nothing to sign out.', 400)

  let audit: OwnerAuditRun
  try {
    audit = await beginOwnerAudit(request, owner.uid, {
      action: 'ownerRevokeSessions',
      targetUserId: accounts[0].uid,
      targetOrgId: person.row.organizationIds[0] || undefined,
      reason: body.value.reason,
      after: { accounts: accounts.length },
    })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
  const failed: string[] = []
  for (const account of accounts) {
    try {
      await adminRevokeRefreshTokens(account.uid)
    } catch {
      failed.push(account.uid)
    }
  }
  if (failed.length === accounts.length) {
    await audit.fail('Could not revoke the refresh tokens.', { failed: failed.length })
    return jsonError('Could not sign this person out. Try again.', 502)
  }
  if (failed.length) await audit.fail('Some accounts were not signed out.', { signedOut: accounts.length - failed.length, failed: failed.length })
  else await audit.complete({ signedOut: accounts.length })
  return ownerJson({ ok: failed.length === 0, signedOut: accounts.length - failed.length, failed, requestId: audit.requestId })
}

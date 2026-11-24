import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { enforceRateLimitKey, isFirebaseUser, jsonError, requireFirebaseUser } from '@/lib/security/apiGuard'
import { bearerToken } from '@/lib/owner/firestoreRest'
import { consumeAuthEmailBudget } from '@/lib/auth/authEmailBudget'
import {
  ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS,
  orgComplianceShareLinkCreateFields,
  orgComplianceShareLinkState,
  orgComplianceSharePath,
  orgComplianceShareSelection,
} from '@/lib/canonical/orgCompliance'
import {
  createShareLink,
  listShareLinks,
  newShareToken,
  readComplianceAsCaller,
  shareLinkIdForToken,
  writeComplianceAudit,
} from '@/lib/compliance/server/complianceShare'

export const runtime = 'nodejs'

/**
 * Rulebook 1.83.0 §31: an admin creates (POST) or lists (GET) the organisation's 7-day share links. Who is an admin is
 * decided by the security rules: the caller's own token must be able to read `orgCompliance/documents`.
 */

const createSchema = apiObject({
  organizationId: apiText(200),
  documents: z.array(z.string().max(260)).max(ORG_COMPLIANCE_SHARE_MAX_DOCUMENTS * 2).optional().default([]),
})

function origin(request: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  return /^https:\/\//.test(configured) ? configured : request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const limited = enforceRateLimitKey('compliance-share-create', user.uid, 20, 60 * 60 * 1000)
  if (limited) return limited
  if (!(await consumeAuthEmailBudget('compliance-share-create', user.uid, 30, 24 * 60 * 60 * 1000))) {
    return jsonError('Too many links today. Try again tomorrow.', 429)
  }
  const body = await readApiBody(request, createSchema)
  if (!body.ok) return body.response
  const { organizationId } = body.value
  const read = await readComplianceAsCaller(bearerToken(request), organizationId)
  if (!read.ok) return jsonError(read.status === 403 ? 'Only an admin can share these documents.' : 'Try again.', read.status)
  const selection = orgComplianceShareSelection(read.documents, body.value.documents)
  if (selection.error) return jsonError(selection.error, 400)
  const token = newShareToken()
  const id = shareLinkIdForToken(token)!
  const nowMs = Date.now()
  const fields = orgComplianceShareLinkCreateFields({ organizationId, documents: selection.refs, createdBy: user.uid, nowMs })
  try {
    await createShareLink(id, fields, Number(fields.expiresAtMs))
  } catch {
    return jsonError('The link could not be made. Try again.', 503)
  }
  await writeComplianceAudit({ organizationId, action: 'link_created', linkId: id, actorUid: user.uid, documentCount: selection.refs.length })
  return NextResponse.json(
    { id, url: `${origin(request)}${orgComplianceSharePath(token)}`, expiresAtMs: fields.expiresAtMs, documentCount: selection.refs.length },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function GET(request: NextRequest) {
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user
  const limited = enforceRateLimitKey('compliance-share-list', user.uid, 120, 60 * 60 * 1000)
  if (limited) return limited
  const organizationId = (request.nextUrl.searchParams.get('organizationId') || '').trim().slice(0, 200)
  const read = await readComplianceAsCaller(bearerToken(request), organizationId)
  if (!read.ok) return jsonError(read.status === 403 ? 'Only an admin can see these links.' : 'Try again.', read.status)
  try {
    const nowMs = Date.now()
    const links = (await listShareLinks(organizationId)).map((link) => ({
      id: link.id,
      documents: link.documents.map((ref) => `${ref.section}:${ref.id}`),
      createdAtMs: link.createdAtMs,
      expiresAtMs: link.expiresAtMs,
      openCount: link.openCount,
      lastOpenedAtMs: link.lastOpenedAtMs,
      state: orgComplianceShareLinkState(link, nowMs),
    }))
    return NextResponse.json({ links }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('The links could not be loaded. Try again.', 503)
  }
}

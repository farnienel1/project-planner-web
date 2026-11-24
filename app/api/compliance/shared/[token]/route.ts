import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { consumeAuthEmailBudget } from '@/lib/auth/authEmailBudget'
import {
  ORG_COMPLIANCE_SHARE_MESSAGES,
  orgComplianceShareOpen,
  orgCompliancePublicDocuments,
  orgComplianceShareLinkState,
  orgComplianceTodayKey,
} from '@/lib/canonical/orgCompliance'
import { organizationTimeZone, resolveOrganizationCurrency } from '@/lib/canonical'
import {
  noteShareLinkOpened,
  readComplianceAsServer,
  readShareLink,
  shareLinkCreatorStillAdmin,
  shareLinkIdForToken,
  writeComplianceAudit,
} from '@/lib/compliance/server/complianceShare'
import { adminFirestoreGet } from '@/lib/stripe/writeOrgBilling'
import { restFieldsToPlain } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

/**
 * Rulebook 1.83.0 §31: the public, read-only view of a share link. No sign-in. Only the linked documents' own fields
 * (`orgCompliancePublicDocuments`) and the company's name — never who uploaded them or a storage path. Every failure
 * (unknown, expired, revoked, removed company) gets the same answer.
 */
const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }

function gone() {
  return NextResponse.json({ error: ORG_COMPLIANCE_SHARE_MESSAGES.gone }, { status: 404, headers: HEADERS })
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  // The token's shape first, so junk never costs a rate-limit read.
  const { token } = await context.params
  const id = shareLinkIdForToken(token)
  if (!id) return gone()
  const limited = enforceRateLimit(request, 'compliance-shared', 60, 60 * 1000)
  if (limited) return limited
  if (!(await consumeAuthEmailBudget('compliance-share-open', clientIp(request), 300, 60 * 60 * 1000))) {
    return jsonError('Too many requests. Please try again shortly.', 429)
  }
  try {
    const link = await readShareLink(id)
    const nowMs = Date.now()
    if (!link || orgComplianceShareLinkState(link, nowMs) !== 'active') return gone()
    const orgDoc = await adminFirestoreGet(`organizations/${encodeURIComponent(link.organizationId)}`)
    const org = orgDoc ? restFieldsToPlain(orgDoc.fields) : null
    // A company scheduled for deletion or lapsed shares nothing (as the security rules close it, §19, §20).
    if (!org || !orgComplianceShareOpen(org, Date.now())) return gone()
    // A link stops when the admin who made it stops being an active admin here (owner to confirm).
    if (!(await shareLinkCreatorStillAdmin(link, org))) return gone()
    const timeZone = organizationTimeZone(typeof org.countryCode === 'string' ? org.countryCode : 'GB')
    const documents = orgCompliancePublicDocuments(
      await readComplianceAsServer(link.organizationId),
      link.documents,
      orgComplianceTodayKey(nowMs, timeZone),
      resolveOrganizationCurrency(org)
    )
    await noteShareLinkOpened(link)
    await writeComplianceAudit({ organizationId: link.organizationId, action: 'link_opened', linkId: id })
    return NextResponse.json(
      {
        companyName: typeof org.name === 'string' && org.name.trim() ? org.name.trim() : 'Company',
        expiresAtMs: link.expiresAtMs,
        documents,
      },
      { headers: HEADERS }
    )
  } catch {
    return jsonError('Try again shortly.', 503)
  }
}

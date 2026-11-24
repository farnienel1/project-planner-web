import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { consumeAuthEmailBudget } from '@/lib/auth/authEmailBudget'
import {
  ORG_COMPLIANCE_SHARE_MESSAGES,
  orgComplianceShareOpen,
  ORG_COMPLIANCE_SIGNED_URL_SECONDS,
  orgCompliancePathBelongsTo,
  orgComplianceShareLinkState,
  orgComplianceSharedEntry,
} from '@/lib/canonical/orgCompliance'
import {
  readComplianceAsServer,
  readShareLink,
  shareLinkCreatorStillAdmin,
  shareLinkIdForToken,
  signedStorageUrl,
  writeComplianceAudit,
} from '@/lib/compliance/server/complianceShare'
import { adminFirestoreGet } from '@/lib/stripe/writeOrgBilling'
import { restFieldsToPlain } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

/**
 * Rulebook 1.83.0 §31: one shared file. Checks the link again, then redirects to a Storage URL signed for
 * `ORG_COMPLIANCE_SIGNED_URL_SECONDS` (60 s) — never a lasting download link. `?view=1` opens it in the browser.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string; key: string }> }) {
  // The token's shape first, so junk never costs a rate-limit read. `key` is already decoded by the router.
  const { token, key } = await context.params
  const id = shareLinkIdForToken(token)
  const gone = () => jsonError(ORG_COMPLIANCE_SHARE_MESSAGES.gone, 404)
  if (!id || typeof key !== 'string' || !key || key.length > 260) return gone()
  const limited = enforceRateLimit(request, 'compliance-shared-file', 60, 60 * 1000)
  if (limited) return limited
  if (!(await consumeAuthEmailBudget('compliance-share-open', clientIp(request), 300, 60 * 60 * 1000))) {
    return jsonError('Too many requests. Please try again shortly.', 429)
  }
  try {
    const link = await readShareLink(id)
    if (!link || orgComplianceShareLinkState(link, Date.now()) !== 'active') return gone()
    const orgDoc = await adminFirestoreGet(`organizations/${encodeURIComponent(link.organizationId)}`)
    const org = orgDoc ? restFieldsToPlain(orgDoc.fields) : null
    if (!org || !orgComplianceShareOpen(org, Date.now())) return gone()
    // A link stops when the admin who made it stops being an active admin here (owner to confirm).
    if (!(await shareLinkCreatorStillAdmin(link, org))) return gone()
    const entry = orgComplianceSharedEntry(await readComplianceAsServer(link.organizationId), link, key)
    // The file must be in this exact organisation's folder (the id compared exactly, never without case).
    if (!entry || !orgCompliancePathBelongsTo(entry.path, link.organizationId) || entry.path.split('/')[1] !== link.organizationId) {
      return gone()
    }
    const url = signedStorageUrl(entry.path, ORG_COMPLIANCE_SIGNED_URL_SECONDS, {
      inline: request.nextUrl.searchParams.get('view') === '1',
      fileName: entry.fileName,
    })
    if (!url) return jsonError('Sharing is not available right now.', 503)
    await writeComplianceAudit({ organizationId: link.organizationId, action: 'file_opened', linkId: id, documentKey: `${entry.section}:${entry.id}` })
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch {
    return jsonError('Try again shortly.', 503)
  }
}

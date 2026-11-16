import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { requireOwner } from '@/lib/owner/requireOwner'
import { OWNER_AUDIT_UNAVAILABLE_MESSAGE, recordOwnerEvent } from '@/lib/owner/ownerAudit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'owner-audit', 40, 10 * 60 * 1000)
  if (limited) return limited
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    targetUserId?: string
    targetOrgId?: string
    reason?: string
  }
  const action = (body.action || '').trim()
  if (!action) return jsonError('action is required', 400)
  // A one-entry record (PLAN A4, phase completed): nothing changes, so there is no requested/completed pair.
  // The browser only names the action; the server adds who, when, IP and user agent. Removed with PR 11.
  if (action.length > 80) return jsonError('action is too long', 400)
  try {
    const requestId = await recordOwnerEvent(request, owner.uid, {
      action,
      targetUserId: body.targetUserId,
      targetOrgId: body.targetOrgId,
      reason: body.reason,
    })
    return NextResponse.json({ ok: true, requestId })
  } catch {
    return jsonError(OWNER_AUDIT_UNAVAILABLE_MESSAGE, 502)
  }
}

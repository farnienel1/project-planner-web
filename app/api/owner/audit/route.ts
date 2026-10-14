import { NextRequest, NextResponse } from 'next/server'
import { clientIp, enforceRateLimit, isFirebaseUser, jsonError } from '@/lib/security/apiGuard'
import { requireOwner, writeAuditLog } from '@/lib/owner/requireOwner'

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
  await writeAuditLog(request, {
    action,
    actorUid: owner.uid,
    targetUserId: body.targetUserId,
    targetOrgId: body.targetOrgId,
    reason: body.reason,
    ip: clientIp(request),
  })
  return NextResponse.json({ ok: true })
}

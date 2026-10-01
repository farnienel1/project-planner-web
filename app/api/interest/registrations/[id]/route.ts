import { NextRequest, NextResponse } from 'next/server'
import {
  InterestAdminUnavailable,
  addInterestNoteAdmin,
  deleteInterestRegistrationAdmin,
  setInterestStatusAdmin,
} from '@/lib/interest/adminStore'
import { INTEREST_STATUSES, type InterestStatus } from '@/lib/interest/registration'
import { requireOwner } from '@/lib/owner/requireOwner'
import { isFirebaseUser, jsonError, readJsonBody } from '@/lib/security/apiGuard'

export const runtime = 'nodejs'

function cleanId(id: string): string | null {
  return /^[A-Za-z0-9]{1,128}$/.test(id) ? id : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const id = cleanId((await context.params).id)
  if (!id) return jsonError('That registration is not on the list.', 404)
  const body = await readJsonBody<{ status?: string; note?: string; authorName?: string }>(request)
  if (!body.ok) return body.response
  try {
    if (typeof body.value.status === 'string') {
      if (!(INTEREST_STATUSES as readonly string[]).includes(body.value.status)) {
        return jsonError('Unknown registration status.', 400)
      }
      await setInterestStatusAdmin(id, body.value.status as InterestStatus)
    }
    if (typeof body.value.note === 'string' && body.value.note.trim()) {
      await addInterestNoteAdmin(id, body.value.note, body.value.authorName || owner.email || 'Owner')
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] update failed', error)
    return jsonError('Could not update that registration.', 500)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner(request)
  if (!isFirebaseUser(owner)) return owner
  const id = cleanId((await context.params).id)
  if (!id) return jsonError('That registration is not on the list.', 404)
  try {
    await deleteInterestRegistrationAdmin(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InterestAdminUnavailable) {
      return jsonError('Registration storage is not configured.', 503)
    }
    console.error('[interest] delete failed', error)
    return jsonError('Could not delete that registration.', 500)
  }
}

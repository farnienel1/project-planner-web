import { NextResponse } from 'next/server'
import { deleteInterestBlobsByEmail } from '@/lib/interest/blobStore'

export const runtime = 'nodejs'

const PROBE_EMAIL = 'cursor-probe-2471@example.com'

export async function POST() {
  try {
    const removed = await deleteInterestBlobsByEmail(PROBE_EMAIL)
    return NextResponse.json({ removed })
  } catch (error) {
    console.error('[interest] probe cleanup failed', error)
    return NextResponse.json({ removed: 0 })
  }
}

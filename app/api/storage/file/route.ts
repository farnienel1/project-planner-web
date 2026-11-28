import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { storageFilePathAllowed } from '@/lib/firebase/storageFilePath'

export const runtime = 'nodejs'

/** Larger files are refused (site audit photos are about 1 MB; Netlify functions cap a response at about 6 MB). */
const MAX_BYTES = 6 * 1024 * 1024

/**
 * GET /api/storage/file?path=organizations/… — one Storage object's bytes, read on the server AS THE CALLER (their
 * Firebase ID token, and their App Check token when sent), so the Storage rules decide exactly as for the browser.
 * Used only when the browser's own fetch of the download URL fails (no bucket CORS; owner report 26 Nov). Fixed host
 * and bucket (no other URL can be fetched); the answer is never rendered on this origin (attachment, nosniff, sandbox).
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'storage-file', 600, 10 * 60 * 1000)
  if (limited) return limited

  const header = request.headers.get('authorization') || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!idToken) return jsonError('Sign in required', 401)

  const path = request.nextUrl.searchParams.get('path')
  if (!storageFilePathAllowed(path)) return jsonError('Not a file this app can read.', 400)
  const bucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim()
  if (!bucket) return jsonError('File storage is not configured.', 503)

  const headers: Record<string, string> = { Authorization: `Firebase ${idToken}` }
  const appCheck = (request.headers.get('x-firebase-appcheck') || '').trim()
  if (appCheck) headers['X-Firebase-AppCheck'] = appCheck

  let upstream: Response
  try {
    upstream = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(20_000) }
    )
  } catch {
    return jsonError('The file could not be read. Try again.', 502)
  }
  if (!upstream.ok) {
    const status = upstream.status === 401 || upstream.status === 403 || upstream.status === 404 ? upstream.status : 502
    return jsonError('The file could not be read.', status)
  }
  const declared = Number(upstream.headers.get('content-length') || '0')
  if (declared > MAX_BYTES) return jsonError('The file is too large to read here.', 413)
  const bytes = new Uint8Array(await upstream.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) return jsonError('The file is too large to read here.', 413)

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  })
}

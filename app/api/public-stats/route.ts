import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function roundDown(value: number, step: number): number | null {
  if (!Number.isFinite(value) || value < step) return null
  return Math.floor(value / step) * step
}

export async function GET() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/publicStats/platform`
    )
    if (!response.ok) {
      return NextResponse.json(
        {
          timesheetValueGbp: null,
          timesheetsSigned: null,
          hoursLogged: null,
          bookingsMade: null,
          organisations: null,
          note: 'Public stats publish after five real organisations exist. Totals are rounded down and never identify a customer.',
        },
        { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
      )
    }
    const body = (await response.json()) as { fields?: Record<string, { integerValue?: string; doubleValue?: number; nullValue?: null }> }
    const read = (key: string): number | null => {
      const field = body.fields?.[key]
      if (!field || 'nullValue' in field) return null
      if (field.integerValue) return Number(field.integerValue)
      if (typeof field.doubleValue === 'number') return field.doubleValue
      return null
    }
    return NextResponse.json(
      {
        timesheetValueGbp: roundDown(read('timesheetValueGbp') || 0, 100000),
        timesheetsSigned: roundDown(read('timesheetsSigned') || 0, 100),
        hoursLogged: roundDown(read('hoursLogged') || 0, 10000),
        bookingsMade: roundDown(read('bookingsMade') || 0, 1000),
        organisations: roundDown(read('organisations') || 0, 10),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}

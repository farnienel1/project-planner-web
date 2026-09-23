import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function roundDown(value: number, step: number): number | null {
  if (!Number.isFinite(value) || value < step) return null
  return Math.floor(value / step) * step
}

export async function GET() {
  const empty = {
    timesheetValueGbp: null,
    timesheetsSigned: null,
    hoursLogged: null,
    bookingsMade: null,
    organisations: null,
    updatedAt: new Date().toISOString(),
    note: 'Published only after at least 5 real organisations exist and a rollup has run.',
  }
  const rounded = {
    timesheetValueGbp: roundDown(0, 100_000),
    timesheetsSigned: roundDown(0, 100),
    hoursLogged: roundDown(0, 10_000),
    bookingsMade: roundDown(0, 1_000),
    organisations: roundDown(0, 10),
  }
  return NextResponse.json(
    { ...empty, ...rounded },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': 'https://www.projectplanner.us',
      },
    }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import {
  geocodeQuery,
  geocodeSiteInput,
  reverseGeocodeCoordinate,
} from '@/lib/maps/geocodingServer'

export const runtime = 'nodejs'

function parseCoordinate(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const latitude = parseCoordinate(searchParams.get('lat'))
  const longitude = parseCoordinate(searchParams.get('lon'))

  if (latitude != null && longitude != null) {
    const result = await reverseGeocodeCoordinate(latitude, longitude)
    if (!result) {
      return NextResponse.json({ error: 'Reverse geocode failed' }, { status: 404 })
    }
    return NextResponse.json(result)
  }

  const query = searchParams.get('q')?.trim()
  if (!query) {
    return NextResponse.json({ error: 'Missing q, or lat and lon' }, { status: 400 })
  }

  const point = await geocodeQuery(query)
  if (!point) {
    return NextResponse.json({ error: 'Geocode failed' }, { status: 404 })
  }

  return NextResponse.json(point)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = body as {
    site?: {
      addressLine1?: string
      addressLine2?: string
      townCity?: string
      postcode?: string
      siteName?: string
      siteAddress?: string
    }
    q?: string
  }

  if (payload.site) {
    const point = await geocodeSiteInput(payload.site)
    if (!point) {
      return NextResponse.json({ error: 'Geocode failed' }, { status: 404 })
    }
    return NextResponse.json(point)
  }

  const query = payload.q?.trim()
  if (!query) {
    return NextResponse.json({ error: 'Missing site or q' }, { status: 400 })
  }

  const point = await geocodeQuery(query)
  if (!point) {
    return NextResponse.json({ error: 'Geocode failed' }, { status: 404 })
  }

  return NextResponse.json(point)
}

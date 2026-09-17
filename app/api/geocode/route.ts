import { NextRequest } from 'next/server'
import {
  geocodeQuery,
  geocodeSiteInput,
  reverseGeocodeCoordinate,
} from '@/lib/maps/geocodingServer'
import {
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString } from '@/lib/security/validation'

export const runtime = 'nodejs'

function parseCoordinate(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'geocode-get', 60, 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const { searchParams } = request.nextUrl
  const latitude = parseCoordinate(searchParams.get('lat'))
  const longitude = parseCoordinate(searchParams.get('lon'))

  if (latitude != null && longitude != null) {
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return jsonError('Invalid coordinates', 400)
    }
    const result = await reverseGeocodeCoordinate(latitude, longitude)
    if (!result) {
      return jsonError('Reverse geocode failed', 404)
    }
    return Response.json(result)
  }

  const query = clampString(searchParams.get('q'), 200)
  if (!query) {
    return jsonError('Missing q, or lat and lon', 400)
  }

  const point = await geocodeQuery(query)
  if (!point) {
    return jsonError('Geocode failed', 404)
  }

  return Response.json(point)
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'geocode-post', 60, 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<{
    site?: {
      addressLine1?: string
      addressLine2?: string
      townCity?: string
      postcode?: string
      siteName?: string
      siteAddress?: string
    }
    q?: string
  }>(request)
  if (!body.ok) return body.response

  if (body.value.site) {
    const point = await geocodeSiteInput(body.value.site)
    if (!point) {
      return jsonError('Geocode failed', 404)
    }
    return Response.json(point)
  }

  const query = clampString(body.value.q, 200)
  if (!query) {
    return jsonError('Missing site or q', 400)
  }

  const point = await geocodeQuery(query)
  if (!point) {
    return jsonError('Geocode failed', 404)
  }

  return Response.json(point)
}

/**
 * Test double for the Firestore REST calls the owner routes make: list a collection, runQuery and
 * runAggregationQuery (count) with EQUAL / IN / AND filters, and adminAuditLog writes. Collections come from the
 * owner-console seed. Used by the route tests only.
 */
import { fromRestValue, toRestFields } from '../../scripts/owner-console-seed/restValues.mjs'

type Doc = { id: string; data: Record<string, unknown> }
export type FakeCollections = Record<string, Doc[]>

function readPath(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), data)
}

function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value
}

function matches(doc: Doc, filter: Record<string, unknown> | undefined): boolean {
  if (!filter) return true
  const composite = filter.compositeFilter as { filters: Record<string, unknown>[] } | undefined
  if (composite) return composite.filters.every((inner) => matches(doc, inner))
  const field = filter.fieldFilter as { field: { fieldPath: string }; op: string; value: Record<string, unknown> }
  const actual = plain(readPath(doc.data, field.field.fieldPath))
  const expected = fromRestValue(field.value)
  if (field.op === 'EQUAL') return actual === expected
  if (field.op === 'IN') return Array.isArray(expected) && expected.includes(actual)
  // Range filters on timestamps: both sides are ISO text here, which sorts in time order.
  if (field.op === 'GREATER_THAN_OR_EQUAL') return typeof actual === 'string' && typeof expected === 'string' && actual >= expected
  if (field.op === 'LESS_THAN_OR_EQUAL') return typeof actual === 'string' && typeof expected === 'string' && actual <= expected
  throw new Error(`fake backend: op ${field.op} not supported`)
}

export type FakeBackend = {
  calls: { method: string; url: string }[]
  auditWrites: Record<string, { stringValue?: string }>[]
}

/**
 * Replaces global fetch. `auth` answers accounts:lookup for the token (the signed-in user). Returns what was called.
 */
export function installFakeFirestore(
  collections: FakeCollections,
  auth: { localId: string; email: string; emailVerified: boolean },
  options: { refuse?: boolean } = {}
): FakeBackend {
  const backend: FakeBackend = { calls: [], auditWrites: [] }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    backend.calls.push({ method, url })
    if (url.includes('accounts:lookup')) {
      return new Response(JSON.stringify({ users: [{ ...auth, createdAt: '1000' }] }))
    }
    if (options.refuse) return new Response('{"error":{"status":"PERMISSION_DENIED"}}', { status: 403 })
    if (url.endsWith('/adminAuditLog') && method === 'POST') {
      backend.auditWrites.push(JSON.parse(String(init?.body)).fields)
      return new Response('{}')
    }
    if (url.endsWith(':runQuery') || url.endsWith(':runAggregationQuery')) {
      const body = JSON.parse(String(init?.body))
      const query = body.structuredQuery || body.structuredAggregationQuery.structuredQuery
      // A query under a parent document (`…/documents/organizations/ORG:runAggregationQuery`) reads
      // `organizations/ORG/<collectionId>`; a root query reads `<collectionId>`.
      const docsMarker = '/documents/'
      const runIndex = url.lastIndexOf(':run')
      const parent = url.includes(docsMarker) ? decodeURIComponent(url.slice(url.indexOf(docsMarker) + docsMarker.length, runIndex)) : ''
      const key = parent ? `${parent}/${query.from[0].collectionId}` : query.from[0].collectionId
      const rows = (collections[key] || []).filter((doc) => matches(doc, query.where))
      if (url.endsWith(':runAggregationQuery')) {
        return new Response(JSON.stringify([{ result: { aggregateFields: { n: { integerValue: String(rows.length) } } } }]))
      }
      return new Response(
        JSON.stringify(rows.map((doc) => ({ document: { name: `projects/demo/databases/(default)/documents/${query.from[0].collectionId}/${doc.id}`, fields: toRestFields(doc.data) } })))
      )
    }
    const marker = '/documents/'
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split('?')[0])
    const parts = path.split('/')
    if (parts.length % 2 === 1) {
      const docs = collections[path] || []
      return new Response(
        JSON.stringify({ documents: docs.map((doc) => ({ name: `projects/demo/databases/(default)/documents/${path}/${doc.id}`, fields: toRestFields(doc.data) })) })
      )
    }
    const collection = parts.slice(0, -1).join('/')
    const doc = (collections[collection] || []).find((entry) => entry.id === parts[parts.length - 1])
    return doc ? new Response(JSON.stringify({ fields: toRestFields(doc.data) })) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return backend
}

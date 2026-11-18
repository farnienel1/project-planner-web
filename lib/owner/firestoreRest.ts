import { firestoreDocumentsBase } from '@/lib/owner/googleApis'

function docUrl(path: string) {
  return `${firestoreDocumentsBase()}/${path}`
}

export async function firestoreGet(idToken: string, path: string) {
  const response = await fetch(docUrl(path), { headers: { Authorization: `Bearer ${idToken}` } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Could not read ${path}`)
  return (await response.json()) as { fields?: Record<string, unknown> }
}

export async function firestorePatch(
  idToken: string,
  path: string,
  fields: Record<string, unknown>,
  fieldPaths: string[]
) {
  const url = `${docUrl(path)}?${fieldPaths.map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`).join('&')}`
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Could not update ${path}`)
  }
}

/**
 * Creates `path` with only server-time fields (`serverTimeFields`), and only when it does not exist yet (a document
 * already there is left as it is). Returns false when it was not written (already there, or refused).
 */
export async function firestoreCreateServerTime(idToken: string, path: string, serverTimeFields: readonly string[]): Promise<boolean> {
  const base = firestoreDocumentsBase()
  const name = `${base.replace(/^https?:\/\/[^/]+\/v1\//, '')}/${path}`
  const response = await fetch(`${base}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        {
          update: { name, fields: {} },
          currentDocument: { exists: false },
          updateTransforms: serverTimeFields.map((fieldPath) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })),
        },
      ],
    }),
  })
  return response.ok
}

/** Document paths under parentPath whose field equals value. Empty when the query is not allowed. */
export async function firestoreQueryEqual(
  idToken: string,
  parentPath: string,
  collectionId: string,
  field: string,
  value: string
): Promise<string[]> {
  const url = `${firestoreDocumentsBase()}/${parentPath}:runQuery`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
      },
    }),
  })
  if (!response.ok) return []
  const rows = (await response.json().catch(() => [])) as { document?: { name?: string } }[]
  return rows
    .map((row) => row.document?.name || '')
    .map((name) => {
      const marker = '/documents/'
      const index = name.indexOf(marker)
      return index >= 0 ? name.slice(index + marker.length) : ''
    })
    .filter(Boolean)
}

/** Every document of one collection (`parentPath/collectionId`), read with the caller's token, up to `limit`. */
export async function firestoreListCollection(
  idToken: string,
  collectionPath: string,
  limit = 500
): Promise<{ id: string; fields?: Record<string, unknown> }[]> {
  const out: { id: string; fields?: Record<string, unknown> }[] = []
  let pageToken = ''
  while (out.length < limit) {
    const query = new URLSearchParams({ pageSize: String(Math.min(300, limit - out.length)) })
    if (pageToken) query.set('pageToken', pageToken)
    const response = await fetch(`${docUrl(collectionPath)}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!response.ok) throw new Error(`Could not read ${collectionPath}`)
    const body = (await response.json()) as {
      documents?: { name?: string; fields?: Record<string, unknown> }[]
      nextPageToken?: string
    }
    for (const row of body.documents || []) {
      const name = row.name || ''
      out.push({ id: name.slice(name.lastIndexOf('/') + 1), fields: row.fields })
    }
    if (!body.nextPageToken) break
    pageToken = body.nextPageToken
  }
  return out
}

export async function firestoreDelete(idToken: string, path: string) {
  const response = await fetch(docUrl(path), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(text || `Could not delete ${path}`)
  }
}

export function boolField(value: boolean) {
  return { booleanValue: value }
}

export function stringField(value: string) {
  return { stringValue: value }
}

export function readString(fields: Record<string, unknown> | undefined, key: string): string {
  const field = fields?.[key] as { stringValue?: string } | undefined
  return typeof field?.stringValue === 'string' ? field.stringValue : ''
}

export function readBool(fields: Record<string, unknown> | undefined, key: string): boolean {
  const field = fields?.[key] as { booleanValue?: boolean } | undefined
  return field?.booleanValue === true
}

export function restFieldsToPlain(fields?: Record<string, unknown>): Record<string, unknown> {
  if (!fields) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    const entry = value as Record<string, unknown>
    if (!entry || typeof entry !== 'object') continue
    if ('stringValue' in entry) out[key] = entry.stringValue
    else if ('booleanValue' in entry) out[key] = entry.booleanValue
    else if ('integerValue' in entry) out[key] = Number(entry.integerValue)
    else if ('doubleValue' in entry) out[key] = Number(entry.doubleValue)
    else if ('timestampValue' in entry) out[key] = new Date(String(entry.timestampValue))
    else if ('nullValue' in entry) out[key] = null
    // A DocumentReference reads as the referenced document's id, never as a missing field (review of #340).
    else if ('referenceValue' in entry) {
      const ref = String(entry.referenceValue || '')
      out[key] = ref.slice(ref.lastIndexOf('/') + 1)
    }
    else if ('mapValue' in entry) {
      const nested = (entry.mapValue as { fields?: Record<string, unknown> })?.fields
      out[key] = restFieldsToPlain(nested)
    } else if ('arrayValue' in entry) {
      const values = ((entry.arrayValue as { values?: Record<string, unknown>[] })?.values || []) as Record<
        string,
        unknown
      >[]
      out[key] = values.map((item) => restFieldsToPlain({ _: item })._)
    }
  }
  return out
}

export function bearerToken(request: { headers: { get(name: string): string | null } }): string {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// MARK: - Structured queries and aggregations (owner console PR 1, PLAN §3.1–3.2)

export type RestValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { arrayValue: { values: RestValue[] } }
  | { timestampValue: string }

export type RestFilter = Record<string, unknown>

/** `field == value` (string, boolean or number). */
export function restEqual(field: string, value: string | boolean | number): RestFilter {
  const restValue: RestValue =
    typeof value === 'boolean' ? { booleanValue: value } : typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value }
  return { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: restValue } }
}

/** `field in [values]` — at most 30 values (Firestore's limit). */
export function restIn(field: string, values: readonly string[]): RestFilter {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op: 'IN',
      value: { arrayValue: { values: values.slice(0, 30).map((value) => ({ stringValue: value })) } },
    },
  }
}

/** `start <= field <= end` on a Timestamp field (a single-field range: no composite index needed). */
export function restTimeRange(field: string, start: Date, end: Date): RestFilter {
  const bound = (op: string, at: Date) => ({
    fieldFilter: { field: { fieldPath: field }, op, value: { timestampValue: at.toISOString() } },
  })
  return { compositeFilter: { op: 'AND', filters: [bound('GREATER_THAN_OR_EQUAL', start), bound('LESS_THAN_OR_EQUAL', end)] } }
}

export function restAnd(filters: RestFilter[]): RestFilter | undefined {
  if (!filters.length) return undefined
  if (filters.length === 1) return filters[0]
  return { compositeFilter: { op: 'AND', filters } }
}

export function structuredQuery(collectionId: string, where?: RestFilter, extra: Record<string, unknown> = {}) {
  return { from: [{ collectionId }], ...(where ? { where } : {}), ...extra }
}

function restPath(parentPath: string) {
  const base = firestoreDocumentsBase()
  return parentPath ? `${base}/${parentPath}` : base
}

/** Runs a structured query; returns `{ id, fields }` per document. Throws when the query is refused. */
export async function firestoreRunQuery(
  idToken: string,
  query: Record<string, unknown>,
  parentPath = ''
): Promise<{ id: string; path: string; fields?: Record<string, unknown> }[]> {
  const response = await fetch(`${restPath(parentPath)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
  })
  if (!response.ok) throw new Error(`Query refused (${response.status})`)
  const rows = (await response.json().catch(() => [])) as { document?: { name?: string; fields?: Record<string, unknown> } }[]
  const out: { id: string; path: string; fields?: Record<string, unknown> }[] = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = row.document?.name || ''
    if (!name) continue
    const marker = '/documents/'
    const index = name.indexOf(marker)
    out.push({ id: name.slice(name.lastIndexOf('/') + 1), path: index >= 0 ? name.slice(index + marker.length) : name, fields: row.document?.fields })
  }
  return out
}

/** `count()` of a structured query — one read per 1,000 documents counted. Throws when refused. */
export async function firestoreCount(idToken: string, query: Record<string, unknown>, parentPath = ''): Promise<number> {
  const response = await fetch(`${restPath(parentPath)}:runAggregationQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: { structuredQuery: query, aggregations: [{ alias: 'n', count: {} }] },
    }),
  })
  if (!response.ok) throw new Error(`Count refused (${response.status})`)
  const rows = (await response.json().catch(() => [])) as { result?: { aggregateFields?: { n?: { integerValue?: string } } } }[]
  const raw = (Array.isArray(rows) ? rows : []).find((row) => row.result)?.result?.aggregateFields?.n?.integerValue
  // A reply without the count is an error, never 0 (review of #366).
  if (raw === undefined || raw === null) throw new Error('Count reply had no count')
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error('Count reply was not a number')
  return value
}

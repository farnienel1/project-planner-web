const projectId = () => process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''

function docUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/${path}`
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

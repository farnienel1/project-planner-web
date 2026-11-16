// Plain JS values ⇄ Firestore REST values, for the seed writer and the route-test fake backend.
export function toRestValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toRestValue) } }
  if (typeof value === 'object') return { mapValue: { fields: toRestFields(value) } }
  return { stringValue: String(value) }
}

export function toRestFields(data) {
  const out = {}
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue
    out[key] = toRestValue(value)
  }
  return out
}

/** A plain value read back for filter matching (timestamps as ISO text). */
export function fromRestValue(value) {
  if (!value || typeof value !== 'object') return undefined
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromRestValue)
  if ('mapValue' in value) {
    const out = {}
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) out[k] = fromRestValue(v)
    return out
  }
  return undefined
}

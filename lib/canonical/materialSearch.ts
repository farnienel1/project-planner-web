/**
 * Shared material catalogue search. Both apps must return the same hits
 * for the same query. Screens stay in each app.
 *
 * The old rule required the whole typed phrase to sit inside one field.
 * "2.5mm LS" therefore missed "2.5mm2 Twin & Earth Cable 6242B LSZH".
 * Every query token must now match some name / brand / code / size token
 * as an exact, prefix, or contained piece (LS → LSZH, 2.5mm → 2.5mm2).
 */

export type MaterialSearchRecord = {
  name?: string | null
  brand?: string | null
  productCode?: string | null
  category?: string | null
  size?: string | null
  length?: string | null
}

export type MaterialSearchHit = {
  index: number
  score: number
}

const UNIT_TOKEN = /^(mm2|mm|cm|m|kg)$/
const NUMBER_TOKEN = /^\d+(?:\.\d+)?$/
const MEASURE_TOKEN = /^(\d+(?:\.\d+)?)(mm2|mm|cm|m|kg)$/

export function normalizeMaterialSearchText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/mm²|mm\^2/g, 'mm2')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandToken(token: string): string[] {
  const out = new Set<string>([token])
  const measure = MEASURE_TOKEN.exec(token)
  if (measure) {
    const amount = measure[1]
    const unit = measure[2]
    out.add(amount)
    out.add(unit)
    out.add(amount + unit)
    if (unit === 'mm2') {
      out.add(`${amount}mm`)
      out.add('mm')
    }
  }
  const code = /^(\d+)([a-z]+)$/.exec(token)
  if (code) out.add(code[1])
  return [...out]
}

/** Query tokens after gluing a number to a following unit (`2.5 mm` → `2.5mm`). */
export function tokenizeMaterialSearch(value: unknown): string[] {
  const raw = normalizeMaterialSearchText(value).split(' ').filter(Boolean)
  const tokens: string[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const current = raw[i]
    const next = raw[i + 1]
    if (next && NUMBER_TOKEN.test(current) && UNIT_TOKEN.test(next)) {
      tokens.push(current + next)
      i += 1
      continue
    }
    tokens.push(current)
  }
  return tokens
}

function fieldTokens(value: unknown): string[] {
  const tokens = normalizeMaterialSearchText(value).split(' ').filter(Boolean)
  const expanded: string[] = []
  for (const token of tokens) expanded.push(...expandToken(token))
  return expanded
}

type TokenHit = 'exact' | 'prefix' | 'contains'

function bestHit(...hits: Array<TokenHit | null>): TokenHit | null {
  if (hits.includes('exact')) return 'exact'
  if (hits.includes('prefix')) return 'prefix'
  if (hits.includes('contains')) return 'contains'
  return null
}

function tokenHit(queryToken: string, hayTokens: string[]): TokenHit | null {
  if (!queryToken) return null
  for (const hay of hayTokens) {
    if (hay === queryToken) return 'exact'
  }
  if (queryToken.length >= 2) {
    for (const hay of hayTokens) {
      if (hay.startsWith(queryToken)) return 'prefix'
    }
  }
  if (queryToken.length >= 3) {
    for (const hay of hayTokens) {
      if (hay.includes(queryToken) || (hay.length >= 3 && queryToken.startsWith(hay))) return 'contains'
    }
  }
  return null
}

function recordFields(record: MaterialSearchRecord) {
  return {
    name: fieldTokens(record.name),
    brand: fieldTokens(record.brand),
    code: fieldTokens(record.productCode),
    extra: [
      ...fieldTokens(record.category),
      ...fieldTokens(record.size),
      ...fieldTokens(record.length),
    ],
  }
}

/**
 * 0 = not a match. Higher is a better match.
 * An empty query scores 1 so a browse list can keep its existing order.
 */
export function materialSearchScore(query: unknown, record: MaterialSearchRecord): number {
  const tokens = tokenizeMaterialSearch(query)
  if (tokens.length === 0) return 1
  const fields = recordFields(record)
  const all = [...fields.name, ...fields.brand, ...fields.code, ...fields.extra]
  let score = 0
  for (const token of tokens) {
    const named = tokenHit(token, fields.name)
    const branded = tokenHit(token, fields.brand)
    const coded = tokenHit(token, fields.code)
    const extra = tokenHit(token, fields.extra)
    const hit = bestHit(coded, named, branded, extra, tokenHit(token, all))
    if (!hit) return 0
    if (hit === 'exact') score += 40
    else if (hit === 'prefix') score += 26
    else score += 12
    if (coded) score += 18
    if (named) score += 8
  }
  const name = normalizeMaterialSearchText(record.name)
  const joined = tokens.join(' ')
  if (name.startsWith(joined)) score += 24
  else if (name.includes(joined)) score += 10
  const nameLength = name.length
  if (nameLength > 0) score += Math.max(0, 20 - Math.floor(nameLength / 8))
  return score
}

export function materialRecordMatches(query: unknown, record: MaterialSearchRecord): boolean {
  return materialSearchScore(query, record) > 0
}

/**
 * Indexes into `records`, best match first.
 * Empty query returns every index in the original order.
 * `limit` omitted or 0 returns every hit.
 */
export function rankMaterialRecords(
  query: unknown,
  records: MaterialSearchRecord[],
  limit?: number | null
): MaterialSearchHit[] {
  const tokens = tokenizeMaterialSearch(query)
  const hits: MaterialSearchHit[] = []
  for (let index = 0; index < records.length; index += 1) {
    const score = tokens.length === 0 ? 1 : materialSearchScore(query, records[index])
    if (score > 0) hits.push({ index, score })
  }
  if (tokens.length > 0) {
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const left = normalizeMaterialSearchText(records[a.index]?.name)
      const right = normalizeMaterialSearchText(records[b.index]?.name)
      return left.localeCompare(right)
    })
  }
  const cap = Number(limit)
  if (Number.isFinite(cap) && cap > 0) return hits.slice(0, cap)
  return hits
}

export function catalogueRecordFromItem(item: {
  name?: string | null
  brand?: string | null
  productCode?: string | null
  category?: string | null
  size?: string | null
  length?: string | null
}): MaterialSearchRecord {
  return {
    name: item.name,
    brand: item.brand,
    productCode: item.productCode,
    category: item.category,
    size: item.size,
    length: item.length,
  }
}

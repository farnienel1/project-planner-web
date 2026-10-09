/**
 * Shared qualification library search and section filters.
 * Both apps must return the same hits for the same query and section.
 * Screens stay in each app.
 *
 * Every query token must match name, code, awarding body, section,
 * subsection or notes as an exact, prefix, or contained piece.
 */

export const QUALIFICATION_FILTER_ALL = 'All'
export const QUALIFICATION_FILTER_OTHER = 'Other'

export const QUALIFICATION_LIBRARY_SECTIONS = [
  { section: 'Electrical', chip: 'Electrical' },
  { section: 'Gas', chip: 'Gas' },
  { section: 'Air Conditioning, Refrigeration & F-Gas', chip: 'Air Con & F-Gas' },
  { section: 'Site Management & Supervision', chip: 'Site Management' },
  { section: 'Health, Safety & Environment', chip: 'Health & Safety' },
  { section: 'Access & Working at Height', chip: 'Access & Height' },
  { section: 'Plant, Lifting & Groundworks', chip: 'Plant & Lifting' },
  { section: 'Plumbing & Heating', chip: 'Plumbing' },
  { section: 'Mechanical & HVAC', chip: 'Mechanical' },
  { section: 'Renewables & Low Carbon', chip: 'Renewables' },
  { section: 'Fire & Security', chip: 'Fire & Security' },
  { section: 'Data, Comms & Technology', chip: 'Data & Comms' },
  { section: 'CSCS Site Cards (General)', chip: 'CSCS' },
  { section: 'Professional Memberships', chip: 'Professional' },
] as const

export type QualificationSearchRecord = {
  name?: string | null
  code?: string | null
  awardingBody?: string | null
  section?: string | null
  subsection?: string | null
  notes?: string | null
}

export type QualificationSearchHit = {
  index: number
  score: number
}

export type QualificationFilterChip = {
  key: string
  label: string
  count: number
}

const SECTION_CHIP = new Map<string, string>(
  QUALIFICATION_LIBRARY_SECTIONS.map((row) => [row.section, row.chip])
)

export function normalizeQualificationSearchText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeQualificationSearch(value: unknown): string[] {
  return normalizeQualificationSearchText(value).split(' ').filter(Boolean)
}

function fieldTokens(value: unknown): string[] {
  return tokenizeQualificationSearch(value)
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

function recordFields(record: QualificationSearchRecord) {
  return {
    name: fieldTokens(record.name),
    code: fieldTokens(record.code),
    body: fieldTokens(record.awardingBody),
    extra: [
      ...fieldTokens(record.section),
      ...fieldTokens(record.subsection),
      ...fieldTokens(record.notes),
    ],
  }
}

/**
 * 0 = not a match. Higher is a better match.
 * An empty query scores 1 so a browse list can keep its existing order.
 */
export function qualificationSearchScore(query: unknown, record: QualificationSearchRecord): number {
  const tokens = tokenizeQualificationSearch(query)
  if (tokens.length === 0) return 1
  const fields = recordFields(record)
  const all = [...fields.name, ...fields.code, ...fields.body, ...fields.extra]
  let score = 0
  for (const token of tokens) {
    const named = tokenHit(token, fields.name)
    const coded = tokenHit(token, fields.code)
    const body = tokenHit(token, fields.body)
    const extra = tokenHit(token, fields.extra)
    const hit = bestHit(coded, named, body, extra, tokenHit(token, all))
    if (!hit) return 0
    if (hit === 'exact') score += 40
    else if (hit === 'prefix') score += 26
    else score += 12
    if (coded) score += 18
    if (named) score += 8
  }
  const name = normalizeQualificationSearchText(record.name)
  const joined = tokens.join(' ')
  if (name.startsWith(joined)) score += 24
  else if (name.includes(joined)) score += 10
  if (name.length > 0) score += Math.max(0, 20 - Math.floor(name.length / 8))
  return score
}

export function qualificationRecordMatches(query: unknown, record: QualificationSearchRecord): boolean {
  return qualificationSearchScore(query, record) > 0
}

export function qualificationMatchesSection(
  record: Pick<QualificationSearchRecord, 'section'>,
  section?: string | null
): boolean {
  const wanted = String(section || '').trim()
  if (!wanted || wanted === QUALIFICATION_FILTER_ALL) return true
  const value = String(record.section || '').trim()
  if (wanted === QUALIFICATION_FILTER_OTHER) return value.length === 0
  return value === wanted
}

export function qualificationSectionChipLabel(section: string): string {
  if (section === QUALIFICATION_FILTER_ALL || section === QUALIFICATION_FILTER_OTHER) return section
  return SECTION_CHIP.get(section) || section
}

/** All, then library sections that appear, then Other when a row has no section. */
export function qualificationLibraryFilterChips(
  records: Array<Pick<QualificationSearchRecord, 'section'>>
): QualificationFilterChip[] {
  const counts = new Map<string, number>()
  let other = 0
  for (const record of records) {
    const section = String(record.section || '').trim()
    if (!section) {
      other += 1
      continue
    }
    counts.set(section, (counts.get(section) || 0) + 1)
  }
  const chips: QualificationFilterChip[] = [
    { key: QUALIFICATION_FILTER_ALL, label: QUALIFICATION_FILTER_ALL, count: records.length },
  ]
  for (const row of QUALIFICATION_LIBRARY_SECTIONS) {
    const count = counts.get(row.section) || 0
    if (count === 0) continue
    chips.push({ key: row.section, label: row.chip, count })
    counts.delete(row.section)
  }
  for (const [section, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    chips.push({ key: section, label: section, count })
  }
  if (other > 0) {
    chips.push({ key: QUALIFICATION_FILTER_OTHER, label: QUALIFICATION_FILTER_OTHER, count: other })
  }
  return chips
}

/**
 * Indexes into `records`, best match first.
 * Empty query returns every index that passes the section filter, in the original order.
 * `limit` omitted or 0 returns every hit.
 */
export function rankQualificationRecords(
  query: unknown,
  records: QualificationSearchRecord[],
  limit?: number | null,
  section?: string | null
): QualificationSearchHit[] {
  const tokens = tokenizeQualificationSearch(query)
  const hits: QualificationSearchHit[] = []
  for (let index = 0; index < records.length; index += 1) {
    if (!qualificationMatchesSection(records[index], section)) continue
    const score = tokens.length === 0 ? 1 : qualificationSearchScore(query, records[index])
    if (score > 0) hits.push({ index, score })
  }
  if (tokens.length > 0) {
    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const left = normalizeQualificationSearchText(records[a.index]?.name)
      const right = normalizeQualificationSearchText(records[b.index]?.name)
      return left.localeCompare(right)
    })
  }
  const cap = Number(limit)
  if (Number.isFinite(cap) && cap > 0) return hits.slice(0, cap)
  return hits
}

export function qualificationSearchRecordFromItem(item: {
  name?: string | null
  code?: string | null
  awardingBody?: string | null
  section?: string | null
  subsection?: string | null
  notes?: string | null
}): QualificationSearchRecord {
  return {
    name: item.name,
    code: item.code,
    awardingBody: item.awardingBody,
    section: item.section,
    subsection: item.subsection,
    notes: item.notes,
  }
}

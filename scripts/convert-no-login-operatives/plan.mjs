/**
 * Rulebook 1.34.0 §11 (owner decision Q-G2): the pure half of `scripts/convert-no-login-operatives-to-ghosts.mjs`.
 * The decisions are the rulebook's (`ghostConversionCandidates`, `ghostConversionWrites`, read from the packed script);
 * this file only turns them into the owner's check list (CSV and Markdown) and reads the filled CSV back.
 */

export const CHECK_LIST_COLUMNS = [
  'organizationId',
  'operativeId',
  'name',
  'firstName',
  'surname',
  'emailKeptAside',
  'trade',
  'payBasis',
  'rate',
  'duplicateOperativeIds',
  'issues',
  'lineManagerIds',
]

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One check-list row per candidate. `lineManagerIds` is empty: the owner fills it (`;` between several ids). */
export function checkListRows(organizationId, candidates) {
  return (candidates || []).map((candidate) => ({
    organizationId,
    operativeId: candidate.operativeId,
    name: candidate.name,
    firstName: candidate.firstName,
    surname: candidate.lastName,
    emailKeptAside: candidate.email,
    trade: candidate.trade,
    payBasis: candidate.payBasis || '',
    rate: candidate.rate == null ? '' : String(candidate.rate),
    duplicateOperativeIds: candidate.duplicateOperativeIds.join(';'),
    issues: candidate.issues.join(';'),
    lineManagerIds: '',
  }))
}

export function checkListCsv(rows) {
  return [CHECK_LIST_COLUMNS.join(','), ...rows.map((row) => CHECK_LIST_COLUMNS.map((key) => csvCell(row[key])).join(','))].join('\n') + '\n'
}

export function checkListMarkdown(rows, rosterNames = {}) {
  const lines = [
    '# No-login operatives to convert to ghosts',
    '',
    'Fill `lineManagerIds` in the CSV for every row (and the name or rate where `issues` says so), then run the script with `--apply --line-managers=<file>`.',
    '',
    '| Organisation | Operative id | Name | Email kept aside | Trade | Pay | Duplicates | To fill |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const row of rows) {
    const pay = row.payBasis ? `${row.rate} / ${row.payBasis}` : '—'
    const fill = ['line manager', ...(row.issues ? row.issues.split(';') : [])].join(', ')
    lines.push(
      `| ${rosterNames[row.organizationId] || row.organizationId} | ${row.operativeId} | ${row.name || '—'} | ${row.emailKeptAside || '—'} | ${row.trade || '—'} | ${pay} | ${row.duplicateOperativeIds || '—'} | ${fill} |`
    )
  }
  return lines.join('\n') + '\n'
}

/** Parses one CSV line (quotes and doubled quotes). */
function parseCsvLine(line) {
  const out = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cell)
      cell = ''
    } else cell += ch
  }
  out.push(cell)
  return out
}

/**
 * The filled check list → `Map<"orgId/operativeId", { lineManagerIds, overrides }>`. Rows with no line manager are
 * left out (the script skips them and says so). Overrides are the names and rate the owner typed.
 */
export function parseFilledCheckList(text) {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return new Map()
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim())
  const index = (key) => header.indexOf(key)
  const out = new Map()
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const get = (key) => (index(key) >= 0 ? String(cells[index(key)] ?? '').trim() : '')
    const lineManagerIds = get('lineManagerIds').split(/[;\s]+/).map((id) => id.trim()).filter(Boolean)
    if (!get('organizationId') || !get('operativeId') || lineManagerIds.length === 0) continue
    const basis = get('payBasis') === 'hourly' ? 'hourly' : get('payBasis') === 'day' ? 'day' : null
    const rate = Number(get('rate'))
    const overrides = {
      firstName: get('firstName') || undefined,
      surname: get('surname') || undefined,
      payBasis: basis || undefined,
      dayRate: basis === 'day' && Number.isFinite(rate) ? rate : undefined,
      hourlyRate: basis === 'hourly' && Number.isFinite(rate) ? rate : undefined,
    }
    out.set(`${get('organizationId')}/${get('operativeId')}`, { lineManagerIds, overrides })
  }
  return out
}

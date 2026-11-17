/**
 * Rulebook 1.56.0 §9 / §16 (owner answer 17 Nov Q4: "fix the data"): the pure half of
 * `scripts/report-leave-legacy-keys.mjs`. The decision is the rulebook's (`leaveLegacyKeyFindings`, read from the
 * packed script); this file only turns the findings into the owner's report lines and a CSV. Pure: no Firestore.
 */

export const REPORT_COLUMNS = [
  'organizationId',
  'leaveId',
  'personId',
  'personEmail',
  'reason',
  'storedUserId',
  'storedOperativeId',
  'readerUserId',
  'readerOperativeId',
  'otherPersonIds',
  'fix',
]

export const REASON_TEXT = {
  letterCase: 'stored id differs only by letter case or spaces',
  sameEmailAccount: 'filed under a second users document on the same email',
  legacyKey: 'person only under an older key (user_id, uid, user.id, …) or the email stored as operativeId',
  conflict: 'two or more operatives would claim it — decide whose it is',
}

/**
 * One CSV cell. A cell that a spreadsheet would read as a formula (starting with = + - @, a tab or a carriage return)
 * gets a leading apostrophe, so opening the report never runs anything stored in a leave record.
 */
export function csvCell(value) {
  const raw = value == null ? '' : String(value)
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One CSV row per finding, columns `REPORT_COLUMNS`. */
export function reportRows(organizationId, findings) {
  return (findings || []).map((finding) => ({
    organizationId,
    leaveId: finding.leaveId,
    personId: finding.personId,
    personEmail: finding.personEmail,
    reason: finding.reason,
    storedUserId: finding.storedUserId ?? '',
    storedOperativeId: finding.storedOperativeId ?? '',
    readerUserId: finding.readerUserId ?? '',
    readerOperativeId: finding.readerOperativeId ?? '',
    otherPersonIds: (finding.otherPersonIds || []).join(';'),
    fix: String(finding.fix || '').replace('{orgId}', organizationId),
  }))
}

export function reportCsv(rows) {
  const lines = [REPORT_COLUMNS.join(',')]
  for (const row of rows || []) lines.push(REPORT_COLUMNS.map((column) => csvCell(row[column])).join(','))
  return `${lines.join('\n')}\n`
}

/** The console lines for one organisation (empty when nothing is missed). */
export function reportLines(organizationId, rows) {
  if (!rows || rows.length === 0) return []
  const lines = [`Organisation ${organizationId}: ${rows.length} leave record(s) an operative would no longer see`]
  for (const row of rows) {
    const others = row.otherPersonIds ? ` (also ${row.otherPersonIds.replace(/;/g, ', ')})` : ''
    lines.push(`  ${row.leaveId} — ${row.personEmail || row.personId}${others}: ${REASON_TEXT[row.reason] || row.reason}`)
    lines.push(`    stored userId "${row.storedUserId}", operativeId "${row.storedOperativeId}" → ${row.fix}`)
  }
  return lines
}

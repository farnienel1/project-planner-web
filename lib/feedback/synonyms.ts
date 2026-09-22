/** Domain synonyms for feedback similarity. Editable — keep groups of equivalent site language. */
export const FEEDBACK_SYNONYM_GROUPS: string[][] = [
  ['schedule', 'rota', 'planner', 'calendar', 'diary'],
  ['timesheet', 'hours', 'clock', 'clocking'],
  ['operative', 'worker', 'engineer', 'labourer', 'laborer', 'fitter'],
  ['rams', 'method', 'statement', 'risk'],
  ['export', 'download', 'excel', 'xlsx', 'csv', 'spreadsheet'],
  ['see', 'view', 'visible', 'display', 'show'],
  ['phone', 'mobile', 'app', 'android', 'iphone', 'ios'],
  ['invoice', 'bill', 'payment'],
  ['hs', 'safety', 'health'],
  ['report', 'reports'],
]

const CANONICAL = new Map<string, string>()
for (const group of FEEDBACK_SYNONYM_GROUPS) {
  const canon = group[0]
  if (!canon) continue
  for (const word of group) CANONICAL.set(word, canon)
}

export function canonicalToken(token: string): string {
  return CANONICAL.get(token) || token
}

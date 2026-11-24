/**
 * Rulebook 1.76.0 §8 (owner answer 23 Nov, b; review of #427): which signed, unexported timesheets the 1.76.0 rule
 * `timesheetSignedEntriesChangedSinceSignOff` reads as changed on day one — the signed copy's price work or expense rows
 * (`weeklyReportOverride.priceWork` / `expenses`, not late extras) differ from what the entries pay now
 * (`timesheetEntryDecision`). Before 1.76.0 every reviewer save re-priced those rows, so the count should be 0; any sheet
 * counted here would move to Awaiting sign-off (export blocked) until its line manager signs it off again.
 * Counts only; pure (no Firestore). It asks the rulebook itself.
 */

/** Counts for one organisation's timesheet documents (`{ id, data }`, data with plain timestamps). */
export function signedMoneyMismatchCounts(rulebook, { sheets }) {
  const counts = { sheetsChecked: 0, counterSignedNotExported: 0, mismatched: 0, mismatchedIds: [] }
  for (const sheet of sheets ?? []) {
    if (!String(sheet?.id ?? '').startsWith('timesheet_')) continue
    counts.sheetsChecked += 1
    const data = sheet.data && typeof sheet.data === 'object' ? sheet.data : {}
    const status = rulebook.parseTimesheetStatusFields(data)
    if (status.managerSignedAtMs == null || status.exportedAtMs != null) continue
    if (!data.weeklyReportOverride || typeof data.weeklyReportOverride !== 'object') continue
    counts.counterSignedNotExported += 1
    if (rulebook.timesheetSignedEntriesChangedSinceSignOff(data, { sheetDocId: sheet.id })) {
      counts.mismatched += 1
      counts.mismatchedIds.push(sheet.id)
    }
  }
  return counts
}

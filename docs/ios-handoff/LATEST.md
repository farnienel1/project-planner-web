# iOS follow-on — rulebook 1.51.0

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.51.0 → 1.51.0
Packed hash: 5b1a20a09909efeaa80d348768e47e8cc0cbf0ae1a1aaa1ee8479f16f9dfc4f6
Rulebook sha256: 7be3918e47edccb876139956999255bd968637a04ad710259028a026ed6a3d02
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: b89ca87595a18b7f0230fa13dcc81d65dcaea44e65912d499a31ce5df7670dd4
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: WEEKLY_REPORT_NO_TIMESHEET
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/weeklyReportPay.ts
Done when:
- [ ] Packed hash in iOS equals 5b1a20a09909efeaa80d348768e47e8cc0cbf0ae1a1aaa1ee8479f16f9dfc4f6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 7be3918e47edccb876139956999255bd968637a04ad710259028a026ed6a3d02)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.51.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.51.0

- **Weekly report rework** (§7, owner decisions 15 Nov, Q1–Q4; new `lib/canonical/weeklyReportPay.ts`): `weeklyReportPayRows` — the Pay Summary in rows per person, rate period and kind of hours (Person | Role | Dates | Line | Hours | Days | Rate | Pay; `WEEKLY_REPORT_PAY_COLUMNS`, `weeklyReportDatesText`, `weeklyReportDayText`, `WEEKLY_REPORT_RATE_NOT_SET`), each person's total and invoice check line (`WEEKLY_REPORT_TIMESHEET_STATE_LABELS`), the grand total (`reportPayForViewer` inside) and every booking's paid hours and days (`bookingPaidDays`). Money unchanged (pay rounded per booking line, 1.46.0; owner fortnight £3,141.76 in the fixture). Web: `weeklyReportPayroll.ts`'s `labourPaySlices`, `paySliceDisplay`, `bookingDayUnits` and `formatDays` and the pay bucketing in `weeklyReportData.ts` removed; the screen, PDF, HTML and Excel render one table builder (`weeklyReportSections`), so every export shows the same rows (the Excel file gains the People column it lacked).
- **Annual leave** (Q4b): `weeklyReportLeaveRows`, `leaveRecordsWithoutPerson` (Settings → Data health "Leave not linked to a person"), `WEEKLY_REPORT_PERSON_NOT_FOUND`.
- **Sub contractors** (Q4c): `subcontractorDayValue` takes `{ hours, standardDayHours }` — custom hours are hours worked ÷ the paid day (was always 0.5).
- **Warnings** (Q4d): `WEEKLY_REPORT_WARNING_OPEN`, `weeklyReportClashDetail`.
- **Project Breakdown** (Q4a): Hours and Paid days from `paidDays` (was booked-day units capped at 1.5).
- **Money change** (review of #329, owner to confirm): a manager site booking off a job (Office, Working from home, Site survey, custom) is priced at its own `otMultiplierOverride`, as the timesheet and invoice already were — office 16:00–19:00 at ×2 on £250/day: £132.35 → £176.47 (+£44.12). Every other figure is unchanged.
- **Check line, review of #329:** like with like, run by run (labour against labour; price work and expenses only for approved runs, otherwise "+ £… awaiting sign-off"); one run per person when two users documents share it; "no timesheet yet" (`WEEKLY_REPORT_NO_TIMESHEET`); with no viewer pay is hidden unless `showAllPay: true`.

## iOS work for 1.51.0

**Sync first.** 1.51.0 (owner decisions 15 Nov, Q1–Q4): **weekly report rework.** The Pay Summary, each person's invoice check line, the grand total and every booking's paid hours / days are one rule, `weeklyReportPayRows`; iOS renders it and keeps no weekly-report pricing of its own. Money is unchanged (pay rounded per booking line, 1.46.0).
- **Not changed:** no Firestore rules, index, Storage or Functions change; nothing migrated; `minimumIosBuild` unchanged.
- **Base:** web `origin/main` 1.50.0 + this PR. Line numbers below are from iOS `origin/main` at `1571142` (15 Nov); check them on your branch.
- **Money change:** a manager site booking off a job (Office, WFH, Site survey, custom) is now priced at its own `otMultiplierOverride` on the weekly report, as on the timesheet and invoice (office 16:00–19:00 at ×2 on £250/day: +£44.12 against before).

1. **Sync.** `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
2. **Pay Summary = `weeklyReportPayRows`.** In `Project Planner/Views/WeeklyReportView.swift` replace `payrollPersonSummaries()` (~1780), `payrollSummaryForViewer()` (~1659), `struct PayrollRateLine` (~2258) / `struct PayrollPersonSummary` (~2280) with one call, and **delete `enum WeeklyReportPayRows` (~2095) and both `formatDays` helpers (~2006, ~2111)** with their tests:
   - `people`: each person `{ id, name, role, ids, operativeIds, user, operative, ghost, hasLineManager, paySubject }` — `ids` from `overtimePersonIds` plus the roster fold's same-email ids, and each booking's stored person id that your existing person matching resolves to them; a catalogue `operatives` row with no account is its own person (`user: null`).
   - `bookings`: every labour and manager site booking in the range (`dayKey` organisation zone, slot, clock times, `isBreakRemoved`, `otMultiplierOverride`, `status`, `jobId`, `jobNumber`, `jobName`, `locationKind`) — manager site bookings filtered by `includesManagerScheduleLocation` as today.
   - `timesheetWeeks`: the approved-timesheet feed (`Core/WeeklyReportTimesheetFeed.swift`, merged weeks).
   - `sheets`: for each self-employed person and each payment run overlapping the range: `{ personId, startDayKey, endDayKey, sheet (stored fields: weeklyReportOverride, payrollLineReviews, extraEntryReviews, priceWorkEntries, expenseEntries, managerSignedAt), status (parseTimesheetStatusFields), change (signedTimesheetBookingChanges: reopened, changed, waitingFor), payrollLines (your TimesheetPayrollCollector lines for that run), entryFingerprints }` — `sheet: null` when there is none.
   - `organization`: the working-hours state; `payRateHistory`: every `operativeDayRateHistory` row; `range` `{ start, end }` day keys; `timeZone`; `viewer` (the signed-in user, with `isPlatformOwner`); `roster`; `currency`. **Never pass `showAllPay`** in the app: with no viewer every figure is hidden.
   - One `sheets` entry per users record per run is fine: the rule keeps one per person per run (own id first). Unsigned sheets' price work and expenses show as "+ £… awaiting sign-off", never amber.
   - Render `result.people[].lines` with the columns `WEEKLY_REPORT_PAY_COLUMNS` (Person | Role | Dates | Line | Hours | Days | Rate | Pay): `dates`, `line`, `hours` ("12.5h"), `days` (2 dp; blank on price work / expenses, `source == "claim"`), `rateText`, `payLabel ?? formatMoney(pay)`; then "<name> total" with `personTotalLabel ?? personTotal`; then `check.label` (amber when `check.tone == "warn"`); then Grand Total `result.grandTotal` and `PAY_HIDDEN_NOTE` when `hiddenPeople > 0`. Do not apply `reportPayForViewer` again (it is inside).
3. **Project Breakdown and Additional Schedule (Q4a).** Build them from `result.paidDays` (`hours`, `days`, `jobId` / `jobNumber` / `jobName`, `locationKind`, `bookingId`, `time`, `personId`): columns Hours and **Paid days** (uncapped), not booked-day units. Delete the `reportDayValue` day units used there.
4. **Annual leave (Q4b).** Replace `annualLeaveRows()` (~1350) with `weeklyReportLeaveRows({ records, people, range, timeZone })` (people = every account with all its ids and its email, plus `operatives` rows with no account). Rows are per person; nobody → "Person not found (id …)".
5. **Sub contractors (Q4c).** Change `CanonicalBusinessEngine.subcontractorDayValue(_:)` (`Canonical/CanonicalBusinessEngine.swift` ~1291) to take the hours too (`subcontractorDayValue(timeSlot, { hours, standardDayHours })`), and `subcontractorDayValue(from:)` in `WeeklyReportView.swift` (~1553) passes `{ hours: payrollHoursResult(...) for that booking and day, standardDayHours: weekdayPaidHours(policy that day) }` — custom hours become hours worked ÷ the paid day (07:00–20:00 = 1.47), not 0.5.
6. **Warnings (Q4d).** Status `WEEKLY_REPORT_WARNING_OPEN` ("Open") everywhere — `clashExportCells(warning, status: "Active")` at ~948, ~954, ~1123, ~1129 and the unbooked rows. Clash Detail = `weeklyReportClashDetail({ dayText: "10 Nov 2026", places: [{ label, time }] })` from the clash's bookings, never the Warnings screen message with "Approve if it's intentional…".
7. **Exports.** The share-sheet PDF / Excel and the screen show the same rows (web uses one table builder, `lib/weekly-report/weeklyReportSections.ts`); the Excel export stays.
8. **Tests** (`ProjectPlannerTests`): through the engine, the owner fortnight (Test Admin 1–15 Nov, £250 → £240 on 14 Nov): five rows, "Weekday overtime ×1.5 (12h × 1.5 = 18h)", "Saturday 14 Nov window (counts as a full day)", total £3,141.76; a PAYE person has no rows; a non-admin viewer sees "—". Remove tests of the deleted Swift pricing.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

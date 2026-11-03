# iOS follow-on — rulebook 1.22.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.21.1 → 1.22.0
Packed hash: 574ee5b0b1902d44cda7b1070c64537c587b5b7ef40a45cf7d61b310b73bce27
Rulebook sha256: 9df0346c904ab01def9c4cc04e4fb55beb5c07f861da2836ebd5fce806fdef67
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DEFAULT_VARIATION_PADDING, DEFAULT_VARIATION_PREFIX, formatVariationNumber, leaveReportDayCount, leaveReportRows, leaveReportYears, managerCoverageHours, mergeTimesheetFeedWeeks, nextVariationNumber, timesheetFeedCovers, timesheetFeedLabourLines, timesheetFeedMoneyLines, timesheetTotals, variationNumberTaken, variationNumberValue, weeklyReportTimesheetFeed
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveReport.ts, lib/canonical/managerCoverage.ts, lib/canonical/parity-fixture.json, lib/canonical/reportPay.ts, lib/canonical/timesheetTotals.ts, lib/canonical/variationNumbers.ts, lib/canonical/weeklyReportTimesheetFeed.ts
Done when:
- [ ] Packed hash in iOS equals 574ee5b0b1902d44cda7b1070c64537c587b5b7ef40a45cf7d61b310b73bce27
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 9df0346c904ab01def9c4cc04e4fb55beb5c07f861da2836ebd5fce806fdef67)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.22.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.22.0

- Money and leave-report gaps from the cross-app audit (findings 6, 7, 8, 15) are shared rules; nothing changes in Firestore, the security rules or Cloud Functions.
- Timesheet totals are `timesheetTotals` (§8): the sum of the invoice rows (`timesheetInvoiceRows`), so every list row, detail screen and sign sheet equals the invoice — declined entries 0, revised entries at the revision, stale reviews pending at their own amount, PAYE days and leave never. `timesheetInvoiceRows` takes `applyLabourReviews` for a reviewer before signing. Web list rows summed raw entries (a declined expense counted); web `payrollTotal` / `expensesTotal` / `priceWorkTotal` / `grandTotal` / `draftAdditionalTotal` are removed.
- Holiday Report is `leaveReportRows` / `leaveReportDayCount` / `leaveReportYears` (§9): organisation leave year, working days only on multi-day records, half day 0.5, ids without case; the total equals `annualLeaveBalance.taken`.
- Weekly Report approved-timesheet feed is `weeklyReportTimesheetFeed` (`mergeTimesheetFeedWeeks`, `timesheetFeedCovers`, `timesheetFeedLabourLines`, `timesheetFeedMoneyLines`), moved unchanged from web (§7).
- Variation numbers are `nextVariationNumber` / `variationNumberTaken` / `variationNumberValue` / `formatVariationNumber` (new §22): trailing digits only ("V2-003" → "V2-004", owner decision); deleted variations count for the next number and the duplicate check, so a number is never reused.
- A person's booked cover on a day is `managerCoverageHours` (§6): `covered` = `standardDayCoverage` (Book labour on both apps), `paidHours` = merged blocks priced once by `payrollHoursResult`.
- iOS hand-off — each file calls the functions above through `CanonicalBusinessEngine` and deletes its own copy: `Views/InvoicingView.swift` (~3045-3048 the "Summary total" row and ~4065-4066 the list summary → `timesheetTotals` with the same `sheet` / `payrollLines` / `extrasMode` / `timesheetDays` it passes to `timesheetInvoiceRows`; pass `bookingPaidHours` / `bookingOvertimeHours` on each booking's standard line); `Views/TimesheetManagerReviewSupport.swift` (~148-170 the hand-written effective amounts → `timesheetTotals`, a reviewer before signing with `applyLabourReviews: true`); `Views/HolidayReportView.swift` (~105-143 `yearBookings` / `totalDaysTaken` / `daysCount` and the calendar-year `availableYears` → `leaveReportRows` and `leaveReportYears` with `annualLeaveDefaults.startMonth`, the region's bank holidays and the person's ids from `personIdSet` plus their operative ids; "N days approved in YYYY" names the leave year); `Core/WeeklyReportTimesheetFeed.swift` (~32-250 → `weeklyReportTimesheetFeed`, `timesheetFeedCovers`); `Models/VariationModels.swift` (~172-187 `VariationNumbering.numericValue` / `nextFree` → `variationNumberValue` / `nextVariationNumber`); `Core/VariationStore.swift` (~100-108 `voNumberIsDuplicate` → `variationNumberTaken`, deleted variations included); `Models/ManagerScheduleInterval.swift` (~78-115 delete `combinedPaidBookedHours`) and `Core/StaffEmailIdentity.swift` (`paidHours` ~156-188 and `BookLabourCandidateSelection.choices` ~369 / ~446 → `managerCoverageHours(...).covered` over the person's labour and manager site bookings that day, instead of `paid + 0.08 >= required`).

## New rulebook sections

- 22. Variation numbers (1.22.0)
- 1.22.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

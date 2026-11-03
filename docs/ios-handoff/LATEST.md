# iOS follow-on — rulebook 1.20.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.20.0 → 1.20.1
Packed hash: 1301236a48cf4966903ca48c5841fb3aa2a604327c5cbea974d3560409de811a
Rulebook sha256: ea8f1b88c64b09824da62ddf364a016c43cccb99622affbf35a121275c780a25
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/leaveCoverage.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals 1301236a48cf4966903ca48c5841fb3aa2a604327c5cbea974d3560409de811a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ea8f1b88c64b09824da62ddf364a016c43cccb99622affbf35a121275c780a25)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.20.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.20.1

- Leave cover (owner rule): on a half-leave day the lunch-break window never needs covering, as for unbooked labour — `leaveCoverageRows` takes the day's break window out of the other leave half before it counts what is missing. AM leave on 06:30–14:30 with lunch 10:00–10:45 plus a booking 11:00–14:30 → 10:45–11:00 (0.25h) missing; plus 10:45–14:30 → covered. 1.20.0 required the whole half (0.5h) (§5, §9).
- Web Home dashboard "Hours logged" counts each booking's paid hours by the pay rule under the working hours in effect that day (`payrollHoursResult`, `weekdayPaidHours`), not a fixed 8h / 4h.

## iOS work for 1.20.1

No Firestore rules, index or Functions deploy comes with 1.20.0. Older iOS builds keep working: they read `standardPaidHours`, which every 1.20.0 save writes as the derived day, so their pay agrees; they still offer AM / PM (stored and paid as before) and their Working hours save writes a typed `standardPaidHours` without `paidHoursDerived` (priced on the typed figure, as before 1.20.0). Raise `minimumIosBuild` (§18) once the iOS build with 1.20.0 is out.

Swift screens and types to update (all through `CanonicalBusinessEngine`; no Swift copy of any rule). File names are the ones the 1.19.0 hand-off used; check them in the iOS repo.

1. **Working hours settings** — `Views/OrganisationWorkingHoursView.swift`: remove the Monday–Friday "paid hours" / "counts as" box. Monday–Friday is start, finish and the lunch break (Paid / Unpaid, length, start–end) only. Under Monday–Friday show the live line `weekdayPaidDayPreview(policy).line` ("06:30–14:30 = 8h − 45 min unpaid break = 7h15m"; paid break "… = 8h, 30 min break paid = 8h"). Validate with `validatePayrollTimePolicy(withDerivedWeekdayPaidHours(draft))` (new message: "The working day must give between 1 and 12 paid hours (finish − start − unpaid break)."). Save through `payrollTimePolicyApplyNowWriteFields` / `payrollTimePolicyScheduleWriteFields` unchanged — they now write `paidHoursDerived: true` and the derived `standardPaidHours` themselves. Decode / encode `paidHoursDerived` on the policy model (`Models/Organization.swift`, `Core/Rulebook+OrganisationSettings.swift`); a policy without it keeps its stored `standardPaidHours`. Saturday / Sunday "counts as" hours stay as in 1.19.0. Company setup (if iOS creates organisations) writes `payrollPolicyToFirestore(withDerivedWeekdayPaidHours(policy))`.
2. **Weekday paid day everywhere** — every Swift read of `standardPaidHours` for a weekday (FULL DAY pay, day-rate divisor, weekly-report day units, invoices, Daily Overview, My Schedule, Home) becomes `weekdayPaidHours(policy)` of the policy in effect that day (`Core/TimesheetPayrollCollector.swift`, `Core/TimesheetWeeklyReportOverrideBuilder.swift`, `Views/InvoicingView.swift`, `Views/WeeklyReportView.swift`, `Core/WeeklyReportTimesheetFeed.swift`, `Views/MyScheduleView.swift`, `Views/DailyOverviewView.swift`). Booking hours stay `payrollHoursResult` (under a derived policy custom weekday hours are no longer snapped to a half day).
3. **Booking slot chips** — every booking flow (`Views/BookLabourFlowView.swift`, `Views/ScheduleQuickAddSheet.swift`, `Views/BookingHoursEditSheet.swift`, `Views/ScheduleOperativeView.swift`, `Views/ScheduleSubcontractorView.swift`, `Views/SubcontractorBookingEditSheet.swift`, `Views/MyScheduleView.swift` self-booking, manager site bookings, quick-select chips, `Core/Rulebook+BookingSlots.swift`): the buttons come from `allowedTimeSlotsOnDay` — Monday–Friday now Full day and Custom only (`WEEKDAY_TIME_SLOTS`). Remove any hard-coded AM / PM button. An existing AM / PM booking's edit sheet still shows its own slot; it is never rewritten.
4. **Leave halves** — call `leaveHalfDayWindows(policy)` (the exact middle of the day, ignoring the break: 06:30–14:30 → AM 06:30–10:30, PM 10:30–14:30) for every leave display: Daily Overview leave rows (`leaveHalfDayLabel`, e.g. "AM 06:30–10:30"), Schedule / My Schedule leave labels ("Annual Leave - AM (06:30–10:30)"), timesheet leave lines (`timesheetLeaveLines(…, dayPolicy)` → `timeRange`). `bookingLeaveConflicts` and `leaveCoverageRows` already use the leave halves inside the packed script; delete any Swift AM/PM leave window (`halfDayWindows` stays only for stored AM / PM bookings). Leave day counting (0.5 / 1) is unchanged.
5. **Warnings** — nothing new to pass: `unbookedLabourRows` / `unbookedLabourRowsOnDay` (whole working day, lunch-break window never needs covering) and `leaveCoverageRows` (lunch-break window never needs covering: AM leave + 11:00–14:30 on 06:30–14:30, lunch 10:00–10:45 → 0.25h missing) change inside the script. Re-run the warning parity tests.

Parity fixture: 17 new `1.20.0 …` cases (owner examples through `weekdayPaidDayPreview`, `weekdayPaidHours`, `payrollHoursResult`, `leaveHalfDayWindows`, `leaveCoverageRows`, `allowedTimeSlotsOnDay`, `bookingLeaveConflicts`).

1.20.1 (on top of 1.20.0): `leaveCoverageRows` no longer requires the lunch-break window to be booked on a half-leave day (AM leave + 11:00–14:30 on 06:30–14:30, lunch 10:00–10:45 → 0.25h missing). Inside the packed script; iOS only syncs and re-runs the parity tests. If iOS has a Home "hours booked" figure, it must come from `payrollHoursResult` under the day's policy, not a fixed 8h / 4h.

## New rulebook sections

- 1.20.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

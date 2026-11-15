# iOS follow-on — rulebook 1.53.0

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.53.0 → 1.53.0
Packed hash: 3f26c638f6a202058ae59924c4de4b9d3b082a20d6d88df1f863c68eb5ec8a0b
Rulebook sha256: 972f3985fb399062d471b995de2d5ad72a357c872116296c6d54199c179e4bf3
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
Exports added: clashDocumentsToRemove
Exports removed: clashApprovalDocumentIds
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetTotals.ts, lib/canonical/weeklyReportPay.ts
Done when:
- [ ] Packed hash in iOS equals 3f26c638f6a202058ae59924c4de4b9d3b082a20d6d88df1f863c68eb5ec8a0b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 972f3985fb399062d471b995de2d5ad72a357c872116296c6d54199c179e4bf3)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.53.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.53.0

- **Calculation sweep** (read-only sweeps 15 Nov; owner test 17 Nov). Rulebook: `weeklyReportPayRows` signed lines follow their own `isPayeDay` and the check line counts their days (A1); `timesheetTotals.hours` skips declined labour lines (A2); `LeavePerson.aliasUserIds` and labour bookings under a users id in `leaveCoverageRows` (A3); `clashPairKey` orders by lower-case id, new `legacyClashPairKey` and `clashDocumentsToRemove` (undo matches ignoring case and order), pair keys compare in either order (A4); `unverifiedOperativeRows` skips inactive rows (A5); new `homeUpNextRows` (A6, §23); new `dailyOverviewLeaveRows` (A7, §6); `WEEKLY_REPORT_DAYS_DISPLAY`, `WEEKLY_REPORT_DAYS_ROUNDED_NOTE`, `weeklyReportDaysText`, `weeklyReportPaySummaryNote`, `WeeklyReportPayRow.daysExact` (A9, owner confirmed); Daily Overview counts switched-off schedule locations (A10, owner confirmed, §6 statement); new `userLevelLabel` (Payrun Snapshot and weekly report Role). Review of #331: `timesheetTotals` per-booking declined parts, never below 0; a £0 unflagged signed line on a PAYE day is left out; `clashDocumentsToRemove` (undo by matching ignoring case and order); `bookingRequestClashIds` checks a new night shift against the next morning.
- Web: Book labour and the Schedule wizard's "already booked" use `isSameBookingRequest` (A8); My Schedule self-booking clashes via `bookingRequestClashIds` with the day before and the policy state (B1); clash rows dated on the group day in the organisation zone (B2); My Schedule clock text from `slotInterval` / `bookingStandardDayOn` (B3); Schedule wizard "No unpaid break" toggle and lunch warning (B4); `managers` rows to `warningScopeFor` on Warnings and Home (B5); weekly report warnings with aliases and `isWarningActive` (B6); bank holidays on the weekly report, the leave calendars, Home and Daily Overview (B7); orphan manager site bookings priced (B8); organisation-zone dates and real-date sorting (B9); Role = `userLevelLabel` (B10); manager site bookings matched without case in the timesheet collector (B11); owner invoice `decided` once signed (B12); admin leave calendar waits for the leave-year settings (B13); Project Breakdown per person (B14); timesheet hours from `timesheetTotals.hours` (B15).
- No security rules change.

## iOS work for 1.53.0

**Sync first.** 1.53.0 (calculation sweep, 15 Nov; owner test 17 Nov): fixes from the read-only sweeps of both apps. iOS calls the rules below through `CanonicalBusinessEngine` and deletes its own copies.
- **Not changed:** no Firestore rules, index, Storage or Functions change; nothing migrated; `minimumIosBuild` not needed (the weekly report is built on the device; old clash keys are still read).
- **Base:** web `origin/main` 1.51.0 + this PR (1.52 variations is a separate PR; its hand-off covers iOS variation maths: `VariationEditorSheet.swift:100,126,230`, `VariationModels.swift:144`, `VariationsListView.swift:171`). Line numbers below are from iOS `origin/main` at `1571142` (15 Nov); check them on your branch.
- **Owner confirmed 15 Nov:** A9 (weekly report note "Days are rounded; Pay is worked out from the exact hours.") and A10 (Daily Overview still counts Office / WFH / Site survey / custom bookings when that option is switched off).
- **Figures that change** (web, and iOS once it follows): A1 weekly report — a priced signed line on a day the person is PAYE now is paid (owner example £500.00 → £632.35; a £0 line with no PAYE flag stays out); B8 weekly report — a manager site booking whose job was deleted is paid, "Deleted job"; B11 timesheet — a manager site booking whose `userId` differs only in letter case is on the live timesheet (live pay and the unsigned invoice rise); B12 owner's invoice — `decided` once the line manager signed; B14 Project Breakdown per person; A2 / B15 declined labour lines count no hours (per booking, never below 0); weekly report Role words.

1. **Sync.** `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
2. **Overnight clashes when booking.** Copy the approach of `Core/ScheduleBookingConflictSupport.swift` (existing bookings of the booked day **and the day before**, `bookingRequestClashIds` under the policy state) in:
   - `Views/BookLabourFlowView.swift:2153-2201` (`managerWouldClash`, `operativeWouldClash` use `ManagerScheduleInterval.bookingsOverlap` / `OperativeBookingInterval.bookingsOverlap` on the same day only);
   - `Views/MyScheduleView.swift:1357-1360` (`wouldClashProbe`);
   - `Core/ScheduleWeekGrid.swift:312-321`;
   - `Views/ScheduleOperativeView.swift:1760-1766`.
   A weekend Full day is that day's own window (`bookingStandardDayOn`), never `slotInterval(policy)`.
3. **Business dates from the organisation zone, never `Calendar.current`.**
   - `Views/WarningsDetailView.swift:1451-1457` (`IdentifiableDay` start of day);
   - `Views/OrgSitesMapView.swift:13,128,138,192`;
   - `Views/HomeUpNextSupport.swift:26` — **replace the whole matcher with `homeUpNextRows({ nowMs, timeZone, viewer: { id, email, formerUserIds, sameEmailUserIds }, roster, operatives, bookings: [{ id, personId: operativeId, dayKey, status, timeSlot, workStartTime, workEndTime }], managerSiteBookings: [{ id, personId: userId, dayKey, timeSlot, workStartTime, workEndTime }], policy: <working-hours state> })`**; draw `result.days` (day key → heading) and each row's `startText` / `timeRange`; add only titles. Today's bookings stay all day; Completed shows; ids match without case under every id.
   - `Views/MyScheduleView.swift:2482-2488,2685-2695`: build times from wall-clock minutes in the organisation zone, so a clock-change day is right.
4. **Warnings inputs.**
   - Pass **all** operatives (not `.filter(\.isActive)`) in `Core/WarningsRefreshHelper.swift:487,590` and `Views/WeeklyReportView.swift:819` — the rules skip inactive people themselves (A5: `unverifiedOperativeRows` now takes `isActive` on operatives and people; pass it).
   - Pass people one per email, with the same-email ids in `formerIds`; delete `orderedPeopleForUnbookedScript` (~1003-1050) and `shareCoverageAcrossEmail` (~893).
   - Leave cover: each `LeavePerson` gets `aliasUserIds` (former + same-email ids) (A3).
   - Date clash rows from the group's `dayKey` (organisation zone) and include the previous day in the bookings scanned (`Core/WarningsService.swift:555`, `Core/WarningsComputation.swift:500-503,577,616`).
   - Pass the working-hours state, never `NSNull` (~1376).
   - Clash keys (A4): `clashPairKey` now orders by lower-case id; approvals saved under the old order still count (`isClashApproved` / `isClashGroupApproved` / `isWarningActive`). Undo deletes by **matching ignoring case and order**: call `clashDocumentsToRemove(clash, { acceptedClashes, resolutions })` with the documents the store listens to and delete every id it returns, in both collections — `Core/WarningResolutionStore.swift:415-424` today deletes `warningResolutions` only on an exact key match. Old device-only legacy keys (`Core/WarningResolutionStore.swift:595`) must not override `isClashGroupApproved`.
   - Pass the `managers` rows to `warningScopeFor` wherever the scope is built.
5. **Daily Overview (A10, owner confirmed).** Stop filtering by `scheduleOptions` in `Views/DailyOverviewView.swift:200-205,262-276` (`visibleOfficeBookings` etc.): every booking counts. "On annual leave" = `dailyOverviewLeaveRows(records, dayKey, timeZone, bankHolidayDayKeys)` (A7); the Home on-leave figures pass the same bank holidays to `homeOverviewMetrics` (`nonWorkingDayKeys`).
6. **Weekly report.**
   - Signed PAYE lines follow fix A1 (inside `weeklyReportPayRows`; nothing to do once you call it).
   - Show `weeklyReportPaySummaryNote(rows)` under the Pay Summary (A9) and Days with `weeklyReportDaysText(row.daysExact ?? row.days, row.kind)`.
   - Keep subcontractor rows for deleted jobs and firms (`bookingJobLabel`, "Deleted job").
   - Role column = `userLevelLabel(person)` (Admin / Manager / Operative, "Admin (Super Admin)").
   - Key rows by person id, never `name|role`.
   - Leave rows: pass the region's bank holidays as `nonWorkingDayKeys` to `weeklyReportLeaveRows`.
   - Delete the dead `buildCSV()` in `Views/WeeklyReportView.swift:1110`.
7. **Timesheets.**
   - Manager site bookings: match `booking.userId` without case under every id (`Core/TimesheetPayrollCollector.swift:304-306`, `normalizeDocumentId`).
   - `extrasMode` `decided` once the line manager has signed (`Views/InvoicingView.swift:6879`, `TimesheetInvoiceRows.rows(...)`).
   - Invoice totals with `roundPennies`; `shiftCount` excludes PAYE lines (`InvoicingView.swift:2330,5833`).
   - Hours shown from `timesheetTotals(...).hours` (A2: a declined labour line counts no hours).
8. **Dead fallback.** Remove `Core/Rulebook+WeekdayPaidDay.swift:46-53`'s stale `?? policy.standardPaidHours` fallback (fail visibly when the script does not answer) and its tests.
9. **Tests** (`ProjectPlannerTests`, through the engine): A1 (£632.35 run with a later PAYE switch), A4 (old-order key still approves), A6 (`homeUpNextRows` ids and today), A7 (bank holiday inside leave), an overnight booking clashing the next morning in Book labour.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

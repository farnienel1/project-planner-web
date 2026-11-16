# iOS follow-on — rulebook 1.54.0

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.53.0 → 1.54.0
Packed hash: 9fddef81df679e4626081802eaaf57f4b02517a4fe998fc949dc63750ec575ca
Rulebook sha256: 827bc8d96794f454fbe425d0c8b38be673830b4e372350e45ecc13d987c85cfe
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5a8a7e4e6f56b91cb18f71e79207782b8840fccf0b63b695826c47e18e59a32e
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: SIGNED_TIMESHEET_EXTRAS_CHANGED_COUNTERSIGN_MESSAGE, SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE, SIGNED_TIMESHEET_EXTRAS_CHANGED_REVIEWER_MESSAGE, SIGNED_TIMESHEET_EXTRAS_REOPEN_CONFIRM_MESSAGE, TIMESHEETS_HALF_SIGNED_HEADING, TIMESHEETS_HALF_SIGNED_HELP, TIMESHEETS_HALF_SIGNED_NONE, TIMESHEET_BOOKINGS_CHANGED_NOTICE_MESSAGE, TIMESHEET_BOOKINGS_CHANGED_NOTICE_TITLE, TIMESHEET_BOOKINGS_CHANGED_NOTICE_TYPE, TIMESHEET_EXPORTED_EXTRAS_MESSAGE, annualLeaveReportYearMonths, signedTimesheetChanges, signedTimesheetExtrasBaselineFields, signedTimesheetExtrasChanges, signedTimesheetExtrasRecord, timesheetBookingChangeNotice, timesheetBookingWriteMatters, timesheetBookingsChangedNoticeId, timesheetBookingsChangedRecipients, timesheetsHalfSigned
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeaveBalance.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/recordsDocuments.ts, lib/canonical/timesheet154.test.ts, lib/canonical/timesheetBookingNotice.ts, lib/canonical/timesheetEntryEvidence.ts, lib/canonical/timesheetExtrasChanges.ts, lib/canonical/timesheetHalfSigned.ts, lib/canonical/timesheetSnapshot.ts
Done when:
- [ ] Packed hash in iOS equals 9fddef81df679e4626081802eaaf57f4b02517a4fe998fc949dc63750ec575ca
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 827bc8d96794f454fbe425d0c8b38be673830b4e372350e45ecc13d987c85cfe)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.54.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.54.0

- **Switched-off schedule places are paid** (§4.8, §8, owner decision 16 Nov): the timesheet collector and the weekly report no longer leave out Office, Working from home, Site survey and custom-item bookings when that option is switched off (web `includesManagerScheduleLocation` removed). **Pay change** for unsigned timesheets and the weekly report; raise `minimumIosBuild`.
- **Price work and expenses after the line manager signs, until exported** (§8, §16, owner decision 16 Nov, replaces 1.43.0's block): `timesheetOwnerCanAddExtras` / `canEditTimesheetEntry` refuse only an exported sheet (`TIMESHEET_EXPORTED_EXTRAS_MESSAGE`); the change reopens the sheet like a booking change — new `signedTimesheetExtrasChanges`, `signedTimesheetExtrasRecord`, `signedTimesheetExtrasBaselineFields`, `signedTimesheetChanges`, `SIGNED_TIMESHEET_EXTRAS_CHANGED_MESSAGE`, `SIGNED_TIMESHEET_EXTRAS_CHANGED_REVIEWER_MESSAGE`, `SIGNED_TIMESHEET_EXTRAS_CHANGED_COUNTERSIGN_MESSAGE`, `SIGNED_TIMESHEET_EXTRAS_REOPEN_CONFIRM_MESSAGE`; new owner fields `operativeSignedExtras` + `operativeSignedExtrasSignedAt`; snapshot money rows carry `entryFingerprint`. No signature is cleared. Security rules: the owner's extras write is refused from `exportedAt` (was `managerSignedAt` / `approvedAt`).
- **"Your signed timesheet has changed"** (§8, §13, owner decision 16 Nov): new notice type `timesheet_bookings_changed` (push, toggle `timesheetSignOff`, opens My Timesheets), written by two new Cloud Functions on booking writes; `timesheetBookingChangeNotice`, `timesheetBookingWriteMatters`, `timesheetBookingsChangedRecipients`, `timesheetBookingsChangedNoticeId`, `TIMESHEET_BOOKINGS_CHANGED_NOTICE_*`. Replaces the 1.47.0 "no notification is sent".
- **Annual leave report = the balance's leave year** (§9, owner decision 16 Nov, web Annual leave report parity with iOS; review of web PR #335): new `annualLeaveReportYearMonths` (the months `annualLeaveBalance` uses — the person's own leave year with an allowance, else the organisation's), passed to `leaveReportRows` / `leaveReportYears`; "Holiday Report" renamed "Annual leave report" in §9. iOS `HolidayReportView` must call it.
- **Data health "Timesheets half signed"** (§8, owner decision 16 Nov, (a) + (c)): `timesheetsHalfSigned`, `TIMESHEETS_HALF_SIGNED_HEADING` / `_HELP` / `_NONE`. Read only.

## iOS work for 1.54.0

**Sync first.** 1.54.0 (timesheet owner answers, 16 Nov). iOS calls the rules below through `CanonicalBusinessEngine` and keeps no copy of its own. Line numbers are from iOS `main` (shallow clone, 16 Nov); check them on your branch.
- **Pay change — `minimumIosBuild` is raised before the web merge**: an older iPhone leaves switched-off schedule places out of pay and blocks extras after the line manager signs.
- **Base:** web 1.53.0 (#331) + this PR. Do the 1.53.0 hand-off first (it already stops Daily Overview filtering by `scheduleOptions`).

1. **Sync.** `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
2. **Switched-off schedule places are paid** (§4.8, §8). Stop using `MyScheduleOptions.includesManagerScheduleLocation` for pay:
   - `Core/TimesheetPayrollCollector.swift:315` — delete the `guard scheduleOptions.includesManagerScheduleLocation(booking) else { continue }`;
   - `Views/WeeklyReportView.swift:1194` and `Core/WeeklyReportPayInputs.swift:39` — `includesManagerBooking` always true (or remove the parameter);
   - then delete `Models/MyScheduleOptions+ScheduleLocations.swift:73` `includesManagerScheduleLocation` if nothing else calls it (pickers use `enabledScheduleLocations`).
   Figures that change: unsigned timesheets, their invoices and totals, and the weekly report gain Office / WFH / Site survey / custom-item bookings made while that option is switched off. Signed and exported sheets do not change.
3. **Price work and expenses after the line manager signs, until exported** (§8).
   - `Views/InvoicingView.swift:2698, 3199-3210` (`timesheetOwnerCanAddExtras`) and `3446-3460` (`canEditTimesheetEntry`): the rule now refuses only an exported sheet (`TIMESHEET_EXPORTED_EXTRAS_MESSAGE`); show its message as before.
   - Adding / editing / deleting an entry on a sheet the line manager signed (not self-signed): confirm with `SIGNED_TIMESHEET_EXTRAS_REOPEN_CONFIRM_MESSAGE`, **never clear any signature** (no `clearSignatures` on this path), and when `signedTimesheetExtrasBaselineFields({ sheet, storedEntries, selfSigned })` returns fields, write them (`operativeSignedExtras`, `operativeSignedExtrasSignedAt`) in the same save. A self-signed sheet keeps today's flow.
   - Every operative signature (a re-signature included) writes `operativeSignedExtras = signedTimesheetExtrasRecord({ priceWorkEntries, expenseEntries })` (entries with `id` and the reader's `reviewFingerprint`) and `operativeSignedExtrasSignedAt` = that `operativeSignedAt`, next to `operativeSignedBookings` (`InvoicingView.swift` sign handler; clear both where `operativeSignedBookings` is cleared, ~810).
   - `Models/TimesheetDraftModels.swift`: read and write `operativeSignedExtras` / `operativeSignedExtrasSignedAt` (keep them on every save — an older build dropping them only makes a change read from the snapshot); snapshot money lines (`TimesheetWeeklyReportMoneyLine`) read and write `entryFingerprint` (the entry's `reviewFingerprint` when built, `Core/TimesheetWeeklyReportOverrideBuilder.swift`).
   - Reopen state: where `Core/Rulebook+SignedTimesheetChanges.swift` calls `signedTimesheetBookingChanges`, also call `signedTimesheetExtrasChanges({ sheet, entries, selfSigned })` and combine with `signedTimesheetChanges(bookingChange, extrasChange)`; use the combined answer everywhere the booking answer is used today (triangle, re-sign, counter-sign again, export guard, lists, Payrun Snapshot, weekly report feed). The popup text is the combined `message`.
   - `TimesheetWeeklyReportOverrideBuilder`: on a routine reviewer save, while `signedTimesheetExtrasChanges(...).snapshotChanged`, keep the snapshot's money rows; only the counter-signature again (rebuild) takes the live entries.
4. **New notice type `timesheet_bookings_changed`** (§13). Written by the server; iOS only reads it. `Models/NotificationModel.swift:38` — add the case; route it with `notificationDestination` (kind `timesheetMine`, `dayKey` = the pay run's first day, `deepLinkUserId` the person) to My Timesheets for that period; push toggle `timesheetSignOff`.
5. **Annual leave report = the balance's leave year** (§9). `Views/HolidayReportView.swift:77, 118` pass `user.annualLeaveYearStartMonth` whatever the allowance; call `annualLeaveReportYearMonths({ annualLeaveEnabled, startMonth, endMonth, orgStartMonth, orgEndMonth, onDayKey, timeZone, employment })` (the same inputs as the balance on that screen) and pass its `startMonth` to `leaveReportRows` / `leaveReportYears`. Rename the screen title "Annual leave report" if it says "Holiday Report".
6. **Data health "Timesheets half signed"** — web only (iOS has no Data health screen); nothing to do.
7. **Tests:** a `Rulebook1540Tests` covering: Office booking with `showOffice: false` paid by the collector; an expense added after the counter-signature → `waitingFor: person`, no signature cleared; re-sign → `lineManager`; the new type decodes and routes; the leave report for an April–March person in a January–December company equals the balance's `taken` (2 Feb, 4 May, 2 Nov 2026 → 2 days).

## New rulebook sections

- 1.54.0 — 2026-11-16

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

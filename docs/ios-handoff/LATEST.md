# iOS follow-on — rulebook 1.35.0

Generated 2026-11-10 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.34.0 → 1.35.0
Packed hash: a0f465556ae136a80e94167064fadddf159d4b117063495206f89e290b8af000
Rulebook sha256: c236db2648833401fc5903a9c5c3b9dd223690d2097cce283b7e3a41fbbaf5e2
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: annualLeaveBankHolidayRange, bookedWorkedHours, homeBookingDayKey, myProfileBankHolidayRange, myProfileSummary, organizationWeekDayKeys, tasksAssignedToViewer
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/annualLeaveBalance.ts, lib/canonical/bundleEntry.ts, lib/canonical/dayKeys.ts, lib/canonical/homeOverview.ts, lib/canonical/index.ts, lib/canonical/managerCoverage.ts, lib/canonical/myProfileSummary.test.ts, lib/canonical/myProfileSummary.ts
Done when:
- [ ] Packed hash in iOS equals a0f465556ae136a80e94167064fadddf159d4b117063495206f89e290b8af000
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c236db2648833401fc5903a9c5c3b9dd223690d2097cce283b7e3a41fbbaf5e2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.35.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.35.0

- **My Profile figures** (§12, owner decisions 7 Nov; new `lib/canonical/myProfileSummary.ts`): `myProfileSummary` — annual leave left (`annualLeaveBalance.remaining`, after pending, Q4), hours booked this Monday–Sunday week (worked hours, no multiplier, Q1/Q2), open tasks with overdue and due this week (undated tasks counted, Q3), qualifications expiring soon (`qualificationExpiryCount`) and every line manager by name (`lineManagerSummary`, Q5).
- New helpers it composes: `organizationWeekDayKeys` (the Monday–Sunday organisation week, `dayKeys.ts`), `bookedWorkedHours` (one person's worked hours on a day, overlaps once, `managerCoverage.ts`), `tasksAssignedToViewer` and `homeBookingDayKey` (factored out of `homeOverviewMetrics`, unchanged behaviour).
- Web: My Profile "Your figures" card; Annual leave and Edit User now count a person's leave under every id they go by, with the region's bank holidays (`leaveRecordsForAccount`), instead of one id and no bank holidays.
- Bank holidays for a leave balance (§12, review fix): `annualLeaveBankHolidayRange` and `myProfileBankHolidayRange` — the previous leave year's start to the current one's end, so carry-over sees last year's bank holidays (Easter Monday 2025 in an April leave year). My Profile, Annual leave and Edit User (web) and My Profile and the leave screens (iOS) load bank holidays for these years and wait for them before showing a figure; web My Profile read the organisation's leave defaults from the organisation document instead of `annualLeaveDefaults`.
- No rules, index, Storage or Functions change.

## iOS work for 1.35.0

**Sync first, then ship the iOS work in the same release.** 1.35.0 adds the My Profile figures (rulebook §12, owner decisions 7 Nov). Read-only; no Firestore field, rules or `minimumIosBuild` change.

Every figure goes through `CanonicalBusinessEngine`; no Swift copy of any rule.

1. **Bridge** — new `Core/Rulebook+MyProfile.swift`: `CanonicalBusinessEngine.myProfileSummary(...)` passing `nowMs`, the organisation zone (`OrganizationRulebookContext`), the signed-in `viewer` `{ id, email }`, their users document (leave fields, `employmentStartDate`, line manager fields, `formerUserIds`), the unfolded roster (names), `operatives` rows with `expiries` (`qualificationId`, `name`, `expiryIso` — the shape the Warnings scan already builds), `managers`, `annualLeaveDefaults`, leave records as `parseHolidayDocument` returns them, the region's bank holidays, tasks, labour and manager site bookings (`date` or `dayKey`, `status`, slot, clock times, `isBreakRemoved`) and the organisation document (or policy state) as `policyState`.
2. **One profile screen** — merge `Views/HomeView.swift` `HomeProfileCardSheet` (~1916, read-only) into `Views/SettingsHubSupportViews.swift` `SettingsProfileDetailView` (~110, editable); the Home avatar and Settings → My Profile open the same screen. Keep every field and behaviour; add the "Your figures" card. The rate and employment type come from `readStoredRates` and `employmentTypeOnDay` on the organisation day (not the device day, not always "Day rate").
3. **Figures** — leave `remaining` ("N days left", pending already off; no allowance: "Days taken this leave year: N" from `usedThisYear`); `hoursThisWeek.hours` (Mon–Sun, worked hours, no multiplier); `tasks.open` with `overdue` and `dueThisWeek` underneath; `qualifications` ("None" when `total` is 0); every `lineManager.ids[].name` (never "+N more"). Each links to Annual leave, My Schedule, Tasks, My Qualifications and, for admins, the line manager's profile.
4. **Bank holidays for a leave balance** (review fix) — `annualLeaveBankHolidayRange` / `myProfileBankHolidayRange` return the previous leave year's start to the current one's end and its calendar `years`. Load the region's bank holidays for those `years` before showing a balance (carry-over needs last year's), on My Profile and on the leave screens (`HolidayView`, `OperativeAnnualLeaveViews`): `BankHolidayService.ensureLoaded(..., alsoYears:)`. Never compute the range in Swift. Don't compute the figures in `body`: work them out in `.task(id:)` when a store changes, and floor `nowMs` to the minute so the memo hits.

## New rulebook sections

- 1.35.0 — 2026-11-10

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

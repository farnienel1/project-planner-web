# iOS follow-on — rulebook 1.41.0

Generated 2026-11-12 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.41.0 → 1.41.0
Packed hash: ab7e673f1f3dfdc260e39a4c3d534a431cf58a06d7eb2e8c98a73881f16700ee
Rulebook sha256: c890f1162ee91e16a048ad2b83502a50093d127104cf4121ac19c2adc6f4e945
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DATA_CHECK_PANEL_ORGANIZATION_IDS_FIELD, DATA_CHECK_PANEL_SWITCH_FIELD, DATA_PARITY_CHECKS, DATA_PARITY_CONFIRM_DELAY_MS, DATA_PARITY_LOG_LIMIT, DATA_PARITY_MIN_INTERVAL_MS, DATA_PARITY_SKIP_REASONS, DATA_PARITY_TRIGGERS, MY_SCHEDULE_CLASH_APPROVED_MESSAGE, MY_SCHEDULE_CLASH_APPROVED_TITLE, MY_SCHEDULE_CLASH_ASK_MANAGER, MY_SCHEDULE_CLASH_DISMISSED, MY_SCHEDULE_CLASH_NOT_IN_PERIOD, MY_SCHEDULE_CLASH_OPEN_WARNINGS, MY_SCHEDULE_CLASH_TITLE, bookedWithOvertimeText, bookingBreakDeductionText, bookingBreakText, bookingHoursCountText, bookingHoursExplanation, bookingHoursTiles, bookingShortfall, dataCheckPanelEnabled, dataCheckPanelVisible, dataParityCheck, dataParityCheckDefinition, dataParityCheckDue, dataParityConfirm, dataParityLogAppend, dataParityLogEntry, dataParitySumCounts, dataParitySummary, myScheduleClashMarkers, onSiteHoursText, overtimeIncludedText, overtimeTotalText, saveHoursLabel
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingHoursExplanation.test.ts, lib/canonical/bookingHoursExplanation.ts, lib/canonical/bookingHoursText.test.ts, lib/canonical/bookingHoursText.ts, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/data-parity-fixture.json, lib/canonical/dataParity.test.ts, lib/canonical/dataParity.ts, lib/canonical/index.ts, lib/canonical/myScheduleClash.ts, lib/canonical/parity-fixture.json, lib/canonical/platformConfig.ts
Done when:
- [ ] Packed hash in iOS equals ab7e673f1f3dfdc260e39a4c3d534a431cf58a06d7eb2e8c98a73881f16700ee
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c890f1162ee91e16a048ad2b83502a50093d127104cf4121ac19c2adc6f4e945)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.41.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.41.0

- **One tile per person-day on a job's scheduling week** (§21, owner decision 11 Nov, option a): new `scheduleDayCell` — the day total and the number of bookings ("26h · 2 bookings"), standard and overtime underneath, the clock overtime at each rate (`multipliedHoursText`); on a leave day (brown band) the "Std" / "OT" words are dropped (owner yes). Web now combines a person's day into one tile like iOS; a tile with several bookings opens a chooser so every booking stays editable (iOS opened only the longest booking).
- **A booked person is never unknown** (§21): iOS leaves a booking whose id names nobody off the grid, as web does, and logs it (`SCHEDULE_BOOKING_PERSON_UNRESOLVED`); tests lock that former ids, same-email ids, `operatives` rows and ghosts resolve (`resolveBookingPerson`).
- **Replace existing booking** (§5, §2, owner decision 11 Nov, build before launch): a third choice, Replace, on every orange double-booking row, offered only when the viewer may delete every overlapping booking (`bookingReplaceOffer`); the new booking, the old booking's delete and its tombstone are one batch (`bookingReplaceWrites`); `BOOKING_CONFLICT_DECISIONS`, `BOOKING_REPLACE_LABEL`, `BOOKING_REPLACE_HELP`, `BOOKING_REPLACE_CHOSEN_TEXT`, `BOOKING_REPLACE_COLLECTIONS`. Online only on iOS and Android (`booking.replace` in `OFFLINE_ACTIONS`). No rules change (emulator test).

## iOS work for 1.41.0

**Sync first.** 1.41.0: one tile per person-day on the Scheduling week (owner option a), unknown rows dropped like web, and Replace on every orange double-booking row (owner decision 11 Nov). No Firestore field, rules or `minimumIosBuild` change; the Replace batch passes the live rules (web `tests/bookingReplace.rules.test.ts`).

1. **Sync** — `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`.
2. **Day tile** — `Views/ProjectDetailView.swift` (`schedulingCombinedDayCell`, subcontractor rows too) and `Views/ProjectSchedulingV2Support.swift`: the chip reads `scheduleDayCell({ bookings: [{ paidHours, overtimeHours, timeSlot, overtime }], onLeave })` — `headline` ("26h · 2 bookings"), `standardText` / `overtimeText` underneath, `caption` (nil on a leave day for Std / OT). A tap on a day with one booking opens it; with several, a chooser of that day's bookings (each with its times and hours) — never only the longest.
3. **Unknown rows** — `Core/ScheduleWeekGrid.swift` `staffRows`: a bucket that `resolveBookingPerson` (or the no-script fallback) cannot name is left off the grid, as web does, and logged with `NSLog("SCHEDULE_BOOKING_PERSON_UNRESOLVED …")`. Former ids, same-email ids, `operatives` rows and ghosts keep resolving.
4. **Replace** — `Core/Rulebook+BookingReplace.swift`: `bookingReplaceOffer`, `bookingReplaceWrites`, `BOOKING_REPLACE_*`. Every orange row (Select Operatives / Scheduling wizard, Quick Add, Book labour) shows Replace beside ✓ and ✕ only when the offer says so (`canDeleteBooking` on every overlapping booking, `JobAccessContext.bookingRemoveAction == "delete"`). The save is ONE Firestore batch: the new booking's create + each replaced booking's delete + its tombstone (`deletedAt` server timestamp). Online only: `OfflineAction.bookingReplace` (`booking.replace`) is `onlineOnly`, so offline the Replace button is disabled with `OFFLINE_ONLINE_ONLY_MESSAGE`; ✓ and ✕ still work offline.

## New rulebook sections

- 27. Data check (1.38.0)
- 1.39.0 — 2026-11-11
- 1.38.0 — 2026-11-11

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

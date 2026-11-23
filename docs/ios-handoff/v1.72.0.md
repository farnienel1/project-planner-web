# iOS follow-on — rulebook 1.72.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.71.0 → 1.72.0
Packed hash: 4d373a4eb0307b12be0a4ee851c1d65758f283f3531c6cc6e2c9c616077c3816
Rulebook sha256: 4eba9b741022d9303794dc8dfb3089fa69d47e12b8ccb27433b8dc6f7c7bda29
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 926b910948b674b1fa259e8f933ddd15f14bad00b8e0b050ccbd88c723bf64aa
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: TIMESHEET_REVIEW_BOOKING_FIELDS, TIMESHEET_REVIEW_BOOKING_MISSING_MESSAGE, TIMESHEET_REVIEW_BOOKING_REFUSED_MESSAGE, TIMESHEET_REVIEW_BOOKING_SENT_BACK_MESSAGE, TIMESHEET_REVIEW_DELETE_BOOKING_CANCEL_LABEL, TIMESHEET_REVIEW_DELETE_BOOKING_CONFIRM_LABEL, TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE, TIMESHEET_REVIEW_DELETE_BOOKING_TITLE, TIMESHEET_REVIEW_DELETE_BOOKING_UNDO_NOTE, TIMESHEET_REVIEW_DELETE_OVERTIME_NOTE, TIMESHEET_REVIEW_EDIT_BOOKING_NOTE, TIMESHEET_REVIEW_REMOVE_OVERTIME_CONFIRM_LABEL, TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE, TIMESHEET_REVIEW_REMOVE_OVERTIME_TITLE, isTimesheetReviewBookingCollection, timesheetLabourLineReviewActions, timesheetReviewBookingDelete, timesheetReviewBookingEditWrites, timesheetReviewDeleteBookingWarning, timesheetReviewOvertimeRate, timesheetReviewOvertimeStrike
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/timesheetLineDisplay.ts, lib/canonical/timesheetReviewBookingWrites.ts
Done when:
- [ ] Packed hash in iOS equals 4d373a4eb0307b12be0a4ee851c1d65758f283f3531c6cc6e2c9c616077c3816
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 4eba9b741022d9303794dc8dfb3089fa69d47e12b8ccb27433b8dc6f7c7bda29)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.72.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.72.0

- **The line manager's ⚙ and ✕ change the booking** (§8, §16, owner decisions 23 Nov, A and B): new `timesheetReviewBookingEditWrites`, `timesheetReviewBookingDelete`, `timesheetReviewDeleteBookingWarning`, `timesheetLabourLineReviewActions`, `isTimesheetReviewBookingCollection`, `TIMESHEET_REVIEW_BOOKING_FIELDS` and the `TIMESHEET_REVIEW_*` copy (`lib/canonical/timesheetReviewBookingWrites.ts`). ⚙ on a labour line under review writes the booking's times, slot, break toggle and overtime rate (partial update, write metadata) instead of a `payrollLineReviews` entry; ✕ deletes the booking with its tombstone; the 1.47.0 rule then sends the sheet back to the person. ✓ is unchanged. Stored edited / declined reviews are read as before (guardrail 3). Web: the review page writes the booking, confirms ✕ and says the sheet goes back to the person; the dead `payrollReviewAfterSave` is removed.
- **Security rules** (§16): the line manager's booking update allows `isBreakRemoved` (a bool); a person's line manager deletes their labour (users id, not a ghost) or manager site booking with a tombstone they write in the same batch (`lineManagerTombstoneNew`), and a tombstone is accepted when its booking is deleted in that batch. Compile cost kept below main: `jobListsCaller` matches its two manager lists in one string, `isPlatformOwner` reads `email_verified` directly and `callerLineManagesUser` binds the users document once (no allow / deny change). Emulator suite `tests/timesheetReviewBooking.rules.test.ts`; the line manager's new delete changed two older tests' fixtures (`bookingReplace`: the operative's line manager is the admin; `overtime`: a tombstone with no request now succeeds for the line manager).
- **Company data export has no download links** (§12, owner decision 23 Nov, C): files.csv lists name, kind and storage path; every download URL in the records becomes its storage path (web `lib/companyExport`, not packed).
- **Review of #416 and owner answers 23 Nov**: ⚙ writes a rate only when the reviewer changed it, and back to the organisation's rate removes a stored override (`timesheetReviewOvertimeRate`, `overtimeRate` input on `timesheetReviewBookingEditWrites`; before, an overtime line saved unchanged wrote the organisation's rate onto the booking); stored clock times are read with `bookingClock` ("7:00 AM" saved unchanged writes nothing); ✕ on an OVERTIME line removes the overtime only (`timesheetReviewOvertimeStrike` on `overtimeStrikeOutcome`: trim to the standard part, times and slot only; a booking with no standard part falls back to the delete) with new copy `TIMESHEET_REVIEW_REMOVE_OVERTIME_*` and a new `TIMESHEET_REVIEW_DELETE_OVERTIME_NOTE`; ✕ on the standard line still deletes. The export replaces download URLs inside any text too. §16 states the two accepted limits of the line manager's delete.
- **`timesheetLineDisplay`** reads the slot from the part before " · ", so "FULL DAY · no break" reads "Full day 07:00–16:00 · no break".
- **Issue 21** (web): the adjustments card names the day and job ("Day adjusted · Mon 23 Nov · J-1042 · Station Road"), never the line id.

## iOS work for 1.72.0

1. **⚙ Edit hours on a timesheet line under review changes the BOOKING (decision A).** In `Views/InvoicingView.swift` (`OperativeTimesheetReviewView` and the manager review rows) and `Views/TimesheetManagerReviewSupport.swift` (Edit hours save, `applyPayrollReviewSave` / `revisedAmount`): stop writing `payrollLineReviews[lineId] = { decision: 'edited', … }`. Read the live booking fresh (`bookings/{id}` or `managerSiteBookings/{id}`; collection from the line, `mgr-` = manager site), call `timesheetReviewBookingEditWrites({ booking, startTime, endTime, isBreakRemoved, overtimeRate, slotWindow, timeZone })` through `CanonicalBusinessEngine` (`overtimeRate` = `{ typed, opened, organizationMultiplier }` on an overtime line — the rate box as saved, what it showed when the editor opened, and the organisation's rate that day — so a rate nobody changed is never written and setting it back to the organisation's rate removes a stored override (`timesheetReviewOvertimeRate`); null on a standard line; `slotWindow` = the times the editor opened with, so an unchanged Full day writes nothing; stored times like "7:00 AM" are read with `bookingClock`) and write `set` / `remove` as a partial `updateData` plus write metadata. Show `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE` in the editor, "Save to booking" on the button and `TIMESHEET_REVIEW_BOOKING_SENT_BACK_MESSAGE` after a change. Keep `revisedPayrollLineAmounts` for the preview and to refuse times that cannot be priced. Online only.
2. **✕ on an OVERTIME line removes the overtime only (owner answer 23 Nov, #416 Q3).** Read the booking fresh and call `timesheetReviewOvertimeStrike({ booking: { …stored, id, collection, dayKey }, organization: <working-hours state>, timeZone, summary })`: `trim` → show its `title` ("Remove the overtime from this booking?"), `summary` (with the new times), `message`, `confirmLabel` / `cancelLabel`, and on confirm write its `set` / `remove` (times and slot only, the rate untouched) as a partial `updateData` plus write metadata; `delete` → the delete below with `overtimeLine: true`; `refused` → show its `error`.
2b. **✕ on a standard line deletes the booking (decision B).** Show `timesheetReviewDeleteBookingWarning({ summary, overtimeLine })` (title, summary, message, overtime note, undo note, Remove booking / Go back); on confirm write `timesheetReviewBookingDelete({ booking, deletedBy, platform: 'ios' })` → the booking delete and its tombstone (with server `deletedAt`) in ONE batch. No `declined` review is written for a labour line. Price work, expenses and late extras keep their ✓ ✕ ⚙ unchanged.
3. **Which actions a line gets:** `timesheetLabourLineReviewActions({ sheet, line })` → `{ approve, removeBooking, editBooking }` (none once exported, on a PAYE day or leave line; ✕ ⚙ only when the line names a labour or manager site booking).
4. **Refused writes:** permission-denied → `TIMESHEET_REVIEW_BOOKING_REFUSED_MESSAGE`; a booking deleted elsewhere → `TIMESHEET_REVIEW_BOOKING_MISSING_MESSAGE`. The live sheet then goes back to the person through the existing 1.47.0 `signedTimesheetBookingChanges` (nothing else to write).
5. **Old data:** keep reading stored edited / declined `payrollLineReviews` exactly as now (they still price older sheets).
6. **Timesheet line wording:** `timesheetLineDisplay` now reads "FULL DAY · no break" as "Full day 07:00–16:00 · no break" (rulebook change only; no Swift change if iOS already calls it).
7. **Adjustments card (issue 21):** if iOS shows "Day adjusted (op-…)", name the day and job instead (organisation-zone day + `timesheetLineDisplay(line).title`, "a booking no longer on this timesheet" when the line is gone).
8. **Release order:** iOS 1.72 ships before web merges; the owner raises `minimumIosBuild` to it before the 1.72.0 Firestore rules are published.

## New rulebook sections

- 1.72.0 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

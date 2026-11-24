# iOS follow-on — rulebook 1.77.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.77.0 → 1.77.0
Packed hash: fd0451906e5e84f90009f1301e7a0a48fd43e1b64726b1f1eadd0c975aed3e6a
Rulebook sha256: f2009fc1328593e503da5bc4b02292dd494657fa3e24483d61c9c0b11db8c0d7
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
Exports added: qualificationsMissingOwnExpiry
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/operativeQualifications.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals fd0451906e5e84f90009f1301e7a0a48fd43e1b64726b1f1eadd0c975aed3e6a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f2009fc1328593e503da5bc4b02292dd494657fa3e24483d61c9c0b11db8c0d7)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.77.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.77.0

- **Timesheet clarity** (§8, §7, §13, owner decisions 23 Nov, points 1, 2, 3, 5, 6; new `lib/canonical/timesheetClarity.ts`): `timesheetNextStep` (whose turn / what next, `TIMESHEET_NEXT_STEP_INVOICE_TEXT`, `TIMESHEET_NEXT_STEP_EXPORTED_TEXT`, `TIMESHEET_GENERATE_INVOICE_PROMPT`); `signedTimesheetChangeDetails` with `parseTimesheetBookingFingerprint`, `timesheetChangeDayLabel`, `TIMESHEET_CHANGE_DETAILS_HEADING`, `TIMESHEET_CHANGE_DETAILS_REVIEWER_HEADING`, `TIMESHEET_CHANGE_DETAILS_COLLAPSED_ROWS`; `timesheetCorrectionOption`, `TIMESHEET_CORRECTION_LABEL`, `TIMESHEET_CORRECTION_REVISION_BOOKINGS_HELP`; `timesheetReportKeepsSignedFigures`, `timesheetReportWaiting`, `TIMESHEET_REPORT_AWAITING_RESIGN_LABEL` ("Awaiting re-sign"), `TIMESHEET_REPORT_AWAITING_APPROVAL_LABEL`, `TIMESHEET_SNAPSHOT_AWAITING_APPROVAL_LABEL` (point 6 wording, owner chose (a)); `TIMESHEET_NEXT_STEP_ADMIN_SIGNER` and `hasLineManager` on `timesheetNextStep` / `timesheetCorrectionOption` (no active line manager: "Waiting for an admin to sign off"); `TIMESHEET_CHANGE_NOT_IN_SIGNED_COPY_LABEL`. New `timesheetSignedEntryChanges` (`timesheetSignedEntriesChangedSinceSignOff` is its non-empty test, unchanged answer).
- `timesheetSignedNoticeText` messages end with `TIMESHEET_SIGNED_NOTICE_INVOICE_NEXT` ("Next: generate your invoice."; `invoiceNext: false` leaves it off). Same type, id, recipients and deep link.
- `weeklyReportPayRows` check: new `showingSignedFigures` and `awaitingResign`; the state label adds "Awaiting re-sign" (back with the person) or "Awaiting line manager approval — showing last signed figures"; `PayrunSnapshotSheet.bookingsChange` takes `bookingsChanged`, and the Timesheet cell label adds "Awaiting re-sign" or "Awaiting line manager approval". No figure changes (tested).
- Review of the 1.77.0 branch: a change-details job move against an older signed copy with no place key reads as a job change; a self-signed snapshot gap reads "Not in your signed copy"; the reviewer's revision help keeps the B1 sentence; web announces the whose-turn line to screen readers only when its text changes; iOS passes the real `hasInvoiceDays`, the revision label from `canCreateTimesheetRevision` and `hasLineManager`.
- Web: the timesheet page shows the whose-turn line (with Generate invoice on a signed-off sheet), the "Changed since you signed" card and one "Correct this timesheet" entry (replacing the separate Make changes and revision buttons).

## iOS work for 1.77.0

Built in iOS PR on branch `ios-1.77-timesheet-clarity` (stacked on the 1.76 branch). Calls through `CanonicalBusinessEngine` only:

1. `Project Planner/Core/Rulebook+TimesheetClarity.swift` — wrappers `timesheetNextStep`, `signedTimesheetChangeDetails`, `timesheetCorrectionOption`, `TIMESHEET_GENERATE_INVOICE_PROMPT`; `SignedTimesheetChanges.changeDetails(...)` (same inputs as the 1.47.0 comparison, plus jobs and entry options); `TimesheetClarityNames` (line manager name through `lineManagerSummary`, named only when there is exactly one).
2. `Project Planner/Views/TimesheetClarityViews.swift` — `TimesheetNextStepCard`, `TimesheetChangesCard` (three rows, then "Show all (N)"), `TimesheetCorrectionEntryView`.
3. `Project Planner/Views/InvoicingView.swift` — My Timesheet: whose-turn line at the top (Generate Invoice beside it when the existing button would be enabled), the changes card while the person must sign again or an update is due, one "Correct this timesheet" entry (revision → `createRevisionAndOpen`; late extras → asks price work / expense, then `beginAddingExtra`). Reviewer screen: whose-turn line, changes card while it waits for the line manager or an update is due, and "Correct this timesheet" in place of the two "Make changes" buttons (reopen review → `makingChangesFor`; revision → `createRevisionForPerson`).
4. `Project Planner/Core/Rulebook+SignedTimesheetChanges.swift` — the report argument carries `bookingsChanged` (point 6 label on the weekly report check line and Payrun Snapshot comes from the rulebook).
5. `ProjectPlannerTests/Rulebook1770Tests.swift` — the packed script answers for each function.
6. Review fixes (same branch): `InvoicingView.swift` — the reviewer's correction help names the revision from `canCreateTimesheetRevision(...).nextRevision` (`reviewerRevisionCheck`), and the person's revision entry uses `canCreateTimesheetRevision(... writerIsSubject: true).allowed` (`personRevisionCheck`), as web; `hasInvoiceDays` is the real `timesheetDaysForPerson` answer and `hasLineManager` is `hasActiveLineManager` (`TimesheetClarityNames.hasInvoiceDays` / `.hasLineManager`), passed to `timesheetNextStep` and `timesheetCorrectionOption` ("Waiting for an admin to sign off" with no active line manager). Point 6 wording (owner chose (a)): the weekly report and Payrun Snapshot labels come from the rulebook (`timesheetReportWaiting`, "Awaiting re-sign" / "Awaiting line manager approval…"); nothing to change in Swift beyond passing `waitingFor` (already in `reportArgument`).

## New rulebook sections

- 1.75.0 — 2026-11-23
- 1.73.2 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

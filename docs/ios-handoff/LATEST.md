# iOS follow-on — rulebook 1.76.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.76.0 → 1.76.0
Packed hash: 74e83605ccdcef68e7562b50759e912bbf798b96942c3bab4a61a4455dc94da4
Rulebook sha256: ed81ffb00bb0ba08d908941deb89bd78a08475a0f3be21f1b0af662bcc41cd25
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/timesheetMakeChanges.ts
Done when:
- [ ] Packed hash in iOS equals 74e83605ccdcef68e7562b50759e912bbf798b96942c3bab4a61a4455dc94da4
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ed81ffb00bb0ba08d908941deb89bd78a08475a0f3be21f1b0af662bcc41cd25)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.76.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.76.0

- **"Make changes" on a timesheet** (§8, owner decisions 23 Nov, A1 and B1): new `timesheetMakeChangesAction`, `timesheetMakeChangesHelp`, `timesheetRevisionReviewerMayEditBookings`, types `TimesheetMakeChangesAction`, `TimesheetMakeChangesInput`, copy `TIMESHEET_MAKE_CHANGES_LABEL`, `TIMESHEET_MAKE_CHANGES_REOPEN_HELP`, `TIMESHEET_MAKE_CHANGES_REVISION_HELP`, `TIMESHEET_MAKE_CHANGES_ACTIVE_NOTE`, `TIMESHEET_MAKE_CHANGES_CANCEL_LABEL`, `TIMESHEET_REVISION_REVIEWER_EDIT_NOTE`, `timesheetSignedCopyTracksBookings`, `TIMESHEET_MAKE_CHANGES_OLD_SHEET_HELP` (`lib/canonical/timesheetMakeChanges.ts`). A1: on a signed-off, unexported sheet the reviewer reopens the review on the page (nothing written), changes bookings with ⚙ / ✕ (recorded in `reviewerBookingEdits`, 1.74.0), and signs it off again; the person never signs again and is told "changed and signed off". B1: on an exported sheet the button is the former "Create revision" (1.55.0, unchanged), and the reviewer may change an open revision's bookings before the person signs it. Web: the review page's Signed off panel and revision panel. No rule, data or figure changes otherwise; `TIMESHEET_CREATE_REVISION_LABEL` / `_HELP` kept for older builds. Review of #427: no button on a signed-off sheet whose signed copy has labour lines without `bookingFingerprint` (signed before 1.46.0) or no signed copy — a help line says to export and revise instead; the making-changes state ends with its counter-signature; the button waits for the bookings to load.

## iOS work for 1.76.0

Built in the same change on iOS (branch `ios-1.76-make-changes`); this lists what that branch does, for checking.

No new `minimumIosBuild` raise beyond 1.74.0's (an iPhone before 1.74 does not read `reviewerBookingEdits`, so a web Make changes edit would send the sheet back to the person there; raise to a build with 1.74 + 1.76).

**A1. "Make changes" on a signed-off, unexported sheet (reviewer only).**
- `Project Planner/Core/Rulebook+TimesheetMakeChanges.swift` (new): `timesheetMakeChangesAction`, `timesheetMakeChangesHelp`, `timesheetRevisionReviewerMayEditBookings` and the `TIMESHEET_MAKE_CHANGES_*` copy through `CanonicalBusinessEngine`.
- `Project Planner/Views/InvoicingView.swift` `OperativeTimesheetReviewView`: under "Signed off", when `makeChangesAction == .reopenReview`, a "Make changes" button; pressed, it shows `TIMESHEET_MAKE_CHANGES_ACTIVE_NOTE` and "Stop making changes", and the labour lines show ⚙ and ✕ only (`TimesheetManagerReviewActionBar(canApprove: false)`). Nothing is written by the button. The ⚙ / ✕ / trim writes are the 1.74.0 ones (booking + `reviewerBookingEdits` in one batch); after the first change the sheet reads `waitingForLineManager` and the existing "Counter-sign again" button and `notifyTimesheetCounterSigned(changedByReviewer:)` apply (the notice id carries the new counter-signature's instant, 1.60.1).

**B1. Exported sheet.** The reviewer's "Create revision" button reads `TIMESHEET_MAKE_CHANGES_LABEL` with `timesheetMakeChangesHelp(.createRevision)`; on the open revision, before the person signs, ⚙ / ✕ are offered (`timesheetRevisionReviewerMayEditBookings`) with `TIMESHEET_REVISION_REVIEWER_EDIT_NOTE`.

**Review of #427 (built on iOS #278 too):**
- Pass the signed copy to `timesheetMakeChangesAction` (`weeklyReportOverride.lines` with `bookingFingerprint`, `isLeave`, `isPayeDay`, `reviewPartOf`): a sheet signed before 1.46.0 (or with no signed copy) gets no button; show `timesheetMakeChangesHelp(nil, sheet, input)` (`TIMESHEET_MAKE_CHANGES_OLD_SHEET_HELP`) instead.
- Clear "making changes" when the action is no longer `reopenReview` (keyed to the counter-signature it was opened on); hide the old "Signed off. Once exported…" caption while the action is `reopenReview` or the old-sheet help shows.
- Pass `revisionOf` (the original's id) as well as `revision` to `timesheetRevisionReviewerMayEditBookings`.
- A signed copy with no labour line (price work / expenses only) gets neither the button nor the old-sheet line.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

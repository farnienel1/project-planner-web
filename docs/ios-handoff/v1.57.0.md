# iOS follow-on — rulebook 1.57.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.57.0 → 1.57.0
Packed hash: 6aa0184804eaeb352d473d82068e9d766b5b44deb62a2ef87a4827e0cfbf0fa4
Rulebook sha256: f0552b375e75270553eaf8f6236fc0383d1b0e0dd55d21015f4bc018627c1044
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts
Done when:
- [ ] Packed hash in iOS equals 6aa0184804eaeb352d473d82068e9d766b5b44deb62a2ef87a4827e0cfbf0fa4
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f0552b375e75270553eaf8f6236fc0383d1b0e0dd55d21015f4bc018627c1044)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.57.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.57.0

- **Owner test 17 Nov (timesheets on web)**: a signed snapshot (`weeklyReportOverride`) missing a booking the person signed and that is still on the sheet is stale (`signedTimesheetBookingChanges` → `addedBookingIds`; unexported: the line manager counter-signs again, the snapshot rebuilt; exported: a revision is due). Root cause on web: the period page's counter-sign and Export built the snapshot without the person's same-email users ids (`userIdsSharingEmail`) while the screen used them, so the invoice and the timesheet PDF lost bookings filed under a same-email document — all of them on the owner's 1–15 Nov sheet (invoice £195, price work only), Mon 16 Nov on the exported 16–30 Nov sheet. Web `applyWeeklyReportOverride` now works the ids out from the roster when not given.
- New `timesheetClaimLatestSheets`; `timesheetClaimRows` reads each pay run's latest version only (a revision listed every entry a second time in Users → a person → Price work / Expenses).
- Web only (no rule change): invoice and timesheet PDF details wrap instead of "…"; price work / expense rows read their title (and description), not "0h · rate not set"; Generate invoice prints the figures the screen shows (`draftForFigures`); Export finishes once the sheets are stamped (PDFs, backups and the email go on in the background, a few sheets prepared at once); the Daily Overview move between labour and manager schedule shows the signed-timesheet delete notice (§2) like Delete and Replace.

## iOS work for 1.57.0

1. **Sync only for the two rule changes.** `signedTimesheetBookingChanges` (a signed snapshot that lacks a booking the person signed and that is still on the sheet is stale) and `timesheetClaimRows` (latest version of each pay run only) are pure rulebook functions; iOS picks them up through `CanonicalBusinessEngine` once synced. Check that every iOS caller already passes the live lines with `scheduleOptionPlace` (Office / WFH / Site survey / custom places), as web does, so such a booking never reads as missing from a repaired snapshot.
2. **Snapshot builder inputs — checked, no change needed.** Web's bug was building `weeklyReportOverride` without the person's same-email users ids. iOS `TimesheetWeeklyReportOverrideBuilder.applyIfFullyApproved` is called with `relatedUsers: userStore.organizationUsers` in `InvoicingView.swift` (around lines 4183, 5242 and 6765) and in `WeeklyReportTimesheetFeed.swift`. Confirm that any new caller passes it too: the default `relatedUsers: []` reproduces the web bug.
3. **Invoice / timesheet PDF wording (owner, 17 Nov).** Web no longer prints "· 0h · rate not set" on a price work or expense row. Those rows now read the title, plus the description when there is one. If iOS `InvoicePDFGenerationSupport` prints the same suffix for extras, change it to match.
4. **PDF line details (owner, 17 Nov).** Web wraps a line's details onto as many lines as needed instead of cutting them with "…". Example: "0.29 days × £225.00/day = £66.18". Check the iOS invoice and timesheet PDFs for the same truncation.
5. **Export speed.** Web now finishes Export once the sheets are stamped and sends the PDFs and the email in the background. iOS Export is its own code; compare if it also waits on the email.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

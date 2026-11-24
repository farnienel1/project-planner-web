# iOS follow-on — rulebook 1.75.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.76.0 → 1.75.0
Packed hash: afd3f5308d8a18e13d2eaf5bc705b4021030f946824e26d633ecd3726fec7f00
Rulebook sha256: cda126e811bb5a9fdb0d5d8c2a83fb6eb8624160501ad7b8e24351c25b9312be
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
Exports added: TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, TIMESHEET_REVIEW_BOOKING_NOT_RECORDED_MESSAGE, TIMESHEET_REVIEW_BOOKING_UPDATED_MESSAGE, TIMESHEET_SIGNED_NOTICE_TITLE, TIMESHEET_SIGNED_UPDATED_NOTICE_MESSAGE, TIMESHEET_SIGNED_UPDATED_NOTICE_TITLE, timesheetLineDisplayOrder, timesheetLineIsEmptyStandardPart, timesheetLineShownDeclined, timesheetReviewBookingAfterEdit, timesheetReviewBookingDocument, timesheetReviewerBookingEditKey, timesheetReviewerBookingEditRecord, timesheetSheetChangedByReviewer, timesheetSignedNoticeText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/operativeQualifications.ts, lib/canonical/reportPay.ts, lib/canonical/staffAccess.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetEntryReviews.ts, lib/canonical/timesheetLineDisplay.ts, lib/canonical/timesheetReviewBookingWrites.ts
Done when:
- [ ] Packed hash in iOS equals afd3f5308d8a18e13d2eaf5bc705b4021030f946824e26d633ecd3726fec7f00
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 cda126e811bb5a9fdb0d5d8c2a83fb6eb8624160501ad7b8e24351c25b9312be)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.75.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.75.0

- **Qualifications with no expiry date of their own** (§5, owner 23 Nov, C12): new `qualificationsMissingOwnExpiry` (types `QualificationLibraryEntry`, `QualificationMissingOwnExpiryOperativeRow`, `QualificationMissingOwnExpiryRow`) in `lib/canonical/operativeQualifications.ts`. People who hold a qualification whose library entry has an end date (a stored `hasEndDate` decides, else `endDate`) but whose own `qualificationExpiryDates` has none (`qualificationExpiryDate`, on their active rows — all rows for a fully inactive person — as the warnings and reminders read them); named by their live users document; anonymised profiles and blank-named qualifications skipped — they get no expiry warning or reminder. Web Settings → Data health lists them (admins, read only), each linked to the person's qualifications editor. Nothing stored changes; warnings and reminders are unchanged. iOS has no Data health screen; no iOS change needed (C13, organisation-zone reminders, is iOS-only).

## New rulebook sections

- 1.75.0 — 2026-11-23
- 1.74.0 — 2026-11-23
- 1.73.2 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

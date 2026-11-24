# iOS follow-on — rulebook 1.89.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.84.0 → 1.89.0
Packed hash: 4411364e7c2dbb58b148b2887cfee2ea30a7570ff86ead5bd0e9892f05929ef3
Rulebook sha256: 35ca0960a6aed490485d6fd17ae50c4f03fdf0e941e5e84f6542e5b9d5b1433e
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/timesheetReviewBookingWrites.ts
Done when:
- [ ] Packed hash in iOS equals 4411364e7c2dbb58b148b2887cfee2ea30a7570ff86ead5bd0e9892f05929ef3
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 35ca0960a6aed490485d6fd17ae50c4f03fdf0e941e5e84f6542e5b9d5b1433e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.89.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.89.0

- **Reviewer ⚙ / ✕ on web wrote to the wrong booking id** (owner report 24 Nov, testing a REV 1 sheet in Awaiting sign-off; web fix, no rule change): web's timesheet collector keeps a live line's `bookingId` as the line prefix plus the id (`op-{id}`, `mgr-{id}`, as the 1.47.0 `signedTimesheetLineBookingKey` already reads it), and the review page used that value as the booking's document id. ⚙ and ✕ on an overtime line read `bookings/op-{id}`, a document that never exists, and showed `EDIT_OF_MISSING_DOCUMENT_MESSAGE` ("This was deleted on another device."); ✕ on a standard line tried to delete it and was refused; nothing was struck through and the total did not move. Web `timesheetLineBooking` (`lib/timesheets/payrollLineBookingLookup.ts`) now gives the stored booking id. Every sheet was affected from 1.72.0, not only revisions. The §16 security rules already allow the reviewer's booking write and its `reviewerBookingEdits` record on an unexported revision (emulator test added) and still refuse them once exported.
- **Wording** (owner 24 Nov): `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE` reads "… so scheduling, daily Overview and the weekly report show the new hours. …" ("Daily" → "daily").

## New rulebook sections

- 1.89.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

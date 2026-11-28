# iOS follow-on — rulebook 1.96.0

Generated 2026-11-28 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.95.0 → 1.96.0
Packed hash: 3d80628e8f19537967f2c76f8803fb18fc9e2acc7dffe0b51c78d4851fea9cdc
Rulebook sha256: ad45f7368d2ad19db10ede2ed380eb56988298dee3501d7ddfc9b7a2998c357f
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 713114761ecf204c48aba9480e004c0e725c00286dc2c9818f2574d36c98cf92
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: HEALTH_SAFETY_SIGNED_OFFLINE_LABEL, TIMESHEET_DOCUMENT_NUMBER_LABEL, TIMESHEET_DOCUMENT_TITLE, TIMESHEET_DOCUMENT_TOTAL_LABEL, TIMESHEET_DOWNLOAD_LABEL, TIMESHEET_GENERATED_TITLE, TIMESHEET_GENERATE_LABEL, TIMESHEET_REVIEW_DELETE_NOT_JOB_MANAGER_NOTE, TIMESHEET_SHARE_LABEL, variationIssuedNumbers
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/offlinePolicy.ts, lib/canonical/permissionLevels.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetClarity.ts, lib/canonical/timesheetHalfSigned.ts, lib/canonical/timesheetLateExtras.ts, lib/canonical/timesheetReviewBookingWrites.ts, lib/canonical/variationNumbers.ts
Done when:
- [ ] Packed hash in iOS equals 3d80628e8f19537967f2c76f8803fb18fc9e2acc7dffe0b51c78d4851fea9cdc
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ad45f7368d2ad19db10ede2ed380eb56988298dee3501d7ddfc9b7a2998c357f)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.96.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.96.0

- **The person's timesheet document is called a timesheet** (§8, owner 26 Nov, CIS U-turn; wording only): `TIMESHEET_NEXT_STEP_INVOICE_TEXT`, `TIMESHEET_GENERATE_INVOICE_PROMPT`, `TIMESHEET_SIGNED_NOTICE_INVOICE_NEXT` say "generate your timesheet"; new `TIMESHEET_GENERATE_LABEL`, `TIMESHEET_GENERATED_TITLE`, `TIMESHEET_DOWNLOAD_LABEL`, `TIMESHEET_SHARE_LABEL`, `TIMESHEET_DOCUMENT_TITLE`, `TIMESHEET_DOCUMENT_TOTAL_LABEL`, `TIMESHEET_DOCUMENT_NUMBER_LABEL`; the Timesheet self-sign help, `TIMESHEETS_HALF_SIGNED_HELP` and `TIMESHEET_SIGNED_ENTRIES_CHANGED_PERSON_MESSAGE` drop "invoice". Web: button, done dialog, PDF / HTML heading, file name `Timesheet-….pdf`. Numbers, stored fields and amounts unchanged.
- **Late extras alone** (§8, timesheet flow review): web no longer offers the signed-line review and sign-off while only late extras wait (as iOS `lateExtrasOnly`).
- **✕ confirm note** (§8): `timesheetReviewDeleteBookingWarning` takes `viewerCanRebook` → `rebookNote` (`TIMESHEET_REVIEW_DELETE_NOT_JOB_MANAGER_NOTE`).
- **VO numbers never reused after a renumber** (§22, owner 26 Nov): `nextVariationNumber` and `variationNumberTaken` count every `numberHistory` entry (`variationIssuedNumbers`, `VariationIssuedNumberRow`); the pre-filled, editable new-variation number rule.
- **Offline toolbox talk signing** (§2, owner 26 Nov): `OFFLINE_ACTIONS` `health_safety.sign_toolbox_talk` → `allowedOffline`; `HEALTH_SAFETY_SIGNED_OFFLINE_LABEL` ("Signed — will sync when online"). iOS built in iOS #325.

## New rulebook sections

- 1.96.0 — 2026-11-28

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

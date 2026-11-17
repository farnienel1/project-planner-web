# iOS follow-on — rulebook 1.65.1

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.65.1 → 1.65.1
Packed hash: 94e9d12268010e9ceb86537b665686616a64762868b4d1e60db4d04f15a93e7e
Rulebook sha256: 743fd4d62e85253e7fddfda7a649de3a5e23ccef0778e74e2ea12c1f071a4821
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 56f892a29d844eaaebe16028640ebdfb036324d3a229638968c34d10663159f3
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: compareVariationTrackerOrder, variationStaleNumberLocks, variationStatusWriteFields, variationTrackerOrder
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/recordsDocuments.ts, lib/canonical/variationTrackerOrder.test.ts, lib/canonical/variations.ts
Done when:
- [ ] Packed hash in iOS equals 94e9d12268010e9ceb86537b665686616a64762868b4d1e60db4d04f15a93e7e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 743fd4d62e85253e7fddfda7a649de3a5e23ccef0778e74e2ea12c1f071a4821)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.1

- **Report check tightened** (§26, review of #391 before merge). `overtimeReportIntegrity`: a counted line with no booking fingerprint is a mismatch (`missing_fingerprint`; before, a blank fingerprint skipped the review comparison and the re-pricing, so a forged 10h × 3 line passed); the review must store the line's fingerprint (a blank one is `differs_from_review`); clock hours, multiplier and overtime hours are always priced from the booking — the live one while unchanged, else the booking the reviewed fingerprint describes — never from the report's own figures (`clock_differs`, `hours_differ`; `hours_exceed_clock` removed); a booking listed twice is `duplicate_line` and counted once. `payeClaimReportIntegrity`: an item listed twice is `duplicate_item` and counted once.

## iOS work for 1.65.1

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.
4. **1.65.1** (review of #391): the report check is stricter (a line with no booking fingerprint, a repeated booking or item, and clock hours or a multiplier that are not the booking's are flagged). Still server only: the iPhone already writes `fingerprint` on every overtime report line (`overtimeReportSnapshot`); nothing to change.

## New rulebook sections

- 1.63.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

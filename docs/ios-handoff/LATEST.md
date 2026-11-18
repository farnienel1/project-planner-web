# iOS follow-on — rulebook 1.65.5

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.64.0 → 1.65.5
Packed hash: 4a25d2086dafd317d268705b724490c4535a60b780a738254a7a6e6c0d67acf4
Rulebook sha256: a1588be9587f572ddc5f15a317ebf5f930868b155bb4f576c310f5c965408156
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
Exports added: REPORT_CHECKS_COLLECTION, overtimeReportIntegrity, parseReportCheckDocument, payeClaimReportIntegrity, reportCheckWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/organizationDeletion.ts, lib/canonical/organizationSettings.ts, lib/canonical/reportIntegrity.ts
Done when:
- [ ] Packed hash in iOS equals 4a25d2086dafd317d268705b724490c4535a60b780a738254a7a6e6c0d67acf4
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 a1588be9587f572ddc5f15a317ebf5f930868b155bb4f576c310f5c965408156)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.5)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.5

- **Report check: the person as the apps see them** (§26, fifth review of #391; Cloud Functions only, no rule function changes). The person's ids are `overtimePersonIds` over their users document with its stored `formerUserIds` and `sameEmailUserIds`, every users document of the organisation on their email and the organisation's `operatives` rows, both matched with `emailKey` (trimmed, lower case) — the same set for `not_their_booking` and `not_their_item`. The organisation's Super Admin (`isOrganizationSuperAdmin`) counts as having no line manager (§25 `canEditOwnBookingOvertime`: they change their own overtime directly), so their self-confirmed line is a note. Real reports filed under a same-email account, an `operatives` row whose email differs in case or spaces, or by a Super Admin with a line manager were flagged before.

## iOS work for 1.65.5

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.
4. **1.65.1** (review of #391): the report check is stricter (a line with no booking fingerprint, a repeated booking or item, and clock hours or a multiplier that are not the booking's are flagged). Still server only: the iPhone already writes `fingerprint` on every overtime report line (`overtimeReportSnapshot`); nothing to change.
5. **1.65.2** (re-review of #391): the report check also compares the printed text, day, times and job of each overtime line, each claim item's name, job number, dates and currency, and each line or item against the report's range. Still server only; the iPhone writes reports through `overtimeReportSnapshot` / `payeClaimReportSnapshot`, which already produce the expected values. Nothing to change.
6. **1.65.3** (third review of #391): 0h lines, custom places and claim descriptions / approvers / evidence are checked too. Server only. For a manager site booking at a place that is not a job, iOS leaves the overtime line's job name blank (`OvertimeBookingInput.withJobs` finds no job) and web shows `customLocationName`; the check accepts both. Nothing to change.
7. **1.65.4** (fourth review of #391): the server reads bookings and names through the rulebook readers and also checks the booking's person, self-confirmation with a line manager, and the printed person and company. Server only; nothing to change on iOS.
8. **1.65.5** (fifth review of #391): server only — the check finds the person's ids and Super Admin status as the apps do. Nothing to change on iOS.

## New rulebook sections

- 1.65.5 — 2026-11-17
- 1.65.4 — 2026-11-17
- 1.65.3 — 2026-11-17
- 1.65.2 — 2026-11-17
- 1.65.1 — 2026-11-17
- 1.65.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

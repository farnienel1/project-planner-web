# iOS follow-on — rulebook 1.65.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.1 → 1.65.0
Packed hash: 56371d05b614f1b0e48b4b70b64ce1cdc2b8f992b9a069bd3ea55965600ffef0
Rulebook sha256: 86f2c45d58c02a63d5a6832824f5eaab9408020db2f7400b767c45601426a410
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: REPORT_CHECKS_COLLECTION, overtimeReportIntegrity, parseReportCheckDocument, payeClaimReportIntegrity, reportCheckWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/organizationDeletion.ts, lib/canonical/organizationSettings.ts, lib/canonical/reportIntegrity.ts
Done when:
- [ ] Packed hash in iOS equals 56371d05b614f1b0e48b4b70b64ce1cdc2b8f992b9a069bd3ea55965600ffef0
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 86f2c45d58c02a63d5a6832824f5eaab9408020db2f7400b767c45601426a410)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.0

- **Super Admin of an organisation: no blank fallback** (§20, mass-assignment audit 17 Nov, owner approved). `isOrganizationSuperAdmin` (and so `accountDeletionPath`, `canRestoreOrganization`, the delete-organisation route and the web and iOS `organizationSuperAdmin` passed to the permission rules) counts an `isSuperAdmin` flag only when the viewer's users document names this organisation exactly; a blank `organizationId` on the users document, or a blank organisation id, is no longer a match. The creator is unchanged. Before, a users document with `isSuperAdmin: true` and no `organizationId` read as the Super Admin of every organisation it was asked about (the security rules never allowed it). Who changes: only such legacy or hand-made documents (a flag with no organisation); they now read as the admins they are. Version number note: open PRs claim 1.61–1.64; renumber at merge if needed.
- **Server check of saved reports** (§26, §16, §1; owner decision B, before launch). New `overtimeReportIntegrity`, `payeClaimReportIntegrity`, `reportCheckWriteFields`, `parseReportCheckDocument`, `REPORT_CHECKS_COLLECTION` (`lib/canonical/reportIntegrity.ts`) and the collection `organizations/{orgId}/reportChecks` (`LIVE_COLLECTIONS` "may load on open", `OPERATIONAL_COLLECTION_PATHS`, `CONTRACT_NO_READER`: server-written). Cloud Functions `overtimeReportIntegrityCheck` / `payeClaimReportIntegrityCheck` run on report create and store one check per report; Data health lists the mismatches. Reports are never blocked or changed. Security rules (separate rules release): admins read, nobody writes, out of the catch-all read.

## iOS work for 1.65.0

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.

## New rulebook sections

- 1.65.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

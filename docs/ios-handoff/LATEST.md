# iOS follow-on — rulebook 1.65.4

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.65.3 → 1.65.4
Packed hash: ca6efbca81f2f8b686aebf22f2d889997720dfa24d05f15d0a8ecca0440e3dcf
Rulebook sha256: 9ae92cd7b4689dd468ce74381b38ff52b488439ff1e70af719f670ba7bfa1026
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/reportIntegrity.ts
Done when:
- [ ] Packed hash in iOS equals ca6efbca81f2f8b686aebf22f2d889997720dfa24d05f15d0a8ecca0440e3dcf
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 9ae92cd7b4689dd468ce74381b38ff52b488439ff1e70af719f670ba7bfa1026)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.4)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.4

- **Report check reads like the apps** (§26, §1, fourth review of #391). The Cloud Functions read bookings only through `parseBookingDocument` / `parseManagerSiteBookingDocument` (legacy `projectID`, a missing `locationType`, "7:30 AM" or Timestamp clock times now read as the apps read them, so real reports are no longer flagged), take the job from the parsed `projectId` or, for a manager site booking at a project or small works, its `locationId`, fingerprint manager site bookings without a status, read each line's review `overtimeReviews/{userId}_{bookingId}` exactly, and build names with `parseUserDocument` (first name and surname, else email, as both apps). New inputs (`ReportPersonContext`): `personIds` — a live booking that is not the report person's is `not_their_booking`; `personHasLineManager` — a self-confirmed line is a mismatch when the person has an active line manager (`hasActiveLineManager`); `personName` / `organizationName` — the printed person and company are compared (a blank on either side passes). A decider the server could not read leaves "Declined by" unchecked with a note (`decider_unknown`); the report's own name is never the expected one.

## iOS work for 1.65.4

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.
4. **1.65.1** (review of #391): the report check is stricter (a line with no booking fingerprint, a repeated booking or item, and clock hours or a multiplier that are not the booking's are flagged). Still server only: the iPhone already writes `fingerprint` on every overtime report line (`overtimeReportSnapshot`); nothing to change.
5. **1.65.2** (re-review of #391): the report check also compares the printed text, day, times and job of each overtime line, each claim item's name, job number, dates and currency, and each line or item against the report's range. Still server only; the iPhone writes reports through `overtimeReportSnapshot` / `payeClaimReportSnapshot`, which already produce the expected values. Nothing to change.
6. **1.65.3** (third review of #391): 0h lines, custom places and claim descriptions / approvers / evidence are checked too. Server only. For a manager site booking at a place that is not a job, iOS leaves the overtime line's job name blank (`OvertimeBookingInput.withJobs` finds no job) and web shows `customLocationName`; the check accepts both. Nothing to change.
7. **1.65.4** (fourth review of #391): the server reads bookings and names through the rulebook readers and also checks the booking's person, self-confirmation with a line manager, and the printed person and company. Server only; nothing to change on iOS.

## New rulebook sections

- 1.65.4 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

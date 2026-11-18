# iOS follow-on — rulebook 1.65.3

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.65.2 → 1.65.3
Packed hash: 9a41a77917361a900c9110b72c1ec392559a2404a8e7dd54443c270ebe462702
Rulebook sha256: c2b73a5d0b5a9e3ede055d196985bdeb84fe0bd5129ebd66e44cbc5ddc621418
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
- [ ] Packed hash in iOS equals 9a41a77917361a900c9110b72c1ec392559a2404a8e7dd54443c270ebe462702
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 c2b73a5d0b5a9e3ede055d196985bdeb84fe0bd5129ebd66e44cbc5ddc621418)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.3)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.3

- **Report check, third review of #391** (§26). A manager site booking at a place that is not a job may name that place's `customLocationName` as the line's job name, as the app shows it (a real web report was flagged `job_differs`). A 0h line must print exactly what the snapshot writes (`Declined by {name} · 0h`, `Booking removed — not worked · 0h`), carry a fingerprint (its day, times and job are checked against it), and have the state its review gives: `returnedDeclined` only from a `declined` review, `deleted` only from a `deleted` review with no booking left (`state_differs`); the declined line's `declinedByName` is the decider's roster name when the server can read it. When the booking changed after the report the line is a note (`booking_changed_since`), a mismatch when the person confirmed the line themselves. Claim items also compare their description, approver (price work) and evidence paths with the stored item, and the report's currency with the organisation's (`resolveOrganizationCurrency`).

## iOS work for 1.65.3

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.
4. **1.65.1** (review of #391): the report check is stricter (a line with no booking fingerprint, a repeated booking or item, and clock hours or a multiplier that are not the booking's are flagged). Still server only: the iPhone already writes `fingerprint` on every overtime report line (`overtimeReportSnapshot`); nothing to change.
5. **1.65.2** (re-review of #391): the report check also compares the printed text, day, times and job of each overtime line, each claim item's name, job number, dates and currency, and each line or item against the report's range. Still server only; the iPhone writes reports through `overtimeReportSnapshot` / `payeClaimReportSnapshot`, which already produce the expected values. Nothing to change.
6. **1.65.3** (third review of #391): 0h lines, custom places and claim descriptions / approvers / evidence are checked too. Server only. For a manager site booking at a place that is not a job, iOS leaves the overtime line's job name blank (`OvertimeBookingInput.withJobs` finds no job) and web shows `customLocationName`; the check accepts both. Nothing to change.

## New rulebook sections

- 1.65.3 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

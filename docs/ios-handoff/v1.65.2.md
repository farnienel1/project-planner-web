# iOS follow-on — rulebook 1.65.2

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.65.1 → 1.65.2
Packed hash: f69b5a57ced70afc86623532599ea70020ec1ec60ba5dac592911d3e34f673d6
Rulebook sha256: 328e67ba6d6bf84fbb680d66363dde1dfdfc6005950b0ff910730a2ae7a8a096
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
- [ ] Packed hash in iOS equals f69b5a57ced70afc86623532599ea70020ec1ec60ba5dac592911d3e34f673d6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 328e67ba6d6bf84fbb680d66363dde1dfdfc6005950b0ff910730a2ae7a8a096)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.65.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.65.2

- **Report check covers what the report prints** (§26, re-review of #391 before merge). `overtimeReportIntegrity` also compares each line's printed text with the priced `figures.text` (a 0h line must print 0h: `text_differs`), its day, day label, start and finish with the booking it was priced from (`details_differ`), and, when the server looked up the booking's job, its job number and name (`job_differs`; a booking at a place that is not a job names none). Before, a real 2h × 1.5 line edited to "12h × 2 = 24h", 06:00–22:00, job J-OTHER passed. Every line's day must be inside the report's `rangeStart`–`rangeEnd`, and every claim item's date (expenses) or from–to (price work, overlapping) inside its range, on the report and on the stored item (`outside_range`; a report with no range is flagged), so one record is never claimed in two periods. `payeClaimReportIntegrity` also compares each item's printed name, job number and dates with the stored item (`details_differ`) and its currency with the report's (`currency_differs`). A line the person confirmed themselves is a note (`self_reviewed`), never a mismatch.

## iOS work for 1.65.2

Super Admin of an organisation has no blank fallback, and a server check of saved reports (rulebook 1.65.0, mass-assignment audit 17 Nov, owner approved). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **`isOrganizationSuperAdmin`** (§20): a viewer's `isSuperAdmin` flag now counts only when their home `organizationId` names the open organisation exactly; a blank home organisation (or a blank organisation id) is never a match. The creator is unchanged. iOS callers (`CanonicalBusinessEngine.isOrganizationSuperAdmin` in `Core/Rulebook+PermissionLevels.swift` → `OrganizationSuperAdminCache`, `AppUser.organizationSuperAdmin`; `accountDeletionPath` in `Views/DeleteMyAccountView.swift`) already pass `viewerOrganizationId` / `organizationId`; nothing to change unless an `AppUser` is built with an empty `organizationId` for the signed-in user — then the Super Admin answer is now false (correct: the rules' `callerIsSuperAdminOf` never allowed it). Check `RulebookParityTests` and `Rulebook1280Tests` still pass after the sync.
2. **Report checks** (§26): nothing for iOS to write or show — the Cloud Functions check every new `overtimeReports` / `payeClaimReports` document and admins read the results in web Data health. Do not write `reportChecks` from the app.
3. `minimumIosBuild`: not needed.
4. **1.65.1** (review of #391): the report check is stricter (a line with no booking fingerprint, a repeated booking or item, and clock hours or a multiplier that are not the booking's are flagged). Still server only: the iPhone already writes `fingerprint` on every overtime report line (`overtimeReportSnapshot`); nothing to change.
5. **1.65.2** (re-review of #391): the report check also compares the printed text, day, times and job of each overtime line, each claim item's name, job number, dates and currency, and each line or item against the report's range. Still server only; the iPhone writes reports through `overtimeReportSnapshot` / `payeClaimReportSnapshot`, which already produce the expected values. Nothing to change.

## New rulebook sections

- 1.65.2 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

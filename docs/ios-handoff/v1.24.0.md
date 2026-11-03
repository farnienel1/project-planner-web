# iOS follow-on — rulebook 1.24.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.23.1 → 1.24.0
Packed hash: c18f33c885a2f07341c7754338a3bbdbfb572ec733986cadc695d7ec5a6eb2bd
Rulebook sha256: 2cf10fb5037214663152b64f608610c4cbe7084a36b6efe6ae8d47f694f19d07
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: MATERIAL_REQUEST_FROM_SUFFIX, lineManagerSelectionAfterLevelChange, materialRequestEmailEnvelope, materialRequestEmailSubject
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/lineManagers.ts, lib/canonical/materialOrderAccess.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals c18f33c885a2f07341c7754338a3bbdbfb572ec733986cadc695d7ec5a6eb2bd
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2cf10fb5037214663152b64f608610c4cbe7084a36b6efe6ae8d47f694f19d07)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.24.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.24.0

- Line-manager picks on Add User when the account type changes (§11): `lineManagerSelectionAfterLevelChange` keeps the picks that are still `lineManagerCandidates` and drops the rest; "No line manager" stays only for an admin. Before, web kept every pick and iOS cleared them all. Web Add User and Edit User now call `lineManagerCandidates` directly (the web `lineManagerChoices` wrapper is removed).
- Material quote / order email envelope (§16): `materialRequestEmailEnvelope` / `materialRequestEmailSubject` / `MATERIAL_REQUEST_FROM_SUFFIX` — one subject, From name, Reply-To and CC for the web send route and the email function `material_request`. Subjects are unchanged. `material_request` accepts an optional `jobId` and refuses a job outside the caller's organisation; requests without it are still accepted.
- iOS hand-off: `Project Planner/Core/AddUserPermissionSeeding.swift` `AddUserLineManagerSelection.afterAccountTypeSelection` and `Project Planner/Views/AddUserView.swift` (~337–349, the account-type card) call `lineManagerSelectionAfterLevelChange` with the invite draft as `person` instead of clearing the picks; `MaterialRequestEmailClient.send` may send `jobId` (the job's document id) with `material_request`.

## New rulebook sections

- 1.24.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

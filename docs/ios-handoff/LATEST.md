# iOS follow-on — rulebook 1.73.1

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.73.0 → 1.73.1
Packed hash: 5dad4b2e8544af3eeee77df438f489f76fa10661bcb514680f4a3d736542b610
Rulebook sha256: b4d98b0ad58da768d469aa6da4961d55800e5f04d16225c6ef70cd753e8d5356
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals 5dad4b2e8544af3eeee77df438f489f76fa10661bcb514680f4a3d736542b610
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b4d98b0ad58da768d469aa6da4961d55800e5f04d16225c6ef70cd753e8d5356)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.73.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.73.1

- Wording only (§22, owner decision 23 Nov): the iPhone VO tracker drags open variations like web, with the same `variationRenumberPlan`, pinned rule, order lock, `variationRenumberConflict` check and one-transaction save; "iOS shows the tracker read-only" removed. No function or figure changes.

## New rulebook sections

- 1.73.1 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

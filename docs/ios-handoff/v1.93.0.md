# iOS follow-on — rulebook 1.93.0

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.92.0 → 1.93.0
Packed hash: 40a029b665f90475118f774a5775c5f02da5a22f703802ab67802240f3f99d10
Rulebook sha256: bca55b9cb48521c0b950697b0b7f7ed427d77b5b9737d03eb411c75bf0dd6f51
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
Exports added: DEADLINE_MULTIPLE_FLOORS_GROUP, deadlineFloorGroup
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/workDocumentReaders.ts
Done when:
- [ ] Packed hash in iOS equals 40a029b665f90475118f774a5775c5f02da5a22f703802ab67802240f3f99d10
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 bca55b9cb48521c0b950697b0b7f7ed427d77b5b9737d03eb411c75bf0dd6f51)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.93.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.93.0

- **Multiple floors section** (§1, owner 25 Nov, reverses the 1.92.0 "listed under each floor"): new `deadlineFloorGroup` and `DEADLINE_MULTIPLE_FLOORS_GROUP` — grouping by floor lists a deadline on two or more floors once, under "Multiple floors"; one floor stays under its floor. Storage and search unchanged.

## New rulebook sections

- 1.93.0 — 2026-11-25

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

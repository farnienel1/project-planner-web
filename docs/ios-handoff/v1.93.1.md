# iOS follow-on — rulebook 1.93.1

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.93.0 → 1.93.1
Packed hash: d7273524e036e7aa0019e292463c2c57bb2f87d71cc75b7dfd63baffd67bd546
Rulebook sha256: 824bad252261f69371e10c9fbfc6fc0449baced1d0b54865f40a25d32ebbfcbb
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals d7273524e036e7aa0019e292463c2c57bb2f87d71cc75b7dfd63baffd67bd546
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 824bad252261f69371e10c9fbfc6fc0449baced1d0b54865f40a25d32ebbfcbb)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.93.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.93.1

- **Team calendar colours and day summary** (§9, owner decision 25 Nov, wording): pending leave colours the day (amber) and counts towards the blue "two or more"; weekends grey; tapping a day lists who is off. Display only; no function changes.

## New rulebook sections

- 1.93.1 — 2026-11-25

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

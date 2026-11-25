# iOS follow-on — rulebook 1.92.0

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.91.0 → 1.92.0
Packed hash: 6fcc565bfd30fc55d174182abb636dfbd82fee33aaef93bc2e38cf1c826f73d3
Rulebook sha256: 3db87f7a498fa81e98d68eb6c7fbd15e50bc1b69049cad1d8e9536bba1bf1ec2
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
Exports added: deadlineLocationWriteFields, deadlineOnLocation
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/workDocumentReaders.ts
Done when:
- [ ] Packed hash in iOS equals 6fcc565bfd30fc55d174182abb636dfbd82fee33aaef93bc2e38cf1c826f73d3
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 3db87f7a498fa81e98d68eb6c7fbd15e50bc1b69049cad1d8e9536bba1bf1ec2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.92.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.92.0

- **A deadline on several floors** (§1, owner 25 Nov): new `deadlineLocationWriteFields` and `deadlineOnLocation`; `parseDeadlineItem` returns `locations` (falls back to `[location]`; a stale list after an older build's `location` edit reads as `[location]`). Saves write `locations` and the first floor as `location`. Cross-platform contract: the web deadline sample carries two floors.
- **Ghost operatives may be deadline assignees** (§11, owner 25 Nov; reverses 1.34.0 J2 for deadlines only): never notified (§13); their deadlines follow them after app access through `formerUserIds` / `personIdSet`.

## New rulebook sections

- 1.92.0 — 2026-11-25

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

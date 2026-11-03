# iOS follow-on — rulebook 1.10.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.10.0 → 1.10.1
Packed hash: 5772eff8b2ca86d2854c1cad9c6425dc43ffaac82ab5bb92e89a247c224a50fc
Rulebook sha256: 8e99b1874ec657bb49a3da8cc3e2f8c74a29cb8386eb7fb157a4e0ce998a6eae
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: b02694a57fe948213f6934b89f27a205e0dd6463bd717a82c5d3d992c09a9049
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ENFORCED_READS_ACTIVE
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals 5772eff8b2ca86d2854c1cad9c6425dc43ffaac82ab5bb92e89a247c224a50fc
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 8e99b1874ec657bb49a3da8cc3e2f8c74a29cb8386eb7fb157a4e0ce998a6eae)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.10.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.10.1

- Enforced reads (§17) are off until the backfill has run: `ENFORCED_READS_ACTIVE` = false. With 1.10.0 merged and no backfill yet, web asked restricted managers' jobs by `managerUserIds array-contains`, a field jobs saved before 1.10.0 do not have, so managers without the Projects / Small works toggle saw no jobs. While false, staff read whole job and booking collections as before 1.10.0 and the screens filter with `canSeeJob`. Deploy order: backfills → release with the flag true → rules deploy.

## New rulebook sections

- 1.10.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

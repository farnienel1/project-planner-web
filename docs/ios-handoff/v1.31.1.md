# iOS follow-on — rulebook 1.31.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.0 → 1.31.1
Packed hash: b486a695eb948861da53a36d0435cac2e5605ac6dacb7209684550cfb7cd23e3
Rulebook sha256: 58dcf14523059703b7790b22bdb9bf8e3742fb8a9b68284b2d866420fa562b00
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals b486a695eb948861da53a36d0435cac2e5605ac6dacb7209684550cfb7cd23e3
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 58dcf14523059703b7790b22bdb9bf8e3742fb8a9b68284b2d866420fa562b00)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.1

- firestore.rules slimmed so it compiles reliably; no permission changes. The deploy compile (`firebaserules` `:test`) began returning HTTP 503 as the file grew (180 KB at 1.30.2, 188 KB at 1.31.0). Comment blocks moved to `docs/firestore-rules-notes.md`; unused functions, `allow … : if false` statements (rules only grant, so they never applied) and exact duplicate functions removed; single-use wrappers inlined; repeated reads of one document passed once. 188,025 → 124,728 bytes, 245 → 232 functions. Same results in every rules suite and the same allow / deny with no more evaluated expressions in each measured request.

## New rulebook sections

- 1.31.1 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.12.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.12.0 → 1.12.1
Packed hash: 31b9422d059bf0f93562afa68429a5486a2d81c8baf7f1a4b5b6d406410fd8c2
Rulebook sha256: 9c68f0852d2094f396ebaf8beedbe157f440bf1da7a11ecec633c31856032950
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 43f4b04529bedc38c3827fa084854d1f55d0d4c760c9869c13190a84085298cf
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals 31b9422d059bf0f93562afa68429a5486a2d81c8baf7f1a4b5b6d406410fd8c2
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 9c68f0852d2094f396ebaf8beedbe157f440bf1da7a11ecec633c31856032950)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.12.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.12.1

- Read scoping switched by data (§17, §18): the rules apply the 1.10.0 / 1.11.0 job and booking read scoping only when `platformConfig/app.enforcedReads` is true; until then every member reads them as before 1.10.0. The rules and functions deploy right after this merge; the backfills, the `ENFORCED_READS_ACTIVE` release and then the `enforcedReads` flip come later (Deploy notes, `docs/DEPLOY_1.11.0.md`).
- 1.12.0 and 1.12.1 ship together in one merge (neither deployed before).

## New rulebook sections

- 1.12.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

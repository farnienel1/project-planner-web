# iOS follow-on — rulebook 1.31.2

Generated 2026-11-05 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.1 → 1.31.2
Packed hash: 213bf76250ec7897483dcd87de6e9938135eba0bcdc89533842f5affaa5d8002
Rulebook sha256: f874bdef9d389a2fe98af5b278d8cee339299c5a03fe641a3b4974c4ea072db2
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
- [ ] Packed hash in iOS equals 213bf76250ec7897483dcd87de6e9938135eba0bcdc89533842f5affaa5d8002
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f874bdef9d389a2fe98af5b278d8cee339299c5a03fe641a3b4974c4ea072db2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.2

- Rules type-check fixes for console/CLI publish; no behaviour change. The Firebase console and the deploy compile reject 1.31.1's `firestore.rules` with three static type errors ("Invalid type. Received one of [null]") because a literal `null` was passed to a function that uses the parameter as a map (`rosterRowPrivilegeTyped`, `managers` and `operatives` rows) or as a time / number (`sameInstantValue` through `timesheetSameInstant`). The `null` branch now sits at the call site (`resource == null ? … : …`), so no function receives a literal `null`; `timesheetSame` and `timesheetOwnerLeaves` follow the same pattern. Every allow / deny decision is unchanged.

## New rulebook sections

- 1.31.2 — 2026-11-05

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

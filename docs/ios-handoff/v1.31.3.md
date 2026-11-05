# iOS follow-on — rulebook 1.31.3

Generated 2026-11-05 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.2 → 1.31.3
Packed hash: 0e947e88f66e0a57fe0d872c48e5c0bc47d92df721562c68ccfd5201efda0400
Rulebook sha256: 0b2674347e478136cb6848884df6a4789b7202c9ab8d1195271260e2d9958920
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
- [ ] Packed hash in iOS equals 0e947e88f66e0a57fe0d872c48e5c0bc47d92df721562c68ccfd5201efda0400
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 0b2674347e478136cb6848884df6a4789b7202c9ab8d1195271260e2d9958920)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.3)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.3

- Rules restructured for Google's compile limit; no behaviour change. 1.31.0–1.31.2 could not be published (CLI `firebaserules …:test` 503, console "unknown error"): Google's type checker re-resolves every function body at each call site, and 1.31.2 needed about 15% more of that work than the live 1.30.2. 1.31.3 needs about 17% less than 1.30.2 (static cost 431,665 vs 525,898; in-process compile about 13% faster than 1.30.2 and about 30% faster than 1.31.2): booking create / update / delete are one allow per collection, the manager's job is checked twice instead of three times per booking write, organisation-access helpers read each document path once, and 79 small helpers are written out inside their callers (`docs/firestore-rules-notes.md` "Compile cost"). Rules suites 220/220; no new 1,000-expression refusals (`RULES_STRICT_BUDGET=1`: 47 against 49 on 1.31.2); emulator type check clean. Tools and measurements: `scripts/rules-cost/`, `docs/rules-cost/README.md`.

## New rulebook sections

- 1.31.3 — 2026-11-05

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

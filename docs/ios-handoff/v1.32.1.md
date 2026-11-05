# iOS follow-on — rulebook 1.32.1

Generated 2026-11-05 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.32.0 → 1.32.1
Packed hash: 427d4d314c22ce2a8b3b039cd0a64523fae8b0e824e1d05eb1aa7f25eca669fd
Rulebook sha256: 5df16b5a6ae38eefabbf46b43b704dd6e38f8784ca1e3a428cbb5e6ad7a8c0e1
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
- [ ] Packed hash in iOS equals 427d4d314c22ce2a8b3b039cd0a64523fae8b0e824e1d05eb1aa7f25eca669fd
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5df16b5a6ae38eefabbf46b43b704dd6e38f8784ca1e3a428cbb5e6ad7a8c0e1)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.32.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.32.1

- 1.32.0 (never published) on top of 1.31.3's compile-cost restructure, plus one more cut; no behaviour change from 1.32.0. Admin checks that tested the users-document admin and the members-map admin one after the other now read billing once (`orgAdminEither`; `isOrgAdminOrOwner`, memberships, pay profiles, rate history, settings and the other pairs), and `isOrgAdminViaMembersMap` is gone (`membersMapAdminAnyBilling`). Static compile cost 429,072 (1.30.2 live: 525,898; 1.32.0 as built: 614,251); in-process compile 10–17% faster than 1.30.2. Rules suites 223/223; `RULES_STRICT_BUDGET=1` 43 limit refusals vs 45 on 1.32.0, none new; emulator type check clean.

## New rulebook sections

- 1.32.1 — 2026-11-05
- 1.31.3 — 2026-11-05

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

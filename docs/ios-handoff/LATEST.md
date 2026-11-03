# iOS follow-on — rulebook 1.13.2

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.13.1 → 1.13.2
Packed hash: 76ddcbc1a25a7b077a13fb2b4feb58ec9f596eede663014b9575269c9b46ccfc
Rulebook sha256: e1286d455119753b296af87e61d271c49eaaa7b25872e589e293081298d6e571
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE, accountTypeSyncState
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/permissionLevels.ts
Done when:
- [ ] Packed hash in iOS equals 76ddcbc1a25a7b077a13fb2b4feb58ec9f596eede663014b9575269c9b46ccfc
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e1286d455119753b296af87e61d271c49eaaa7b25872e589e293081298d6e571)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.13.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.13.2

- Brings the deployed 1.12.2 fixes into the 1.13 line (one atomic user type change with the membership, admins read a membership in their organisation, `accountTypeSyncState`, same-email sync within the organisation, My Schedule leave for self-booking screens). No new rule beyond 1.12.2 and 1.13.1; 1.13.0, 1.13.1 and 1.13.2 ship in one merge.

## New rulebook sections

- 1.13.2 — 2026-11-03
- 1.12.2 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

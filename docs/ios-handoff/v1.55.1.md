# iOS follow-on — rulebook 1.55.1

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.55.0 → 1.55.1
Packed hash: 9a6defb486baac2988600ddc924e9dbcc275e04cc79d24816b56c13ebbb8bcd7
Rulebook sha256: d5bbad01b5e26045250185cb8e00b69f0f1c5bd6893fa538fc453c704d8172e7
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5a8a7e4e6f56b91cb18f71e79207782b8840fccf0b63b695826c47e18e59a32e
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals 9a6defb486baac2988600ddc924e9dbcc275e04cc79d24816b56c13ebbb8bcd7
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d5bbad01b5e26045250185cb8e00b69f0f1c5bd6893fa538fc453c704d8172e7)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.55.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.55.1

- **Owner console rules** (§16, owner console PR 1, #348 follow-up): `adminAuditLog` create requires the A4 shape (only the twelve fields, `actorUid` the caller, `phase` requested / completed / failed, a string `requestId`, a non-empty `action`, a timestamp `at`); new `ownerNotes` (platform owner only); `erasedOrganizations` readable by the platform owner (the §20 audit rows; the old `deletedOrganisations` match named a collection nothing writes); the unused `analyticsDaily`, `analyticsMonthly`, `analyticsTotals` and `ownerAlerts` read rules removed. The shape rule binds owner-token writes only; Admin SDK entries (account delete) are unchanged and readers accept them without `phase` / `requestId`. Emulator suite `tests/ownerConsole.rules.test.ts`. No business rule changes.

## New rulebook sections

- 1.55.1 — 2026-11-16

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

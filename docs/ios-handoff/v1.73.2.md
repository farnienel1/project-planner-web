# iOS follow-on — rulebook 1.73.2

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.73.1 → 1.73.2
Packed hash: f11efb0822262e69e32cf8bc3708937abf537f3de662fa3075b9180cf84f6341
Rulebook sha256: 86e183b61c952e77c9039496b7d312cc6a188ec3ecc0932d839ee19a11a4e203
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 926b910948b674b1fa259e8f933ddd15f14bad00b8e0b050ccbd88c723bf64aa
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules
Done when:
- [ ] Packed hash in iOS equals f11efb0822262e69e32cf8bc3708937abf537f3de662fa3075b9180cf84f6341
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 86e183b61c952e77c9039496b7d312cc6a188ec3ecc0932d839ee19a11a4e203)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.73.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.73.2

- **Phase B: operatives read only their own annual leave in the security rules** (§9, §16, §18; owner 23 Nov "do Phase B before launch"; legacy-key report 0 records). `firestore.rules` `holidayBookings` read: with `operativeOwnLeave` on (global, or the organisation listed in `operativeOwnLeaveOrganizationIds`; new `operativeOwnLeaveOn`), a caller whose claims role here is `operative` reads a record only when its `userId` or `operativeId` is one of their ids (`callerOwnsBookingId`) or its `userId` is their sign-in email (without case). Admins, managers, no-flag users (claims role `member`) and an admin with a stray operative-mode flag are unchanged; switch off = as before; writes unchanged. The catch-all read no longer re-opens `holidayBookings`. New emulator suite `tests/leaveOwnRead.rules.test.ts` (the apps' exact `leaveQueryPlan` query, 14 ids within the lookup budget). No rulebook function changes.

## New rulebook sections

- 1.73.2 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

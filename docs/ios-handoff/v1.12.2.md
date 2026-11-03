# iOS follow-on — rulebook 1.12.2

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.12.1 → 1.12.2
Packed hash: 71edbc83add6cdba0a50330cf30df268eeefcd6b88f904b7ffd7172340c9deb5
Rulebook sha256: 5cb9c4f3dbb565da4ea2fbcfb69b62c8785e98a044ec29e372fea7d95e4633d6
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 43f4b04529bedc38c3827fa084854d1f55d0d4c760c9869c13190a84085298cf
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE, accountTypeSyncState
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/permissionLevels.ts
Done when:
- [ ] Packed hash in iOS equals 71edbc83add6cdba0a50330cf30df268eeefcd6b88f904b7ffd7172340c9deb5
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5cb9c4f3dbb565da4ea2fbcfb69b62c8785e98a044ec29e372fea7d95e4633d6)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.12.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.12.2

- Change user type is one atomic batch (§11): users documents, `members.{uid}` and the membership together. Before 1.12.2 web wrote the membership after the batch (a refusal was swallowed), and iOS read the membership first, which only the person could read, so an admin → manager change stopped after `users/{uid}` (iOS: "the organisation membership could not be updated"). Rules: an admin of the organisation reads a membership there (get only; list stays the person's). Super Admin and founder protections (1.12.0 B4) unchanged.
- Web profile save (§11): the same-email name sync queries this organisation's users only (`organizationId` + `email`); the email-only query was refused by the rules, so every admin save of someone else's profile — including a user type change — ended in "Missing or insufficient permissions" after the profile had been written. The sync is best effort.
- Half-applied user type (§11): `accountTypeSyncState`, `ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE` — Manage Users lists them, Edit User repairs on Save. One save at a time; a saved profile returns to the people list.
- My Schedule (§10): web's self-booking My Schedule (admins, timesheet managers) shows the person's own annual leave, matched by `leaveRecordsForAccount` with the roster's same-email ids.

## New rulebook sections

- 1.12.2 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

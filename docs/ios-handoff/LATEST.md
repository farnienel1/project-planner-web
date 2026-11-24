# iOS follow-on — rulebook 1.86.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.83.0 → 1.86.0
Packed hash: ee60ebb071a041cd44164b1ee58a79be457983366c8b4379aa0d0f4be7852505
Rulebook sha256: 6b01a56b2c67f3efd0199e28c49878d352a7979b1b8f4a4e96dd95d7f873d9a3
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: OFFLINE_REPLACE_CHANGED_MESSAGE, OFFLINE_REPLACE_REFUSED_MESSAGE, OFFLINE_REPLACE_REPLAY_DECISIONS, OFFLINE_REPLACE_TARGET_OUTCOMES, offlineReplaceRefusalDecision, offlineReplaceReplayDecision
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingReplace.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/offlinePolicy.ts, lib/canonical/scheduleReplace141.test.ts, lib/canonical/offlineReplace.ts
Done when:
- [ ] Packed hash in iOS equals ee60ebb071a041cd44164b1ee58a79be457983366c8b4379aa0d0f4be7852505
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 6b01a56b2c67f3efd0199e28c49878d352a7979b1b8f4a4e96dd95d7f873d9a3)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.86.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.86.0

- **Offline Replace on iPhone** (§2, §5, owner decision 24 Nov "Replace works offline, is queued, and is applied when signal returns"): `booking.replace` is `allowedOffline` in `OFFLINE_ACTIONS` (was `onlineOnly` from 1.41.0). New `lib/canonical/offlineReplace.ts`: `offlineReplaceReplayDecision` (`apply`, `createOnly`, `alreadyApplied`, `dropLocal`, `refuseChanged`, `refusePermission`, per-target outcomes), `offlineReplaceRefusalDecision` (the `offlineDeleteRefusalDecision` mapping), `OFFLINE_REPLACE_REPLAY_DECISIONS`, `OFFLINE_REPLACE_TARGET_OUTCOMES`, `OFFLINE_REPLACE_CHANGED_MESSAGE`, `OFFLINE_REPLACE_REFUSED_MESSAGE`. A replaced booking changed on another device refuses the whole Replace (nothing written, both bookings as the server has them). Web unchanged (online only). No rules change.

## New rulebook sections

- 1.86.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

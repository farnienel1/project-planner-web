# iOS follow-on — rulebook 1.17.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.16.1 → 1.17.0
Packed hash: 5390bfde93d29da5f8d8171ac3483cdf1004c00dfbbd6ba08e35fd69ac85b0d5
Rulebook sha256: 65926053c23afcee349a7cda70647d73be2a1d3580791923483ad9265b2dd749
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: isPushTokenPlaceholderUserId, weekendBookingNotes
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingSlots.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/pushTokens.ts
Done when:
- [ ] Packed hash in iOS equals 5390bfde93d29da5f8d8171ac3483cdf1004c00dfbbd6ba08e35fd69ac85b0d5
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 65926053c23afcee349a7cda70647d73be2a1d3580791923483ad9265b2dd749)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.17.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.17.0

- Weekend booking note for a selection (§4.3, owner decision): `weekendBookingNotes(policy, dayKeys, timeZone)`. Saturday and Sunday selected with the same rule give one "Saturday/Sunday is paid on the hours you enter: …" line; different rules give the Saturday line then the Sunday line; one weekend day gives that day's `weekendBookingNote` (kept). `policy` may be the policy state so each day uses the rules in effect on it. Each booked day keeps its own `weekendCustomHoursDefault`; a single-pair picker opens with the first Saturday's. iOS: call `weekendBookingNotes` (through `CanonicalBusinessEngine`, passing the policy state) in every weekend booking picker and render each line.
- Working hours by day (§4.3): every screen that prices or labels a day uses `effectivePayrollTimePolicy` for that day; booking pickers and Daily Overview no longer use today's rules for another day. Tests lock a change scheduled to start on a Saturday, the October and March clock changes, schedule-then-schedule (replaces, as written), partial writes and stored Timestamp shapes.
- Push tokens (§13): `pushTokenDedupePlan` no longer keeps a token on an invite placeholder users document (UUID-shaped id, `isPushTokenPlaceholderUserId`) — the owner's dry run would have kept tokens on a placeholder and removed them from three real accounts because the placeholder's `updatedAt` was newer. Placeholders always lose tokens; signed-in accounts compare `pushTokenUpdatedAt` (else `updatedAt` only when none has it); a token only on placeholders is removed everywhere. `pushTokenSingleOwner` never treats a placeholder as the owner (`pushTokenOwnerWrites`). iOS must never write `pushTokens` to any users document other than the signed-in Auth uid's.

## New rulebook sections

- 1.17.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.73.2

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.73.2 → 1.73.2
Packed hash: 18f1b20ceda9e24281188e354333665fb25e5ecc5181b73fe1cab78b211c00ea
Rulebook sha256: e2d27ef95037f40585056d39651ae89a406c423c82e7ba9cf53a4fd6907fb41e
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
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals 18f1b20ceda9e24281188e354333665fb25e5ecc5181b73fe1cab78b211c00ea
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e2d27ef95037f40585056d39651ae89a406c423c82e7ba9cf53a4fd6907fb41e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.73.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.73.2

- **Phase B: operatives read only their own annual leave in the security rules** (§9, §16, §18; owner 23 Nov "do Phase B before launch"; legacy-key report 0 records). `firestore.rules` `holidayBookings` read: with `operativeOwnLeave` on (global, or the organisation listed in `operativeOwnLeaveOrganizationIds`; new `operativeOwnLeaveOn`), a caller whose claims role here is `operative` reads a record only when its `userId` or `operativeId` is one of their ids (`callerOwnsBookingId`) or its `userId` is their sign-in email (without case). Admins, managers, no-flag users (claims role `member`) and an admin with a stray operative-mode flag are unchanged; switch off = as before; writes unchanged. The catch-all read no longer re-opens `holidayBookings`. New emulator suite `tests/leaveOwnRead.rules.test.ts` (the apps' exact `leaveQueryPlan` queries; 10 and 14 `operatives` rows within the lookup budget). **`OWN_LEAVE_IDS_PER_QUERY` 14 → 6** (owner 23 Nov: fix before launch): with 14 ids per query an operative with 8 or more `operatives` rows had their whole own-leave query refused (each row id costs the rule one lookup, 10 per query, 3 the rule's own); `leaveQueryPlan` now emits more, smaller queries, the emails on the first only. Owner answer 23 Nov (a): the sign-in email is matched without letter case.

## iOS work for 1.73.2

1. **Own-leave chunk size 14 → 6 (no Swift logic change).** `OWN_LEAVE_IDS_PER_QUERY` is now 6, so `leaveQueryPlan` returns more, smaller `or` queries (the two email spellings on the first query's `userId` only). iOS `Rulebook+JobAccess.swift` `leaveQueryPlan` and `DataParityMonitor.swift` already read the plan's queries generically — nothing to change there. Update only what assumes 14: `ProjectPlannerTests/OperativeOwnLeaveTests.swift` `testMoreThanFourteenIdsSplitIntoSeveralQueriesWithTheEmailsOnTheFirst` (~141–153: expect `ownLeaveIdsPerQuery == 6`; 16 ids → 3 queries of 6, 6, 4; emails on the first only) and the doc comment on `ownLeaveIdsPerQuery` in `Rulebook+JobAccess.swift` (~254, "(14)").
2. **Release order:** the Phase B rules refuse a 14-id query for an operative with 8 or more `operatives` rows on their email. Ship the build carrying this sync and raise `minimumIosBuild` to it before the `operativeOwnLeave` switch is on for a company with such an operative.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.56.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.55.1 → 1.56.0
Packed hash: 5e5f5feea3a0a674fcaf986ff07078537306a418739b5c7a5a642fb1644e2ee6
Rulebook sha256: a7a65aa4f3a6befe7197bbfd88be4a39352bcff38e0743326391473656429af1
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
Exports added: OPERATIVE_OWN_LEAVE_ORGANIZATION_IDS_FIELD, OPERATIVE_OWN_LEAVE_SWITCH_FIELD, OWN_LEAVE_IDS_PER_QUERY, leaveLegacyKeyFindings, leaveQueryPlan, leaveQueryValues, operativeOwnLeaveEnabled, readsOnlyOwnLeave
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveReadAudit.ts, lib/canonical/platformConfig.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals 5e5f5feea3a0a674fcaf986ff07078537306a418739b5c7a5a642fb1644e2ee6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 a7a65aa4f3a6befe7197bbfd88be4a39352bcff38e0743326391473656429af1)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.56.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.56.0

- **Operatives read only their own annual leave — Phase A** (§9, §16, §17, §18; owner answers 17 Nov: Q1 ok, Q2 operatives see only their own schedule and leave, Q3 a new hidden switch, Q4 fix the data). New `leaveQueryPlan` / `leaveQueryValues` / `OWN_LEAVE_IDS_PER_QUERY`: admins, super admins and managers keep one whole-collection `holidayBookings` query; only the operative level (`readsOnlyOwnLeave`; never a no-flag user, never an admin with a stray operative-mode flag) runs one `or` query — `userId in` their own ids and email, `operativeId in` their own ids — per 14 ids, never the whole collection; empty own ids fall back to the users id and former ids. Only while the switch is on (review of #356: with it off everyone reads the whole collection, so nothing drops out of view before the data is fixed). Web holiday store (own ids worked out at plan time; re-plans the organisation last requested while it is open; follows `platformConfig/app` live; clears its rows on a user change, sign-out or a narrowing; plan kept only after a successful subscribe), `readPlanSync` and the §27 data check use it; `OrgPlanPart` takes a composite `filter`.
- New switch `operativeOwnLeave` / `operativeOwnLeaveOrganizationIds` on `platformConfig/app` (`operativeOwnLeaveEnabled`, `OPERATIVE_OWN_LEAVE_SWITCH_FIELD`, `OPERATIVE_OWN_LEAVE_ORGANIZATION_IDS_FIELD`): turns on the app narrowing now and the Phase B rules later; missing = off. Web `operativeOwnLeaveFor`; Annual leave loads the `operatives` rows so they are planned.
- New `leaveLegacyKeyFindings` and the read-only owner report `scripts/report-leave-legacy-keys.mjs`: an operative's own leave the query would miss (legacy key, letter case, a second users document on their email, the email stored as `operativeId`); members from another company included; a record two operatives claim that none of their queries reaches is one `conflict` (one already reached is not reported); the CSV neutralises formula-looking cells.
- No security rules change in this release (Phase B follows after iOS 1.56 and the `minimumIosBuild` raise).

## iOS work for 1.56.0

Operatives read only their own annual leave — **Phase A** (rulebook §9 "Who reads which leave", §16, §17 "Leave queries", §18; owner answers 17 Nov Q1–Q4; review of #356). **Nothing narrows until the switch `operativeOwnLeave` is on for the organisation**: the same switch turns on the app narrowing (this hand-off) and, later, the Phase B rules. Owner order: legacy-key report and data fixed → `minimumIosBuild` raised to this build → Phase B rules published → switch on per company. An older iPhone's whole-collection leave query would be refused for operatives once Phase B is on, so this build must be out first. Every rule below is a packed function — call it through `CanonicalBusinessEngine`; no Swift copy of the plan.

1. **Plan** (`Core/Rulebook+JobAccess.swift`, beside `bookingQueryPlan`): add `leaveQueryPlan(viewer, { ownIds, email, operativeOwnLeave })` → `{ readsEveryLeave, queries }`, with `operativeOwnLeave` = `operativeOwnLeaveEnabled(platformConfig/app, organizationId)` (unknown / not read yet → false: the whole collection). Same viewer as `bookingQueryPlan`, with `role.isOperativeMode` = `permissionLevelOf(user) == operative` (only the operative level is narrowed: a no-flag user and an admin with a stray operative-mode flag read everything — `readsOnlyOwnLeave`); `ownIds` = the same own ids the booking plan gets (`bookingIdsForAccount` of the signed-in account: users id, `formerUserIds`, the `operatives` rows on their email), worked out when you plan — an empty list falls back to the users id and former ids; `email` = the signed-in account's email. Nil when the script does not answer → keep the current behaviour for staff, and for an operative run **no** leave query (never the whole collection).
2. **Live listener** (`Core/HolidayStore.swift` `startLiveUpdates`, ~171): when `readsEveryLeave` keep today's `listenOrganizationQuery(key: "holidayBookings", query: { $0.collection("holidayBookings") })`. Otherwise one listener per `kind: "own"` query: `collection("holidayBookings").whereFilter(Filter.orFilter([Filter.whereField(anyOf[0].field, in: anyOf[0].values), Filter.whereField(anyOf[1].field, in: anyOf[1].values)]))`, merged by document id (the pattern of the own-bookings plan in `Core/FirebaseBackend+ReadPlans.swift`). The two `in` lists differ — the emails are on `userId` only — so use each part's own `values`. Ids are sent exactly as given — no upper / lower-case variants. Re-plan the organisation you last started (not an older one) when the signed-in user or the `operatives` rows change, and forget the plan and stop the listeners on organisation switch / sign-out.
3. **One-off read** (`FirebaseBackend.swift` `loadHolidayBookings`, ~8863, used by `HolidayStore.loadData` and the screens listed in the plan): run the same queries (`getDocuments(source: .server)`, cache fallback as today) and merge by document id; never the whole collection for an operative.
4. **Data check** (`Core/DataParityMonitor.swift`, `holidayBookings` ~295 / ~336): for an operative count the plan's own queries (`countPlan` over `PlannedReadSource.query` of each `or` query; `dataParitySumCounts`), and heal by re-starting those listeners — not `count()` of `org.collection("holidayBookings")` (it would be refused under Phase B and is the wrong number now).
5. **Who drops out of view** (guardrail 3): an operative no longer receives colleagues' leave; no iPhone screen they can open shows it (they have no Daily Overview, Warnings, Book labour, Team tab or job week grid). Their own records stored only under a legacy key (`user_id`, `uid`, `user.id`), another letter case or a second users document on their email also stop loading — the owner's read-only report (`scripts/report-leave-legacy-keys.mjs`, `leaveLegacyKeyFindings`) lists them to be fixed in the data before Phase B. Admins and managers: no change.
6. **Switch** (`operativeOwnLeaveEnabled`, `OPERATIVE_OWN_LEAVE_SWITCH_FIELD`, `OPERATIVE_OWN_LEAVE_ORGANIZATION_IDS_FIELD`): read it from `platformConfig/app` like `enforcedReads` (on launch, on return to the foreground and whenever the app already re-reads the document) and re-plan the leave listener when it changes for the open organisation. Off → whole collection for everyone. Re-plan only the organisation that is still open; clear the leave rows when the user changes, on sign-out and when the plan narrows from the whole collection to the own query.
7. **Annual leave loads the `operatives` rows** before planning (their ids are part of the own query).
8. **Tests**: with the switch off an operative reads the whole collection; with it on an operative's plan has no whole-collection query; the `or` query's values equal `leaveQueryValues`; an admin / manager keeps the whole collection; a viewer with no uid runs nothing.

## New rulebook sections

- 1.56.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

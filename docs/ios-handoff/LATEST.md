# iOS follow-on — rulebook 1.16.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.15.0 → 1.16.0
Packed hash: 7f1174b2325288a4c7f8abb139d2bc2f29f6d366c95955829e065d85ef2fad41
Rulebook sha256: 58af4a8df45da3806f13cece3f47a0c90a1244b578bede889e4b252bec25e547
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: d655dd7d122e53a1167569216d43cba7598670671310ca84c59ea7e46373b7e6
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ANNUAL_LEAVE_BOOKED_LABEL, ANNUAL_LEAVE_REQUESTED_LABEL, BOOKING_CONFLICTS_HEADING, INBOX_CREATED_AT_SKEW_MS, PUSH_PAYLOAD_KEYS, SCHEDULED_NOTIFICATION_TYPES, addedPushTokens, bookingLeaveConflicts, isScheduledNotificationType, notificationCreatedAtIsServerTime, notificationOrganizationSwitch, notificationRecipientAccountId, pushPayloadFields, pushTokenDedupePlan, pushTokenList, pushTokenOwnerWrites, pushTokensExcludingActor
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/parity-fixture.json, lib/canonical/recordsDocuments.ts, lib/canonical/bookingLeaveConflicts.ts, lib/canonical/pushTokens.ts
Done when:
- [ ] Packed hash in iOS equals 7f1174b2325288a4c7f8abb139d2bc2f29f6d366c95955829e065d85ef2fad41
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 58af4a8df45da3806f13cece3f47a0c90a1244b578bede889e4b252bec25e547)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.16.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.16.0

- Notification centre reliability (§13). A push could reach a phone for a row no inbox lists: the token sat on another users document, or the row was addressed to a non-account id. Tokens now belong to one account (`addedPushTokens`, `pushTokenOwnerWrites`, `pushTokenDedupePlan`, `pushTokensExcludingActor`; Cloud Function `pushTokenSingleOwner`, `scripts/dedupe-push-tokens.mjs`). Recipients resolve to the signed-in account, one per person (`notificationRecipientAccountId`; `excludeActor` and `bookingCreatedRecipients` take a `catalogue`; an id the roster cannot resolve is dropped — the parity fixture case changes). Due-now rows carry server time (`notificationCreateFields` `serverTimestamp`, `notificationCreatedAtIsServerTime`); only `SCHEDULED_NOTIFICATION_TYPES` hide until `createdAt`, others allow `INBOX_CREATED_AT_SKEW_MS`. One push payload (`pushPayloadFields`). Rows in another company: switch on tap when a member (`notificationOrganizationSwitch`, interim).
- Annual leave when booking (§5, §9): `bookingLeaveConflicts`, `ANNUAL_LEAVE_BOOKED_LABEL`, `ANNUAL_LEAVE_REQUESTED_LABEL`, `BOOKING_CONFLICTS_HEADING` — booking flows list leave on the chosen days as purple rows beside the orange double bookings; tick or drop each before saving.

## New rulebook sections

- 1.16.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

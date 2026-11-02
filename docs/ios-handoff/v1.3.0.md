# iOS follow-on — rulebook 1.3.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.2.0 → 1.3.0
Packed hash: 3b30d33dddd58c58eb1f9802041d227c1df9904c65621d289ce2b8d90d6b171c
Rulebook sha256: dc022c1950d04c74e54b75a0776083d5804b00882e3153e32b2adc93daf93c0b
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: LEAVE_SUBMIT_LABEL, LEAVE_SUBMIT_REQUEST_LABEL, NOTIFICATION_CATALOG, TIMESHEET_PENDING_NOTICE_TYPE, TIMESHEET_SIGNED_NOTICE_TYPE, bookingCreatedRecipients, deadlineAssignedRecipients, excludeActor, hasActiveLineManager, holidayDecisionRecipients, holidayRequestRecipients, ideaRecipients, isAdminOutsideOperativeMode, leaveSubmitLabel, lineManagerPeerRecipients, lineManagerRequired, notificationCatalogRow, personIdSet, timesheetNotificationDedupeKey, timesheetSelfSigned, timesheetSignedRecipients, timesheetSubmittedRecipients, toolboxTalkRecipients
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/parity-fixture.json, lib/canonical/personIds.ts
Done when:
- [ ] Packed hash in iOS equals 3b30d33dddd58c58eb1f9802041d227c1df9904c65621d289ce2b8d90d6b171c
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 dc022c1950d04c74e54b75a0776083d5804b00882e3153e32b2adc93daf93c0b)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.3.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.3.0

- Every operative and manager needs an active line manager, whatever the self-book permission or annual leave setting; only admins and super admins outside operative mode may have none (`lineManagerRequired`, `lineManagerRequiredError`, "Set a line manager — this person's timesheets and annual leave need approval.") (§8, §11).
- An admin or super admin with no active line manager is self-approved: their timesheet is self-signed (`timesheetSelfSigned`) and their leave saves approved behind a "Submit" button (`canSelfBookAnnualLeave(user, roster)`, `leaveSubmitLabel`). An admin with a line manager follows normal approval (§8, §9).
- Line managers and approvers are active only and never the person under any of their ids (`lineManagerIds(user, roster)`, `personIdSet`). With no line manager only admins decide — never any manager (`leaveApproverIds`, `canDecideLeave`, rules `hbCanDecide`) (§8, §9, §16).
- One recipient rule per notification type, never the actor (`notificationRecipients.ts`, `excludeActor`); `NOTIFICATION_CATALOG` is the §13 table with known app divergences in its Status column (§13).
- Inbox rows carry `actorUserId` (validated by the rules); the push function never pushes to the actor; the badge counts only the recipient's own unread rows — ownerless rows are not inbox rows (`unreadNotificationBadgeCount`) (§13, §16).
- Timesheet notice de-dupe keys use the organisation-zone day (`timesheetNotificationDedupeKey`). A device push token belongs to the signed-in account only and is removed from every users document on sign-out (§13).

## New rulebook sections

- 1.3.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

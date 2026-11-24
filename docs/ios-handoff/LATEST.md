# iOS follow-on — rulebook 1.79.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.78.0 → 1.79.0
Packed hash: 3c93bd8a0c7b81afcde4c320e739fa10b8b9190b8c5f1246a1c88984a024f8f0
Rulebook sha256: b910abd33b9762af026b883f2298360a5dfba31846d08024ecdfc9dfe2417ea8
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
Exports added: TIMESHEET_REVISION_WAITING_LINE_MANAGER, timesheetRevisionWaitingForLabel
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/payrunSnapshot.test.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/recordsDocuments.ts, lib/canonical/timesheetRevisions.ts
Done when:
- [ ] Packed hash in iOS equals 3c93bd8a0c7b81afcde4c320e739fa10b8b9190b8c5f1246a1c88984a024f8f0
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b910abd33b9762af026b883f2298360a5dfba31846d08024ecdfc9dfe2417ea8)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.79.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.79.0

- **App-icon number = unread inbox rows, always** (§13, owner decision 24 Nov): `NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND` is false. Opening the iPhone app no longer clears the icon; it goes down only when rows are read (owner saw 16, opened the app, 0, force-closed, 16 again). iOS keeps the icon at the unread count once the inbox has loaded.
- **Notification destinations** (§13, owner decision 24 Nov): toolbox talk notices (`toolbox_talk_issued`, `hs_toolbox_reminder`) carry the job id (`NOTIFICATION_RELATED_ID` `job`, was `healthSafetyIssue`) and open that job's Health & safety; material line notices open that job's Materials (new kind `jobMaterials`; `materialOrders` / Wholesalers only without a job id); variation notices open the variation on its job on web too (`/dashboard/variations?open=`). `NotificationDestination` gains `catalogue` (from the row). Web adds `/dashboard/notifications/open` to resolve a job with no catalogue. No new notification field.
- **Payrun Snapshot whose turn** (§7, owner decision 24 Nov): an open revision reads "REV 1 · waiting for <first name>" or "REV 1 · waiting for line manager" (`timesheetRevisionWaitingForLabel`, `TIMESHEET_REVISION_WAITING_LINE_MANAGER`); a Timesheet cell's link carries `documentId` and web opens that stored sheet (`timesheetsTeamHref` `doc`). The weekly report check line keeps "REV 1 waiting for signature".

## New rulebook sections

- 1.79.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

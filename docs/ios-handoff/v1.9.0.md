# iOS follow-on — rulebook 1.9.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.8.0 → 1.9.0
Packed hash: da8b6ce64392a12716fcf324023b6af853d9512dfaa57f8fe8cdb5b81b602dd5
Rulebook sha256: ed4b14380503313d52b91dd0874e63f2ea4b4f5de70a7633dddbc8c1e2c7e300
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: EDIT_OF_MISSING_DOCUMENT_MESSAGE, LIVE_COLLECTIONS, MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP, NOTIFICATION_RELATED_ID, SYNC_WRITE_TRIGGERS, USER_ANNUAL_LEAVE_FIGURE_FIELDS, VARIATION_TRACKER_LOCK_FIELDS, VARIATION_TRADES_DOCUMENT_ID, annualLeavePendingOmitFields, editOfMissingDocumentIsRefused, healthSafetySignatureRemovalWrites, invitationCreateFields, invitationUsedWriteFields, leaveDaysInRange, leaveRecordsForAccount, liveCollection, managerSiteBookingUpdateWriteFields, notificationCreateFields, notificationRelatedId, organizationCreateFields, parseVariationLogDocument, parseVariationTrades, recordsToSave, replayRefusedIsFinal, screenMustListen, syncWriteAllowed, taxIdsDocumentFields, timesheetChangedFields, variationLogItemId, variationLogItems, variationLogWriteFields, variationTrackerWriteFields, variationTradesWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingPerson.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/operationsDocuments.ts, lib/canonical/peopleDocuments.ts, lib/canonical/recordsDocuments.ts, lib/canonical/timesheetEntryReviews.ts, lib/canonical/workDocumentReaders.ts, lib/canonical/createDocuments.ts, lib/canonical/liveSources.ts
Done when:
- [ ] Packed hash in iOS equals da8b6ce64392a12716fcf324023b6af853d9512dfaa57f8fe8cdb5b81b602dd5
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ed4b14380503313d52b91dd0874e63f2ea4b4f5de70a7633dddbc8c1e2c7e300)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.9.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.9.0

- Live screens everywhere (§1): `LIVE_COLLECTIONS` lists every shared collection and document and whether a screen showing it listens (`liveCollection`, `screenMustListen`; only picker suggestions, tax ids, the platform toolbox library and tombstones may load on open). Before, iOS loaded projects, clients, operatives, managers, tasks, job types and annual leave only at launch or on pull-to-refresh, and web read most collections behind a 60-second cache and loaded My Schedule leave once per session (against §10), so edits on one platform did not appear on the other. Listeners are scoped to the open organisation and removed on a switch.
- Never re-save what you didn't change (§1): only a user action or its offline replay writes (`SYNC_WRITE_TRIGGERS`, `syncWriteAllowed`); a save writes only the changed records (`recordsToSave`); an edit of a missing document is refused, never re-created (`editOfMissingDocumentIsRefused`, `replayRefusedIsFinal`, `EDIT_OF_MISSING_DOCUMENT_MESSAGE`). iOS re-saved every in-memory project, small work and client on each return to the foreground, writing stale values over web edits and re-creating jobs and clients deleted on web.
- Closed 1.8.0 gaps: a deliberate removal of the last health & safety row (`healthSafetyDocumentWriteFields` `removedIds`) or job type (`jobTypesWriteFields` `removed`) can be saved; removing a recipient or issue removes its signatures (`healthSafetySignatureRemovalWrites`); shared writers for `variationTrackers` (`variationTrackerWriteFields`), `settings/variationTrades` (`parseVariationTrades`, `variationTradesWriteFields`) and settings-log entries without an id (`variationLogItems`, `variationLogItemId`, `parseVariationLogDocument`, `variationLogWriteFields`); `annualLeavePendingOmitFields`; notification `relatedId` per type (`NOTIFICATION_RELATED_ID`, `notificationRelatedId`; iOS minted `UUID()`), and create shapes for inbox rows (`notificationCreateFields`, never rewriting an existing row's read state), invitations (`invitationCreateFields`, `invitationUsedWriteFields`), organisations (`organizationCreateFields`) and tax ids (`taxIdsDocumentFields`).
- Security rules (§16): a staff material status write may carry `updatedBy` / `updatedFrom` (validated); `dismissedWarnings` writes are admins and managers only, as §16 already said. Needs a rules deploy.
- Bug hunt fixes: timesheet saves diff the sheet as loaded (`timesheetChangedFields`; a reviewer save on web wiped an owner's signature, expenses or price work saved on iOS, and the owner path read "manager signed" from a stale copy) (§8); Weekly Report leave days are `leaveDaysInRange` on `leaveRecordDayKeys` (§7); a decision on a leave cancellation notifies the requester (§9); manager site booking edits are partial (`managerSiteBookingUpdateWriteFields`; web merge-set the whole booking and re-stamped `createdAt`) and booking creates carry write metadata (§1); My Schedule and annual leave match every id of the person (`aliasIds`, `leaveRecordsForAccount`) (§9, §10); clash approval writes are one batch (§5). Web also normalised booking dates to London midnight instead of the organisation zone (§1, app fix).

## New rulebook sections

- 1.9.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

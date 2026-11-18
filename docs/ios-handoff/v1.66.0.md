# iOS follow-on — rulebook 1.66.0

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.62.0 → 1.66.0
Packed hash: 65ab4689c0f9e8cb34d49d1546a3bc6cce9944bcfded058ad4ea7a77d65d57d1
Rulebook sha256: b7bec12b7ae0dcd488a287fbd44718c8a38b5933cda8e462570da761119955dc
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 56f892a29d844eaaebe16028640ebdfb036324d3a229638968c34d10663159f3
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DELETED_PEOPLE_COLLECTION, FORMER_PERSON_ANONYMOUS_NAME, FORMER_PERSON_CHIP, FORMER_PERSON_EMAIL_MAX, FORMER_PERSON_FIELDS, FORMER_PERSON_IDS_MAX, FORMER_PERSON_LINK_ACTION, FORMER_PERSON_LINK_ADMIN_ONLY_NOTE, FORMER_PERSON_LINK_SKIP, FORMER_PERSON_LINK_TITLE, FORMER_PERSON_NAME_MAX, FORMER_PERSON_RECORD_SKIPPED_MESSAGE, MANAGER_ROW_NOT_LINKED_LABEL, MATERIAL_CONTACTS_COLLECTION, MATERIAL_REQUEST_SAFE_SENDER_NOTICE, MULTI_PERSON_ALREADY_BOOKED_MESSAGE, MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL, compareVariationTrackerOrder, formerPeopleForEmail, formerPersonDataHealthLabel, formerPersonForId, formerPersonLabel, formerPersonLinkOfferMessage, formerPersonLinkWriteFields, formerPersonPath, formerPersonRecordFields, formerPersonRecordNeeded, isTaskPersonSelected, leaveCoverBookingWindow, lineManagerPeerNoticeKey, materialContactCreateFields, materialContactKey, materialContactPath, materialRequestIsFirstContact, materialRequestSafeSenderNotice, materialSendRecordRecipientEmails, multiPersonBookingBlocks, parseFormerPersonDocument, taskCompletionFields, taskPersonIndex, taskPersonKeys, timesheetSheetHasActivity, toggleTaskPerson, variationStaleNumberLocks, variationStatusWriteFields, variationTrackerOrder
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingPerson.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/formerPeople.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/leaveCoverage.ts, lib/canonical/liveSources.ts, lib/canonical/materialSafeSender.ts, lib/canonical/multiPersonBooking.ts, lib/canonical/notificationRecipients.ts, lib/canonical/operationsDocuments.ts, lib/canonical/organizationSettings.ts, lib/canonical/parity-fixture.json, lib/canonical/recordsDocuments.ts, lib/canonical/taskPeople.ts, lib/canonical/unresolvedBookingPeople.ts, lib/canonical/userDelete.ts, lib/canonical/userTimesheetQueue.scenario.ts, lib/canonical/userTimesheetQueue.test.ts, lib/canonical/userTimesheetQueue.ts, lib/canonical/variationTrackerOrder.test.ts, lib/canonical/variations.ts
Done when:
- [ ] Packed hash in iOS equals 65ab4689c0f9e8cb34d49d1546a3bc6cce9944bcfded058ad4ea7a77d65d57d1
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 b7bec12b7ae0dcd488a287fbd44718c8a38b5933cda8e462570da761119955dc)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.66.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.66.0

- **Awaiting sign-off and Signed off list every timesheet waiting, however old** (§8, owner decision 17 Nov: both apps must agree exactly). New `userTimesheetQueue` / `userTimesheetQueueCounts` (`lib/canonical/userTimesheetQueue.ts`): one row per person per pay run from every stored sheet the viewer's people have (`userTimesheetSubjects`, people folded with `personIdSet`, sheets under any id they go by, without case), PAYE-only runs skipped (`showsMyTimesheets`), one sheet per run (`pickTimesheetRowForPeriod`, the latest revision), bucket `timesheetListBucket` with the sheet's booking change when its run's bookings are loaded, else its late extras alone (`timesheetChangesWithLateExtras(null, timesheetLateExtrasSummary(data))`: a late extra waiting on an old run is Awaiting). New `timesheetSheetHasActivity` (one rule for both apps: signatures, export, entries, late extras, signed snapshot, note). Shared scenario in `parity-fixture.json`.
- Web: User Timesheets → Awaiting / Signed off and the hub tile counts read every stored sheet (`loadTimesheetQueueSheets`, with the upper / lower-case spellings of UUID-shaped ids) instead of the last six pay runs; `loadTimesheetQueueDrafts`, `draftsForMembers`, `timesheetQueueRows`, `currentPeriodTimesheetMembers`, `currentPeriodTimesheetBucketCounts`, `timesheetReviewerHubStats` and `pickTimesheetGroupDraft` are removed. Guardrail 3: older awaiting and signed-not-exported sheets newly appear; nothing disappears. Known limits: a sheet stored with no `userId`, or a mixed-case id stored in another spelling, is not loaded.
- iOS (hand-off): the Awaiting and Signed off lists and the landing counts call `userTimesheetQueue` — one row per person (a person with two records was counted twice), PAYE runs left out, Signed off every age (Email and export one email per pay run); person ids from `personIdSet`, activity from `timesheetSheetHasActivity`.

## New rulebook sections

- 1.66.0 — 2026-11-18
- 1.63.0 — 2026-11-17
- 1.60.1 — 2026-11-17
- 1.60.0 — 2026-11-17
- 1.59.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

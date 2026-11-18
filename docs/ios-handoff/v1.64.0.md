# iOS follow-on — rulebook 1.64.0

Generated 2026-11-18 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.56.0 → 1.64.0
Packed hash: dce801d962cd8c4c75be420e9d2bf8d48f705ef77180fa2e376a79895c24bfda
Rulebook sha256: fe3f89e39e831bd5efe8a7c60e79c1da951da78b223e2f23910f9f2c5aac23c7
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
Exports added: DELETED_PEOPLE_COLLECTION, FORMER_PERSON_ANONYMOUS_NAME, FORMER_PERSON_CHIP, FORMER_PERSON_EMAIL_MAX, FORMER_PERSON_FIELDS, FORMER_PERSON_IDS_MAX, FORMER_PERSON_LINK_ACTION, FORMER_PERSON_LINK_ADMIN_ONLY_NOTE, FORMER_PERSON_LINK_SKIP, FORMER_PERSON_LINK_TITLE, FORMER_PERSON_NAME_MAX, FORMER_PERSON_RECORD_SKIPPED_MESSAGE, MANAGER_ROW_NOT_LINKED_LABEL, MATERIAL_BRAND_LEGACY_BLANK, MATERIAL_BRAND_MISSING_TEXT, MATERIAL_CONTACTS_COLLECTION, MATERIAL_REQUEST_SAFE_SENDER_NOTICE, MULTI_PERSON_ALREADY_BOOKED_MESSAGE, MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL, SNAPSHOT_GAP_FROM_MS, SNAPSHOT_GAP_REPORTS, compareVariationTrackerOrder, formerPeopleForEmail, formerPersonDataHealthLabel, formerPersonForId, formerPersonLabel, formerPersonLinkOfferMessage, formerPersonLinkWriteFields, formerPersonPath, formerPersonRecordFields, formerPersonRecordNeeded, isTaskPersonSelected, leaveCoverBookingWindow, lineManagerPeerNoticeKey, materialBrandStored, materialBrandText, materialContactCreateFields, materialContactKey, materialContactPath, materialRequestIsFirstContact, materialRequestSafeSenderNotice, materialSendRecordRecipientEmails, multiPersonBookingBlocks, parseFormerPersonDocument, signedTimesheetChangeForReports, taskCompletionFields, taskPersonIndex, taskPersonKeys, timesheetClaimLatestSheets, toggleTaskPerson, variationStaleNumberLocks, variationStatusWriteFields, variationTrackerOrder
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/authClaims.test.ts, lib/canonical/bookingPerson.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/formerPeople.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/leaveCoverage.ts, lib/canonical/liveSources.ts, lib/canonical/materialCatalogueCsv.ts, lib/canonical/materialQuantity.ts, lib/canonical/materialSafeSender.ts, lib/canonical/materialWhatsApp.ts, lib/canonical/multiPersonBooking.ts, lib/canonical/notificationRecipients.ts, lib/canonical/operationsDocuments.ts, lib/canonical/organizationSettings.ts, lib/canonical/payeClaims.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/recordsDocuments.ts, lib/canonical/taskPeople.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetLateExtras.ts, lib/canonical/unresolvedBookingPeople.ts, lib/canonical/userDelete.ts, lib/canonical/variationTrackerOrder.test.ts, lib/canonical/variations.ts, lib/canonical/weeklyReportPay.ts
Done when:
- [ ] Packed hash in iOS equals dce801d962cd8c4c75be420e9d2bf8d48f705ef77180fa2e376a79895c24bfda
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 fe3f89e39e831bd5efe8a7c60e79c1da951da78b223e2f23910f9f2c5aac23c7)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.64.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.64.0

- **Allowlist rules** (§16; owner decisions 17 Nov A–D; emulator audit of main d3927045): write paths that were denylists, or used `diff().changedKeys().hasOnly` (blind to added and removed keys), now list the keys they may touch. Operatives manager's update of an operative `affectedKeys()` (removing `passwordSet` then changing the line manager, or adding `ghost` / `invitationId` / `accountConfirmed` / `role`, is refused); a person's own `users` update allowlisted (no `annualLeave*`, `timesheetsEnabled`, `invitationId`, feedback admin overlays; a missing `employmentType` stays missing; `passwordSet` and `accountConfirmed` only ever to true); organisation create in the exact `organizationCreateFields` shape with the creator alone as admin and pending billing (decision A); leave create owned by its `userId`, never an `operativeId` beside another person's `userId`; notification create keys and `actorUserId` required except scheduled types, addressee update `isRead` / `readAt` only; `operatives` / `managers` rows updated by staff only, an operative's own row qualifications only (decision C); task `createdByUserId` the creator and never rewritten, operatives change completion keys only; account confirmation create shape; own email claim needs a tie to the organisation; product feedback idea, vote, comment and session allowlists. Same allow / deny for every write shape web and iOS send today (positive tests). No new rulebook function (rules only); the packed script changes only in its rulebook stamp.
- Rules compile cost kept below main: the identical `users` get and list allows are one `read`, the duplicated invite self-create block is evaluated once, the operatives update's shared tail is written once, and `affected()` names `request.resource.data.diff(resource.data).affectedKeys()`.
- **`reportChecks` rules** (coordinated with web #391, rulebook 1.65.0): admins read, nobody writes, out of the catch-all read; emulator test in `tests/privilegeEscalation.rules.test.ts`. The release order is free: until #391 merges nothing writes the collection.
- **Notifications (review of the suites):** the admin update path is kept, now limited to the same keys as the addressee's (`isRead`, `readAt`, write metadata); a full set of an existing row (no app writes one) is refused. `push_test` names its sender as actor, as both apps already write it.
- **Review of #392 (18 Nov):** `isActive` / `hasNoLineManager` pinned to the exact stored value (a deactivated person could write `null` or `0` and be active again on the next token — on main too); an operative's task save may carry the `taskWriteFields` tidy form of a task stored before 1.8.0; no `employmentType: null` added; the admin self-save pins `isActive` / `hasNoLineManager` too (re-review); task items are tidied only when the stored items have no ids and their number is unchanged; own leave's `operativeId` is not checked (iOS sends it upper-cased; follow-up); `callerOrg` reads the token claims with one nested `get` (compile cost, same decisions); an Operatives manager may remove the legacy `utrNumber` / `vatNumber`. Scheduled-type notices and the own `ppIdeas` copies stay open (follow-ups: the apps write scheduled rows for other people, and the rules cannot walk a map of ideas).

## New rulebook sections

- 1.64.0 — 2026-11-17
- 1.63.0 — 2026-11-17
- 1.60.1 — 2026-11-17
- 1.60.0 — 2026-11-17
- 1.59.0 — 2026-11-17
- 1.58.0 — 2026-11-17
- 1.57.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

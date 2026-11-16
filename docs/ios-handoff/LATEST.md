# iOS follow-on — rulebook 1.55.0

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.55.0 → 1.55.0
Packed hash: aa836b53b126b86c137671a323e77a09d945416580667eda9e4e5c38730b11cf
Rulebook sha256: 28dae121417f33ada9e4c2b2888f61a219d85dbaf3c22a1eb119b4fff68cf9bf
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/notificationRecipients.ts, lib/canonical/timesheetRevisions.ts
Done when:
- [ ] Packed hash in iOS equals aa836b53b126b86c137671a323e77a09d945416580667eda9e4e5c38730b11cf
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 28dae121417f33ada9e4c2b2888f61a219d85dbaf3c22a1eb119b4fff68cf9bf)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.55.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.55.0

- **Timesheet revisions** (§8, §13, §16, owner decisions 16 Nov, refined the same day; new `lib/canonical/timesheetRevisions.ts`): after export a booking change makes a revision due (`timesheetRevisionDue`, derived; before export 1.47.0 is unchanged); the person creates `settings/{original}_rev{N}` with "Review and sign again" (or a reviewer with Create revision), signs the live figures, the line manager counter-signs, Export shows REV N. New: `TIMESHEET_REVISION_*` copy, `TIMESHEET_REVISION_FIELDS`, `TIMESHEET_REVISION_COPIED_FIELDS`, `parseTimesheetRevisionDocId`, `isTimesheetRevisionDocId`, `timesheetRevisionDocId`, `timesheetRevisionLabel`, `timesheetInvoiceNumber`, `timesheetInvoiceNumberForRevision`, `timesheetRevisionDifference`, `timesheetExportedTotal`, `timesheetVersionsForPeriod`, `timesheetLatestVersion`, `timesheetEarlierVersions`, `canCreateTimesheetRevision`, `timesheetRevisionCreateFields`, `timesheetRevisionToSignRecipients`, `timesheetRevisionNoticeKey`, `timesheetRevisionDueNoticeId`.
- Changed: `pickTimesheetRowForPeriod` (rows with `documentId`: one per original; `versions`), `timesheetDocumentSubjectId` and `timesheetEntryId` (a revision id reads as its original), `signedTimesheetBookingWriteReopens` / `timesheetBookingChangeNotice` (`includeExported`; the decision carries `exported`), `PayrunSnapshotSheet.documentId` (`parsePayrunSnapshotSheet`), `WeeklyReportPaySheet.revision` (check line "· REV N").
- New notice type `timesheet_revision_to_sign` (push, toggle timesheetSignOff, opens My Timesheets).
- **Owner answers 16 Nov** (same release): J4 changed — the weekly report and Payrun Snapshot use the latest version and the latest bookings; a revision due or open is not approved (`timesheetRevisionReportState`, `TIMESHEET_REVISION_DUE_REPORT_LABEL`, `timesheetRevisionWaitingLabel`; `pickTimesheetRowForPeriod`'s `versions` option removed). Finding 6 = (a): labour decisions are kept on a revision only for unchanged bookings (`timesheetRevisionLabourReviews`, `TimesheetRevisionLiveLine`, `timesheetRevisionCreateFields` `liveLines`); rules: a revision's `payrollLineReviews` may only drop entries of the previous version's.
- **Review of #344** (before merge): the person never changes a revision's price work, expenses or late extras (rules `tsRevKept`; `timesheetOwnerCanAddExtras` / `canEditTimesheetEntry` / `timesheetOwnerCanAddLateExtras` refuse a revision, `timesheetSheetIsRevision`, `TIMESHEET_REVISION_EXTRAS_MESSAGE`); `timesheetExportedTotal` is null without a signed snapshot and the difference reads `TIMESHEET_REVISION_DIFFERENCE_UNKNOWN`; revisions are priced `decided`; stored nulls copied exactly; a pending late extra on an unsigned revision is with the person (`timesheetLateExtrasSummary`); versions are exported by the rules' test (`resolveTimesheetExportedAtMs`, invoice leftover rule); `timesheetVersionSignedOff` (self-signed with a snapshot) for the Payrun Snapshot; `timesheetInvoiceNumber({ documentId, userId })` from the stored original; `parseTimesheetRevisionDocId` (in `timesheetPeriod.ts`, used by `pickTimesheetRowForPeriod`) refuses `_rev0` / `_rev01`; the notice function completes a version chain cut by its query limit (`sheet` store read).
- **Final review of #344** (before merge): the person's own revision copies `payrollLineReviews` exactly (`timesheetRevisionCreateFields` `writerIsSubject`; rules `tsRevCreate`), so they can never wipe a line manager's declined or edited labour decision; a reviewer's may still drop the decisions of changed bookings. The ordinary write path refuses revision-shaped ids (`_rev0`, `_rev01`, `_rev100`) and revision fields. `timesheetNotificationDedupeKey` takes `revision` (REV N's notices keep their own ids). A reviewer's `timesheet_revision_to_sign` row carries `dayKey`, the pay run's first day in the organisation zone, as §13 says (web wrote only `deepLinkWeekStart`; review of iOS #243). Rules compile cost kept below main (no allow/deny change: single-use helpers folded into their one caller; the owner's review-field check computes the written keys once, `tsOwnerReviewFieldsUnchanged`; the revision guard on a timesheet write is checked after the write rule, so a refused write never pays for it and no write gains a refusal from Firestore's 1,000-expression limit).
- Security rules (on top of 1.54.2): `tsRevCreate` (the previous version exported by the 1.54.1 leftover rule, `tsExportedIn`), `tsRevKept`; the settings match's helpers renamed `timesheet…` → `ts…` and a few equivalent simplifications for the byte budget (`docs/firestore-rules-notes.md` "1.55.0 revisions"); no other allow/deny change.

## iOS work for 1.55.0

Timesheet revisions (REV 1, REV 2, …), rulebook §8 "Timesheet revisions", §13, §16. Design: web `docs/design/timesheet-revisions.md`. Every rule below is a packed function — call it through `CanonicalBusinessEngine`; no second calculator, no Swift copy of the id format.

1. **Loading the latest version** (`Project Planner/FirebaseBackend.swift` `timesheetStateDocumentRef`, `loadTimesheetState`, `listTimesheetStates`, `listenTimesheetState`). After reading the canonical `timesheet_{uid}_{unix}` document, when it is exported (`timesheetExportedFieldSet(exportedAt)`) read `timesheetRevisionDocId(id, 1)`, `2`, … until one is missing; group with `timesheetVersionsForPeriod` and open `timesheetLatestVersion`. Keep the chain for the screen. Listen to and SAVE the latest version's own document id only — never also the canonical id (`saveTimesheetState` must take the document id; the original is frozen and the rules refuse it). `listTimesheetStates`: one row per original — `timesheetLatestVersion` everywhere (My Timesheets, User Timesheets, the weekly report feed `Core/WeeklyReportTimesheetFeed.swift`). `pickTimesheetRowForPeriod` now takes `documentId` on each row: pass it.
2. **Revision due** (`Views/InvoicingView.swift`, My Timesheets rows and the hub entry). With the period's chain and `signedTimesheetBookingChanges` of the latest version (as 1.47), call `timesheetRevisionDue({ chain, change })`. When `due`: the yellow triangle on the My Timesheets entry and on that row, status `TIMESHEET_REVISION_DUE_STATUS`, popup `TIMESHEET_REVISION_DUE_MESSAGE`; on the sheet a button `TIMESHEET_REVIEW_AND_SIGN_REVISION_LABEL` that creates the revision, then opens it (normal sign flow). The reviewer sees `TIMESHEET_REVISION_DUE_REVIEWER_MESSAGE`. Before export nothing changes from 1.47.
3. **Creating a revision** — pass the period's live payroll lines (`liveLines`: id, `bookingFingerprint`, amount, paid hours; only once bookings and pay inputs have loaded) so labour decisions are kept only for unchanged bookings (owner finding 6 = a, `timesheetRevisionLabourReviews`). One transaction: get the latest version (must be exported) and the target id; abort if the target exists; `transaction.setData(timesheetRevisionCreateFields({ previous: { documentId, data }, writerUserId }).fields + ["revisionCreatedAt": FieldValue.serverTimestamp()] + write metadata)`. Nothing else is written. Who: the person (when due) or a reviewer — `canCreateTimesheetRevision({ reviewer: <the timesheetWriterIsReviewer input>, chain, writerIsSubject })`. The rules check the exact shape (every copied field must equal the previous version) — never add, drop or change a field. A reviewer's create writes the inbox row `timesheet_revision_to_sign` (`TIMESHEET_REVISION_NOTICE_TITLE` / `_MESSAGE`, recipients `timesheetRevisionToSignRecipients`, id the synthetic UUID of `timesheetRevisionNoticeKey(revisionId) + "|" + recipient`). Manual "Create revision" (`TIMESHEET_CREATE_REVISION_LABEL`, `TIMESHEET_CREATE_REVISION_HELP`) for admins and line managers on an exported latest version.
4. **Entry ids**: `parseTimesheetEntries(revisionId, …)` already derives the same ids as on the original (`timesheetEntryId` strips `_rev{N}`) — keep passing the version's own document id.
5. **Labels, invoice number, difference** (`Views/InvoicingView.swift` invoice / export PDF): "REV N" (`timesheetRevisionLabel(draft revision)`, from `parseTimesheetRevisionDocId(documentId).revision`) beside the status in My Timesheets, User Timesheets (Awaiting / Signed off / Exported) and the sheet header; Exported lists one row per pay run (the latest exported version) with the earlier versions under it, read only, each with Download PDF (`TIMESHEET_EARLIER_VERSIONS_LABEL`, `TIMESHEET_ORIGINAL_VERSION_LABEL`). Every invoice / export PDF gets "Invoice no." `timesheetInvoiceNumberForRevision(timesheetInvoiceNumber({ subjectId, startDayKey }), revision)` and, on a revision, "Revision: REV 1 · +£44.12 from the previous version" (`timesheetRevisionDifference({ total, previousTotal: timesheetExportedTotal(previous version data), currency })`). Never store the difference.
6. **Weekly report and Payrun Snapshot** (`Views/WeeklyReportView.swift`, `Core/WeeklyReportTimesheetFeed.swift`, `Views/PayrunSnapshotView.swift`), owner decision J4: use the latest version; while a revision is due or open (`timesheetRevisionReportState`) it is not approved — leave it out of the approved feed (live bookings reported, like a 1.47 reopened sheet). Pass `revision` and the full `change` (`changed`, `exported`) on each `weeklyReportPayRows` sheet (check line "Revision due" / "REV 1 waiting for signature" / "· REV N") and on each Payrun Snapshot sheet `bookingsChange`; keep the `documentId` and `signedOff` `parsePayrunSnapshotSheet` returns.
7. **Notifications** (`Models/NotificationModel.swift`, `Views/NotificationsView.swift`): accept `timesheet_revision_to_sign` (push; toggle timesheetSignOff; `notificationDestination` → `timesheetMine` with dayKey) and route it to My Timesheets for that pay run (which opens the latest version).
8. **Release**: `minimumIosBuild` is raised to this build before revisions are used (an older build opens only the frozen original).

9. **Review of #344** (same release):
   - Entries on a revision are frozen for the person: `timesheetOwnerCanAddExtras`, `canEditTimesheetEntry`, `timesheetOwnerCanAddLateExtras` refuse a revision — pass the sheet with `revision` (from the document id) or its stored `revisionOf` (`timesheetSheetIsRevision`); show `TIMESHEET_REVISION_EXTRAS_MESSAGE`. The rules refuse the person's change to `priceWorkEntries`, `expenseEntries`, `lateExtras` on a `_rev` document.
   - Price a revision in `decided` mode for everyone (list rows, the person's sheet, the sign sheet, the invoice).
   - `timesheetExportedTotal` can be null (no signed snapshot): show `TIMESHEET_REVISION_DIFFERENCE_UNKNOWN` on screen and on the invoice instead of a figure.
   - Copy stored nulls exactly when creating a revision (`timesheetRevisionCreateFields` now keeps them) — never drop or default a copied field.
   - Invoice number: `timesheetInvoiceNumber({ documentId: <the original's stored id>, userId: <its stored userId> })` — never the signed-in or current users id, never a recomputed id; for a revision pass its `revisionOf` / the chain's original.
   - "Exported" for revisions is `resolveTimesheetExportedAtMs(data) != null` (invoice leftover rule), via `timesheetVersionsForPeriod`.
   - `parseTimesheetRevisionDocId` refuses `_rev0` / `_rev01` (treat such an id as no version).
10. **Final review of #344** (same release):
   - **The person's own revision copies every labour decision** (`timesheetRevisionCreateFields({ …, writerIsSubject: true })` when the writer is the sheet's person; a reviewer's create keeps passing `liveLines` and no `writerIsSubject`). The rules refuse a person's revision whose `payrollLineReviews` is not exactly the previous version's.
   - **Notice ids for a revision**: pass the sheet's revision number to `timesheetNotificationDedupeKey({ …, revision })` for `timesheet_pending_manager_signoff` and `timesheet_signed_by_manager` (from `parseTimesheetRevisionDocId(documentId).revision`; 0 or missing for the original, whose key is unchanged). Without it REV N's notices reuse the original's ids and are dropped as duplicates (`Project Planner/Core/NotificationService.swift` and `Core/Rulebook+NotificationRecipients.swift`, which build the key).
   - Never write a revision-shaped id (`_rev0`, `_rev01`, `_rev100`) or a revision field (`revisionOf`, `revision`, `previousVersionId`, `revisionCreatedBy`, `revisionCreatedAt`) through the ordinary timesheet save: the rules refuse it.
   - **`timesheet_revision_to_sign` carries `dayKey`** (review of iOS #243, L5): when a reviewer's create writes the inbox row, set `dayKey` = the pay run's first day in the organisation zone (the sheet's `weekStartKey`, else `dayKeyInOrganizationZone` of its start) beside `deepLinkUserId` and `deepLinkWeekStart`, as rulebook §13 says and the booking-notice Cloud Function already does; web does this from 1.55.0 (`timesheetRevisionToSignLinkFields`). The inbox opens My Timesheets on that pay run from `dayKey`.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.55.0

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.54.0 → 1.55.0
Packed hash: 9a9c0fb94d6b910a208286aff6d9156d0af3015677093515b0503883db72dd64
Rulebook sha256: 71c25b8f7b38173d0b58672b02bf66daa3f007ef425d51299d90cb1a58e0b4d2
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
Exports added: TIMESHEET_CREATE_REVISION_HELP, TIMESHEET_CREATE_REVISION_LABEL, TIMESHEET_EARLIER_VERSIONS_LABEL, TIMESHEET_ORIGINAL_VERSION_LABEL, TIMESHEET_REVIEW_AND_SIGN_REVISION_LABEL, TIMESHEET_REVISION_COPIED_FIELDS, TIMESHEET_REVISION_DUE_MESSAGE, TIMESHEET_REVISION_DUE_NOTICE_MESSAGE, TIMESHEET_REVISION_DUE_NOTICE_TITLE, TIMESHEET_REVISION_DUE_REVIEWER_MESSAGE, TIMESHEET_REVISION_DUE_STATUS, TIMESHEET_REVISION_FIELDS, TIMESHEET_REVISION_LIMIT_MESSAGE, TIMESHEET_REVISION_MAX, TIMESHEET_REVISION_NOTICE_MESSAGE, TIMESHEET_REVISION_NOTICE_TITLE, TIMESHEET_REVISION_NOTICE_TYPE, TIMESHEET_REVISION_NOT_EXPORTED_MESSAGE, TIMESHEET_REVISION_NOT_REVIEWER_MESSAGE, TIMESHEET_REVISION_OPEN_MESSAGE, TIMESHEET_REVISION_SUFFIX, canCreateTimesheetRevision, isTimesheetRevisionDocId, parseTimesheetRevisionDocId, timesheetEarlierVersions, timesheetExportedTotal, timesheetInvoiceNumber, timesheetInvoiceNumberForRevision, timesheetLatestVersion, timesheetReportVersion, timesheetRevisionCreateFields, timesheetRevisionDifference, timesheetRevisionDocId, timesheetRevisionDue, timesheetRevisionDueNoticeId, timesheetRevisionLabel, timesheetRevisionNoticeKey, timesheetRevisionToSignRecipients, timesheetVersionsForPeriod
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/recordsDocuments.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetBookingNotice.ts, lib/canonical/timesheetPeriod.ts, lib/canonical/timesheetRevisions.ts, lib/canonical/weeklyReportPay.ts, lib/canonical/workDocumentReaders.ts
Done when:
- [ ] Packed hash in iOS equals 9a9c0fb94d6b910a208286aff6d9156d0af3015677093515b0503883db72dd64
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 71c25b8f7b38173d0b58672b02bf66daa3f007ef425d51299d90cb1a58e0b4d2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.55.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.55.0

- **Timesheet revisions** (§8, §13, §16, owner decisions 16 Nov, refined the same day; new `lib/canonical/timesheetRevisions.ts`): after export a booking change makes a revision due (`timesheetRevisionDue`, derived; before export 1.47.0 is unchanged); the person creates `settings/{original}_rev{N}` with "Review and sign again" (or a reviewer with Create revision), signs the live figures, the line manager counter-signs, Export shows REV N. New: `TIMESHEET_REVISION_*` copy, `TIMESHEET_REVISION_FIELDS`, `TIMESHEET_REVISION_COPIED_FIELDS`, `parseTimesheetRevisionDocId`, `isTimesheetRevisionDocId`, `timesheetRevisionDocId`, `timesheetRevisionLabel`, `timesheetInvoiceNumber`, `timesheetInvoiceNumberForRevision`, `timesheetRevisionDifference`, `timesheetExportedTotal`, `timesheetVersionsForPeriod`, `timesheetLatestVersion`, `timesheetReportVersion`, `timesheetEarlierVersions`, `canCreateTimesheetRevision`, `timesheetRevisionCreateFields`, `timesheetRevisionToSignRecipients`, `timesheetRevisionNoticeKey`, `timesheetRevisionDueNoticeId`.
- Changed: `pickTimesheetRowForPeriod` (rows with `documentId`: one per original; `versions`), `timesheetDocumentSubjectId` and `timesheetEntryId` (a revision id reads as its original), `signedTimesheetBookingWriteReopens` / `timesheetBookingChangeNotice` (`includeExported`; the decision carries `exported`), `PayrunSnapshotSheet.documentId` (`parsePayrunSnapshotSheet`), `WeeklyReportPaySheet.revision` (check line "· REV N").
- New notice type `timesheet_revision_to_sign` (push, toggle timesheetSignOff, opens My Timesheets).
- Security rules: `tsRevCreate`, `tsRevKept`; the settings match's helpers renamed `timesheet…` → `ts…` and three comment lines moved to `docs/firestore-rules-notes.md` (byte budget); no other allow/deny change.

## iOS work for 1.55.0

Timesheet revisions (REV 1, REV 2, …), rulebook §8 "Timesheet revisions", §13, §16. Design: web `docs/design/timesheet-revisions.md`. Every rule below is a packed function — call it through `CanonicalBusinessEngine`; no second calculator, no Swift copy of the id format.

1. **Loading the latest version** (`Project Planner/FirebaseBackend.swift` `timesheetStateDocumentRef`, `loadTimesheetState`, `listTimesheetStates`, `listenTimesheetState`). After reading the canonical `timesheet_{uid}_{unix}` document, when it is exported (`timesheetExportedFieldSet(exportedAt)`) read `timesheetRevisionDocId(id, 1)`, `2`, … until one is missing; group with `timesheetVersionsForPeriod` and open `timesheetLatestVersion`. Keep the chain for the screen. Listen to and SAVE the latest version's own document id only — never also the canonical id (`saveTimesheetState` must take the document id; the original is frozen and the rules refuse it). `listTimesheetStates`: one row per original — `timesheetLatestVersion` for My Timesheets / User Timesheets, `timesheetReportVersion` for the weekly report feed (`Core/WeeklyReportTimesheetFeed.swift`). `pickTimesheetRowForPeriod` now takes `documentId` on each row (and `{ versions: 'reports' }`): pass it.
2. **Revision due** (`Views/InvoicingView.swift`, My Timesheets rows and the hub entry). With the period's chain and `signedTimesheetBookingChanges` of the latest version (as 1.47), call `timesheetRevisionDue({ chain, change })`. When `due`: the yellow triangle on the My Timesheets entry and on that row, status `TIMESHEET_REVISION_DUE_STATUS`, popup `TIMESHEET_REVISION_DUE_MESSAGE`; on the sheet a button `TIMESHEET_REVIEW_AND_SIGN_REVISION_LABEL` that creates the revision, then opens it (normal sign flow). The reviewer sees `TIMESHEET_REVISION_DUE_REVIEWER_MESSAGE`. Before export nothing changes from 1.47.
3. **Creating a revision** — one transaction: get the latest version (must be exported) and the target id; abort if the target exists; `transaction.setData(timesheetRevisionCreateFields({ previous: { documentId, data }, writerUserId }).fields + ["revisionCreatedAt": FieldValue.serverTimestamp()] + write metadata)`. Nothing else is written. Who: the person (when due) or a reviewer — `canCreateTimesheetRevision({ reviewer: <the timesheetWriterIsReviewer input>, chain, writerIsSubject })`. The rules check the exact shape (every copied field must equal the previous version) — never add, drop or change a field. A reviewer's create writes the inbox row `timesheet_revision_to_sign` (`TIMESHEET_REVISION_NOTICE_TITLE` / `_MESSAGE`, recipients `timesheetRevisionToSignRecipients`, id the synthetic UUID of `timesheetRevisionNoticeKey(revisionId) + "|" + recipient`). Manual "Create revision" (`TIMESHEET_CREATE_REVISION_LABEL`, `TIMESHEET_CREATE_REVISION_HELP`) for admins and line managers on an exported latest version.
4. **Entry ids**: `parseTimesheetEntries(revisionId, …)` already derives the same ids as on the original (`timesheetEntryId` strips `_rev{N}`) — keep passing the version's own document id.
5. **Labels, invoice number, difference** (`Views/InvoicingView.swift` invoice / export PDF): "REV N" (`timesheetRevisionLabel(draft revision)`, from `parseTimesheetRevisionDocId(documentId).revision`) beside the status in My Timesheets, User Timesheets (Awaiting / Signed off / Exported) and the sheet header; Exported lists one row per pay run (the latest exported version) with the earlier versions under it, read only, each with Download PDF (`TIMESHEET_EARLIER_VERSIONS_LABEL`, `TIMESHEET_ORIGINAL_VERSION_LABEL`). Every invoice / export PDF gets "Invoice no." `timesheetInvoiceNumberForRevision(timesheetInvoiceNumber({ subjectId, startDayKey }), revision)` and, on a revision, "Revision: REV 1 · +£44.12 from the previous version" (`timesheetRevisionDifference({ total, previousTotal: timesheetExportedTotal(previous version data), currency })`). Never store the difference.
6. **Weekly report and Payrun Snapshot** (`Views/WeeklyReportView.swift`, `Core/WeeklyReportTimesheetFeed.swift`, `Views/PayrunSnapshotView.swift`): use `timesheetReportVersion` (an open revision leaves the previous exported version in force); pass `revision` on each `weeklyReportPayRows` sheet (check line "· REV N") and keep the `documentId` `parsePayrunSnapshotSheet` now returns.
7. **Notifications** (`Models/NotificationModel.swift`, `Views/NotificationsView.swift`): accept `timesheet_revision_to_sign` (push; toggle timesheetSignOff; `notificationDestination` → `timesheetMine` with dayKey) and route it to My Timesheets for that pay run (which opens the latest version).
8. **Release**: `minimumIosBuild` is raised to this build before revisions are used (an older build opens only the frozen original).

## New rulebook sections

- 1.55.0 — 2026-11-16

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

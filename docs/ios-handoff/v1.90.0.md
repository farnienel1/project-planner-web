# iOS follow-on — rulebook 1.90.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.90.0 → 1.90.0
Packed hash: 357c9a5c158637bf73640c4d1b09aa9facfe8e45c4192ddf80447af1b109e4be
Rulebook sha256: 6a7461e3a7478b9523263811391838e52120d1d9a6d9ba7fb62cf5b4c337c348
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/timesheetReviewBookingWrites.ts
Done when:
- [ ] Packed hash in iOS equals 357c9a5c158637bf73640c4d1b09aa9facfe8e45c4192ddf80447af1b109e4be
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 6a7461e3a7478b9523263811391838e52120d1d9a6d9ba7fb62cf5b4c337c348)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.90.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.90.0

- **Draft revisions** (§8, §13, §16, owner request 24 Nov, point 4): a reviewer's revision (Make changes / Correct this timesheet on an exported sheet) starts as a draft held with the reviewer — new `lib/canonical/timesheetRevisionDraft.ts`: `TIMESHEET_REVISION_DRAFT_FIELD`, `timesheetRevisionIsDraft`, `timesheetRevisionDraftChanges`, `timesheetRevisionDraftState`, `timesheetRevisionDraftSendWriteFields`, `timesheetRevisionSendLabel`, `timesheetRevisionSendReadyHelp`, `timesheetRevisionCancelConfirmMessage`, `TIMESHEET_REVISION_CANCEL_LABEL`, `TIMESHEET_REVISION_DRAFT_SEND_WAITING_HELP`, `TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE`, `TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE`, `TIMESHEET_REVISION_DRAFT_SENT_MESSAGE`, `TIMESHEET_REVISION_DRAFT_CANCELLED_MESSAGE`. Changed: `timesheetRevisionCreateFields` (`draft`), `timesheetReviewerBookingEditRecord` (records on a draft, `forSignedAtMs` 0, `forRevisionDraft`), `SignedTimesheetSheet` (`revision`, `revisionOf`, `revisionDraft`), `timesheetNextStep` (draft wording), `timesheetCorrectionOption` (`revisionDraft`), `timesheetReportWaiting` (`draft`), `parsePayrunSnapshotSheet` / `PayrunSnapshotSheet` (`revisionDraft`), `weeklyReportPayRows` (a draft waits for the line manager). `firestore.rules`: `revisionDraft` on a reviewer's create only; the person's writes refused while it is stored `true`; only removed by a reviewer; never on an ordinary timesheet (compile cost paid for by binding `tsUid()` once in `tsIsSubject`). Web: Make changes on an exported sheet creates a draft; the reviewer gets a grey → blue "Save changes and send timesheet to …" and a red "Cancel revision"; `timesheet_revision_to_sign` is sent on Send, not on create; the person is never offered Sign on a draft.
- **Timesheet page header** (owner 24 Nov, points 3 and 5; web, display only): band, then one status card (whose turn, errors in red inside it, the changes list when it applies, every notice — booking updates, what the reviewer may change, the REV label and difference, a revision due, overlapping bookings — then this state's buttons and one help line), with Earlier versions in its own section below — replacing the stack of coloured banners; overlapping lines carry a small "Overlaps another booking" chip instead of a coloured tile each. No figure changes.
- **Cancel changes** (§8, owner request 24 Nov): new `lib/canonical/timesheetReviewerUndo.ts` — `timesheetReviewerEditBefore`, `timesheetReviewerSession`, `timesheetReviewerSessionRecords`, `timesheetReviewerCancelChangesOffered`, `timesheetReviewerCancelChangesConfirmMessage`, `timesheetReviewerReviewRecord`, `timesheetReviewerUndoPlan`, `timesheetReviewerRestoredRecords`, `TIMESHEET_REVIEWER_CANCEL_CHANGES_LABEL`, `TIMESHEET_REVIEWER_CANCEL_CHANGES_DONE_MESSAGE`, `TIMESHEET_REVIEWER_UNDO_*_MESSAGE`, `TIMESHEET_REVIEWER_REVIEW_RECORD_PREFIX`; `timesheetReviewerBookingEditRecord` takes `before` / `existing` and stores `forManagerSignedAtMs`; new `timesheetReviewerEditStillAsLeft`, `timesheetReviewerBookingFingerprint`; `TimesheetReviewerBookingEdit` gains `before`, `forManagerSignedAtMs`, `restoredAs`, `restoredFrom`; `signedTimesheetBookingChanges` does not read a booking re-created by an undo as added. Cancel revision on a draft restores the same way before deleting. No rules change (emulator suite `tests/timesheetReviewerUndo.rules.test.ts`: the line manager puts times back; a tombstoned id is never re-created; an admin re-creates under a new id; a job manager who is not the line manager, and a line manager who does not manage the job, cannot).
- **One top card** (owner 24 Nov, after testing): the whose-turn line, "Changed since it was signed", every notice (booking updated, REV and difference, …) and the buttons are one card; Earlier versions is its own section below it.
- **Wording** (owner 24 Nov): "daily overview" in lower case in `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE`, `TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE` and `TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE` (1.87.0 had "daily Overview" / "Daily Overview").

## iOS work for 1.90.0

## iPhone work for 1.90.0 (draft revisions and the timesheet header)

1. **The person's app never offers Sign on a draft revision.** In the timesheet screen (`InvoicingView.swift` and the person's period view), ask `timesheetRevisionDraftState({ sheet, previous, viewerIsReviewer, viewerIsSubject, personName, revisionLabel })` through `CanonicalBusinessEngine`. While `personMaySign` is false, hide "Continue to sign" / "Review and sign again", hide or disable the note to manager, and show `personMessage` (`TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE`) in the status card. `timesheetNextStep` already reads "Pat Lee is making changes to REV 1 — you can sign it once it is sent to you". The security rules refuse the person's write while `revisionDraft` is stored `true`; map that refusal to `TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE`.
2. **Reviewer: create the draft.** Make changes / Correct this timesheet on an exported sheet calls `timesheetRevisionCreateFields({ …, draft: true })` (the person's own "Review and sign again" never passes it). Do **not** write `timesheet_revision_to_sign` at create any more.
3. **Reviewer: two buttons in the status card** while `reviewerActs`: "Save changes and send timesheet to {first name}" (`sendLabel`) — grey/disabled until `canSend`, then the app's blue primary — and a red "Cancel revision" (`cancelLabel`). Help line `help` under them.
   - Send: one transaction re-reads the revision and applies `timesheetRevisionDraftSendWriteFields(stored)` (`revisionDraft` deleted) plus write metadata; then write `timesheet_revision_to_sign` exactly as before (`timesheetRevisionNoticeKey`, `timesheetRevisionToSignRecipients`).
   - Cancel: confirm with `timesheetRevisionCancelConfirmMessage(label, changes.bookingEdits)`, then a transaction that re-reads the revision and deletes it only while `timesheetRevisionIsDraft` is still true.
4. **Booking edits on a draft are recorded.** The reviewer's ⚙ / ✕ writes already call `timesheetReviewerBookingEditRecord`; pass the sheet with `revision` and `revisionDraft` so it returns a record on a draft (`forSignedAtMs: 0`, `forRevisionDraft: true`) and write it in the same batch (as 1.74.0). That record is what turns Send blue. Confirm the line → booking id uses the stored id (`signedTimesheetLineBooking`, op- / mgr- prefix stripped).
5. **Reports.** `parsePayrunSnapshotSheet` now returns `revisionDraft`; pass sheets through it. Weekly report `weeklyReportPayRows` handles drafts itself.
6. **Header layout (point 5).** Under the band: one status card (whose turn, any error in red inside it, this state's buttons, one help line), the "Changed since you signed" card when it applies, then one notes card holding every notice as a row (booking updated, what the reviewer may change, REV label and difference, revision due, overlapping bookings), with Earlier versions at its foot. Overlapping lines show a small amber "Overlaps another booking" chip instead of a coloured note each. Display only — no figure changes.
7. **Wording.** "daily overview" is lower case in `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE`, `TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE` and `TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE` (read them from the rulebook; never a Swift copy).

8. **Cancel changes (owner 24 Nov).** Every reviewer booking write passes `before: timesheetReviewerEditBefore({ data: <stored booking read fresh>, deleted })` and `existing: <the record stored under that key>` to `timesheetReviewerBookingEditRecord` (for ✕, read the booking before deleting it). A price work / expense decision changed by a reviewer while a session is open writes `timesheetReviewerReviewRecord({ sheet: stored, entryId, before: stored review or null, editedBy })` into `reviewerBookingEdits.{key}` in the same update. Show a red "Cancel changes" (`TIMESHEET_REVIEWER_CANCEL_CHANGES_LABEL`) while `timesheetReviewerCancelChangesOffered` (next to Stop making changes); confirm with `timesheetReviewerCancelChangesConfirmMessage(n)`; then read the sheet, each recorded booking and its tombstone fresh and run `timesheetReviewerUndoPlan`: `restore` → one batch (booking update with `set` / `remove` + metadata, and `reviewerBookingEdits.{key}` deleted); `recreate` → one batch (a NEW booking id with `data` + `id`, `createdAt`, metadata; and the two records from `timesheetReviewerRestoredRecords`); permission-denied → `TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE` for that booking; `refuse` → show its `message`; then the reviews (`extraEntryReviews.{id}` set / deleted, record keys deleted) in one update. Web: `lib/timesheets/timesheetReviewerUndoWrite.ts`.
9. **Cancel revision** on a draft runs the same undo first, then deletes the draft.
10. **One top card (owner 24 Nov, after testing).** The whose-turn line, "Changed since it was signed", every notice and the buttons are ONE card; Earlier versions is its own section below.

How a draft looks: the band shows "REV 2"; the status card reads "Your turn: make your changes to REV 2, then send it to Sam" with the grey Send and red Cancel; after the first ⚙ / ✕ the Send button turns blue. For the person: "Pat Lee is making changes to REV 2 — you can sign it once it is sent to you", no Sign button.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

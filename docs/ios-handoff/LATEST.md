# iOS follow-on — rulebook 1.90.2

Generated 2026-11-25 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.90.1 → 1.90.2
Packed hash: 855a7345ee0f31cea35521f15932dbb568cc263eb84005f560be292205337582
Rulebook sha256: ac316a9e73a1d2bb46dea0ae283e8ee2c397f19ef443299157daeb83ce25d68f
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
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/canonical.test.ts, lib/canonical/timesheetBookingChanges.ts
Done when:
- [ ] Packed hash in iOS equals 855a7345ee0f31cea35521f15932dbb568cc263eb84005f560be292205337582
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 ac316a9e73a1d2bb46dea0ae283e8ee2c397f19ef443299157daeb83ce25d68f)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.90.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.90.2

- **Re-check of #457** (§8, same release as 1.90.0): `signedTimesheetBookingChanges` pairs a re-created booking with the removed signed one — and skips it as an addition — only while its live job / place (`signedTimesheetBookingPlace`) is the one it was re-created at, so a re-created booking moved to another job with the same times reads as a change; a ✕ after a ⚙ in one session never re-creates an edit field the ⚙ added that was not stored before the session (e.g. `otMultiplierOverride`), as a restore removes it (`timesheetReviewerBookingEditRecord`).

## iOS work for 1.90.2

## iPhone work for 1.90.2 (draft revisions and the timesheet header)

1. **The person's app never offers Sign on a draft revision.** In the timesheet screen (`InvoicingView.swift` and the person's period view), ask `timesheetRevisionDraftState({ sheet, previous, viewerIsReviewer, viewerIsSubject, personName, revisionLabel })` through `CanonicalBusinessEngine`. While `personMaySign` is false, hide "Continue to sign" / "Review and sign again", hide or disable the note to manager, and show `personMessage` (`TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE`) in the status card. `timesheetNextStep` already reads "Pat Lee is making changes to REV 1 — you can sign it once it is sent to you". The security rules refuse the person's write while `revisionDraft` is stored `true`; map that refusal to `TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE`.
2. **Reviewer: create the draft.** Make changes / Correct this timesheet on an exported sheet calls `timesheetRevisionCreateFields({ …, draft: true })` (the person's own "Review and sign again" never passes it). Do **not** write `timesheet_revision_to_sign` at create any more.
3. **Reviewer: two buttons in the status card** while `reviewerActs`: "Save changes and send timesheet to {first name}" (`sendLabel`) — grey/disabled until `canSend`, then the app's blue primary — and a red "Cancel revision" (`cancelLabel`). Help line `help` under them.
   - Send: one transaction re-reads the revision and applies `timesheetRevisionDraftSendWriteFields(stored)` (`revisionDraft` deleted) plus write metadata; then write `timesheet_revision_to_sign` exactly as before (`timesheetRevisionNoticeKey`, `timesheetRevisionToSignRecipients`).
   - Send is offered (`canSend`) when the draft holds a change **or** the live bookings differ from the exported version it corrects: pass `liveDiffersFromPrevious: signedTimesheetBookingChanges({ sheet: <previous version as stored>, liveLines, liveBookings, personIds, liveLoaded, selfSigned }).changed` (review of #457: bookings changed in scheduling first leave no record on the draft).
   - Cancel: confirm with `timesheetRevisionCancelConfirmMessage(label, changes.bookingEdits, <records with deleted true and no restoredAs>)`, then **first run the Cancel changes undo (item 8)**, then a transaction that re-reads the revision and deletes it only while `timesheetRevisionIsDraft` is still true (item 9). The confirm says the changes are undone and that a removed booking comes back as a new booking (so the exported version then reads "Revision due").
4. **Booking edits on a draft are recorded.** The reviewer's ⚙ / ✕ writes already call `timesheetReviewerBookingEditRecord`; pass the sheet with `revision` and `revisionDraft` so it returns a record on a draft (`forSignedAtMs: 0`, `forRevisionDraft: true`) and write it in the same batch (as 1.74.0). That record is what turns Send blue. Confirm the line → booking id uses the stored id (`signedTimesheetLineBooking`, op- / mgr- prefix stripped).
5. **Reports.** `parsePayrunSnapshotSheet` now returns `revisionDraft`; pass sheets through it. Weekly report `weeklyReportPayRows` handles drafts itself.
6. **Header layout (point 5).** Under the band: one status card (whose turn, any error in red inside it, this state's buttons, one help line), the "Changed since you signed" card when it applies, then one notes card holding every notice as a row (booking updated, what the reviewer may change, REV label and difference, revision due, overlapping bookings), with Earlier versions at its foot. Overlapping lines show a small amber "Overlaps another booking" chip instead of a coloured note each. Display only — no figure changes.
7. **Wording.** "daily overview" is lower case in `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE`, `TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE` and `TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE` (read them from the rulebook; never a Swift copy).

8. **Cancel changes (owner 24 Nov).** Every reviewer booking write passes `before: timesheetReviewerEditBefore({ data: <stored booking read fresh>, deleted })` and `existing: <the record stored under that key>` to `timesheetReviewerBookingEditRecord` (for ✕, read the WHOLE booking before deleting it — a ✕ after a ⚙ in one session lays the ⚙'s first values over it, so the re-create is complete; the plan refuses a re-create without the person or day, `TIMESHEET_REVIEWER_UNDO_INCOMPLETE_MESSAGE`). A price work / expense decision changed by a reviewer writes `timesheetReviewerReviewRecord({ sheet: stored, entryId, before: stored review or null, editedBy, makingChanges: <Make changes open on screen>, after: <the review written> })` into `reviewerBookingEdits.{key}` in the same update — it returns null outside a session and for any late extra (1.54.0), so a late-extra approval after sign-off never offers Cancel changes. Show a red "Cancel changes" (`TIMESHEET_REVIEWER_CANCEL_CHANGES_LABEL`) while `timesheetReviewerCancelChangesOffered` (next to Stop making changes); confirm with `timesheetReviewerCancelChangesConfirmMessage(n)`; then, for each recorded booking, **one Firestore transaction** that reads the sheet, that booking and its tombstone, runs `timesheetReviewerUndoPlan` on them and writes only that booking's action (skip when the record is gone or already has `restoredAs` — two Cancel runs at once never re-create twice — and leave a booking changed since): `restore` → booking update with `set` / `remove` + metadata, and `reviewerBookingEdits.{key}` deleted; `recreate` → a NEW booking id with `data` + `id`, `createdAt`, metadata, and the two records from `timesheetReviewerRestoredRecords`; permission-denied → `TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE` for that booking; `refuse` → show its `message`; then the reviews (`extraEntryReviews.{id}` set / deleted, record keys deleted) in one transaction planned from the sheet read again. After a re-create the sheet reads signed off again (`signedTimesheetBookingChanges` pairs `restoredAs` / `restoredFrom` on the snapshot side too). Show the red Cancel changes only while Make changes is open, or while `timesheetReviewerCancelChangesOffered` is true for the session. Web: `lib/timesheets/timesheetReviewerUndoWrite.ts`.
9. **Cancel revision** on a draft runs the same undo (item 8) **first**, then deletes the draft (item 3). Settled records (`restoredAs` / `restoredFrom`) are not counted as draft changes (`timesheetRevisionDraftChanges`).
10. **One top card (owner 24 Nov, after testing).** The whose-turn line, "Changed since it was signed", every notice and the buttons are ONE card; Earlier versions is its own section below.

How a draft looks: the band shows "REV 2"; the status card reads "Your turn: make your changes to REV 2, then send it to Sam" with the grey Send and red Cancel; after the first ⚙ / ✕ the Send button turns blue. For the person: "Pat Lee is making changes to REV 2 — you can sign it once it is sent to you", no Sign button.

## New rulebook sections

- 1.90.2 — 2026-11-25

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.90.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.87.0 → 1.90.0
Packed hash: e2eb13fd8b42a1299f9eac02eef27d005412ec611e59941f415cb0c81c309c0b
Rulebook sha256: fcb703d0f221afd6c8f257908cc1fa950b38f4318136180ff7748a7b6c6abb93
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
Exports added: TIMESHEET_REVISION_CANCEL_LABEL, TIMESHEET_REVISION_DRAFT_CANCELLED_MESSAGE, TIMESHEET_REVISION_DRAFT_FIELD, TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE, TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE, TIMESHEET_REVISION_DRAFT_SEND_WAITING_HELP, TIMESHEET_REVISION_DRAFT_SENT_MESSAGE, timesheetRevisionCancelConfirmMessage, timesheetRevisionDraftChanges, timesheetRevisionDraftSendWriteFields, timesheetRevisionDraftState, timesheetRevisionIsDraft, timesheetRevisionSendLabel, timesheetRevisionSendReadyHelp
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/timesheetBookingChanges.ts, lib/canonical/timesheetClarity.ts, lib/canonical/timesheetReviewBookingWrites.ts, lib/canonical/timesheetRevisions.ts, lib/canonical/weeklyReportPay.ts, lib/canonical/timesheetRevisionDraft.ts
Done when:
- [ ] Packed hash in iOS equals e2eb13fd8b42a1299f9eac02eef27d005412ec611e59941f415cb0c81c309c0b
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 fcb703d0f221afd6c8f257908cc1fa950b38f4318136180ff7748a7b6c6abb93)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.90.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.90.0

- **Draft revisions** (§8, §13, §16, owner request 24 Nov, point 4): a reviewer's revision (Make changes / Correct this timesheet on an exported sheet) starts as a draft held with the reviewer — new `lib/canonical/timesheetRevisionDraft.ts`: `TIMESHEET_REVISION_DRAFT_FIELD`, `timesheetRevisionIsDraft`, `timesheetRevisionDraftChanges`, `timesheetRevisionDraftState`, `timesheetRevisionDraftSendWriteFields`, `timesheetRevisionSendLabel`, `timesheetRevisionSendReadyHelp`, `timesheetRevisionCancelConfirmMessage`, `TIMESHEET_REVISION_CANCEL_LABEL`, `TIMESHEET_REVISION_DRAFT_SEND_WAITING_HELP`, `TIMESHEET_REVISION_DRAFT_PERSON_MESSAGE`, `TIMESHEET_REVISION_DRAFT_REFUSED_MESSAGE`, `TIMESHEET_REVISION_DRAFT_SENT_MESSAGE`, `TIMESHEET_REVISION_DRAFT_CANCELLED_MESSAGE`. Changed: `timesheetRevisionCreateFields` (`draft`), `timesheetReviewerBookingEditRecord` (records on a draft, `forSignedAtMs` 0, `forRevisionDraft`), `SignedTimesheetSheet` (`revision`, `revisionOf`, `revisionDraft`), `timesheetNextStep` (draft wording), `timesheetCorrectionOption` (`revisionDraft`), `timesheetReportWaiting` (`draft`), `parsePayrunSnapshotSheet` / `PayrunSnapshotSheet` (`revisionDraft`), `weeklyReportPayRows` (a draft waits for the line manager). `firestore.rules`: `revisionDraft` on a reviewer's create only; the person's writes refused while it is stored `true`; only removed by a reviewer; never on an ordinary timesheet (compile cost paid for by binding `tsUid()` once in `tsIsSubject`). Web: Make changes on an exported sheet creates a draft; the reviewer gets a grey → blue "Save changes and send timesheet to …" and a red "Cancel revision"; `timesheet_revision_to_sign` is sent on Send, not on create; the person is never offered Sign on a draft.
- **Timesheet page header** (owner 24 Nov, points 3 and 5; web, display only): band, then one status card (whose turn, errors in red inside it, this state's buttons, one help line), the changes card when it applies, then one notes card (booking updates, what the reviewer may change, the REV label and difference, a revision due, overlapping bookings) with Earlier versions at its foot — replacing the stack of coloured banners; overlapping lines carry a small "Overlaps another booking" chip instead of a coloured tile each. No figure changes.
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

How a draft looks: the band shows "REV 2"; the status card reads "Your turn: make your changes to REV 2, then send it to Sam" with the grey Send and red Cancel; after the first ⚙ / ✕ the Send button turns blue. For the person: "Pat Lee is making changes to REV 2 — you can sign it once it is sent to you", no Sign button.

## New rulebook sections

- 1.90.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

# iOS follow-on — rulebook 1.74.0

Generated 2026-11-23 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.74.0 → 1.74.0
Packed hash: 215ae616e2abf0c72ff43154997e9915ad0b16729629b7deb2a7e1c6b12026f6
Rulebook sha256: cbd428e07f35284a63ea14aceb24e9e2f6833f0eff4b61400a009dc2e62f8609
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
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/staffAccess.ts
Done when:
- [ ] Packed hash in iOS equals 215ae616e2abf0c72ff43154997e9915ad0b16729629b7deb2a7e1c6b12026f6
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 cbd428e07f35284a63ea14aceb24e9e2f6833f0eff4b61400a009dc2e62f8609)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.74.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.74.0

- **The line manager makes as many changes as they like before counter-signing** (§8, §16, owner decision 23 Nov; reverses the 1.72.0 "the 1.47.0 rule then sends the sheet back to the person"). New `timesheetReviewerBookingEditRecord`, `timesheetReviewerBookingEditKey`, `TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD`, type `TimesheetReviewerBookingEdit` (`timesheetBookingChanges.ts`), `timesheetReviewBookingAfterEdit`, `timesheetReviewBookingDocument`, `TIMESHEET_REVIEW_BOOKING_UPDATED_MESSAGE`, `TIMESHEET_REVIEW_BOOKING_NOT_RECORDED_MESSAGE` (`timesheetReviewBookingWrites.ts`). A reviewer's ⚙ / ✕ / overtime trim from the review records `reviewerBookingEdits.{key}` on the sheet in the same batch; `signedTimesheetBookingChanges` and `signedTimesheetBookingWriteReopens` read a booking still exactly as the reviewer left it as no change for the person while that signature is current (no send-back, no triangle, no notice); any later change by anyone else reopens as 1.47.0 (review of #425: a cancel, tombstone or reassignment after the edit, and a move from no job to a job, still reopen). `TIMESHEET_REVIEWER_ONLY_FIELDS` adds `reviewerBookingEdits` (`timesheetOwnerWriteFields` drops it). Copy: `TIMESHEET_REVIEW_EDIT_BOOKING_NOTE`, `TIMESHEET_REVIEW_DELETE_BOOKING_MESSAGE`, `TIMESHEET_REVIEW_REMOVE_OVERTIME_MESSAGE` say the person sees the changes at the counter-signature; `TIMESHEET_REVIEW_BOOKING_SENT_BACK_MESSAGE` kept for older builds. Rules: the person's write never touches `reviewerBookingEdits` (cost offset by an equivalent `tsIsSubject`).
- **Line order and the empty standard line** (§8, owner report 23 Nov): new `timesheetLineDisplayOrder`, `timesheetLineIsEmptyStandardPart`, type `TimesheetLineOrderInput` (`timesheetLineDisplay.ts`). Lines booking by booking (start, finish, id), standard then overtime; the 0h / £0 standard line of a booking with no standard part (weekend every hour at N×, a booking wholly outside the working day) is not shown. Display only; totals and invoice totals unchanged (tests). Web: the review, the person's sheet, the sign screen, the invoice and its PDF.
- **One sign-off per press** (§13, owner report 23 Nov: two "needs sign-off" pushes): web refuses a second sign press while the first is saving (iOS: hand-off). Owner answer 23 Nov: no server-side push hold-back.
- **The person is told when the line manager changed their sheet** (§13, owner answer 23 Nov): new `timesheetSignedNoticeText`, `timesheetSheetChangedByReviewer`, `TIMESHEET_SIGNED_UPDATED_NOTICE_TITLE` / `_MESSAGE`, `TIMESHEET_SIGNED_NOTICE_TITLE`: the counter-signature row (`timesheet_signed_by_manager`, unchanged type, recipients and id) reads "Your timesheet was updated and signed off" / "{signer} changed your timesheet and signed it off…" when the sheet carries a reviewer edit for the current signature.
- **A £0 standard line beside a declined overtime line** (§8, owner answer 23 Nov, choice 6): new `timesheetLineShownDeclined`, `isDeclined` on `timesheetLineDisplayOrder` / `timesheetLineIsEmptyStandardPart`, and `omitEmptyStandardParts` on `timesheetInvoiceRows`; shown struck through on the review and the person's sheet; left off the invoice.

## iOS work for 1.74.0

Raise `minimumIosBuild` to the iOS 1.74 build before web 1.74 deploys: an older iPhone does not read `reviewerBookingEdits`, so after a reviewer's edit on web it shows the person "Review and sign again" and blocks an older-iPhone line manager from counter-signing; and an older iPhone reviewer's edit writes no record (the sheet goes back to the person).

**1. The reviewer's ⚙ / ✕ / overtime trim does not send the sheet back (owner decision 23 Nov).**
- `Project Planner/Views/InvoicingView.swift`
  - the ⚙ save (~7594–7640, the function that calls `CanonicalBusinessEngine.timesheetReviewBookingEditWrites` and then `firebaseBackend.applyTimesheetReviewBookingUpdate`)
  - `confirmReviewRemoval` (~7190: `.delete(plan)` → `firebaseBackend.deleteTimesheetReviewBooking`; `.trim` → `applyTimesheetReviewBookingUpdate`)
  - For each: build the record with `timesheetReviewerBookingEditRecord({ sheet, booking, after, deleted, editedBy })`. `sheet` is the draft's status payload: `operativeSignedAt` as epoch ms, `exportedAt`. `after` is `timesheetReviewBookingAfterEdit(timesheetReviewBookingDocument({ collection, id, data: <the booking read fresh>, timeZone }), { set, remove })`; for a delete, null with `deleted: true`.
  - Then write ONE batch: the booking write (or delete + tombstone) plus `settings/{the sheet document id shown — draft.versionDocumentId}` updated with `FieldPath(["reviewerBookingEdits", key])` = the record plus `editedAt: FieldValue.serverTimestamp()`, plus `updatedAt` / `updatedBy` / `updatedFrom: "ios"`.
  - Afterwards show `TIMESHEET_REVIEW_BOOKING_UPDATED_MESSAGE` (when no record could be made, write the booking alone, as 1.72.0, and show `TIMESHEET_REVIEW_BOOKING_NOT_RECORDED_MESSAGE` only when the person has signed and the sheet is stored and not exported — the sheet really goes back; otherwise the updated message).
  - Keep the record on the local draft at once.
- `Project Planner/Core/FirebaseBackend+TimesheetReviewBooking.swift`
  - `applyTimesheetReviewBookingUpdate` and `deleteTimesheetReviewBooking` take an optional sheet record and add it to their batch.
- The timesheet draft model and its reader (`TimesheetDraftStore` / `TimesheetDraft` in `InvoicingView.swift`)
  - Read `reviewerBookingEdits` as stored (instants as epoch ms) and pass it in `sheet` wherever you call `signedTimesheetBookingChanges` (the review page, My Timesheets, the hub cards and the queue).
  - Never write it from a draft save: the owner path drops it (`TIMESHEET_REVIEWER_ONLY_FIELDS`), and the rules refuse the person's write.
- Copy: the edit / delete / trim notes come from the rulebook (`TIMESHEET_REVIEW_EDIT_BOOKING_NOTE`, `_DELETE_BOOKING_MESSAGE`, `_REMOVE_OVERTIME_MESSAGE`). They now say the person sees the changes when the line manager counter-signs.

**3 (person told). The counter-signature notice.**
- Where iOS writes `timesheet_signed_by_manager` (`NotificationService.notifyTimesheetCounterSigned`), take the title and message from `CanonicalBusinessEngine.timesheetSignedNoticeText(signedByName:, changedByReviewer:)`, with `changedByReviewer = timesheetSheetChangedByReviewer(sheet)` on the sheet as counter-signed (operativeSignedAt + reviewerBookingEdits). Same type, recipients, id and deep link.

**2. Hide the £0 standard line of an all-overtime booking, and 4. order lines booking by booking.**
- Every list of booking lines calls `CanonicalBusinessEngine.timesheetLineDisplayOrder(lines, { effectiveAmount, day })` and shows its result, in the order given. The lists:
  - `managerPayrollLineRow` / the review list
  - the person's period list
  - `SignTimesheetView`'s summary
  - `InvoicePDFBuilder` / the invoice rows
- Pass each line's `dayKey` (organisation zone), `bookingId`, `bookingCollection`, `isOvertimeLine`, `paidHours`, `amount`, `bookingStartTime` / `bookingEndTime` (the booking's own clock times) and `details`.
- Pass `isDeclined` (the line's stored review is declined): with the booking's overtime line declined, its £0 standard line stays and is drawn struck through (`timesheetLineShownDeclined`). The invoice leaves both off: pass `omitEmptyStandardParts: true` to `timesheetInvoiceRows` where iOS builds the invoice rows (`InvoicePDFBuilder` / the invoice row builder) — never drop rows in Swift.
- `effectiveAmount` is the line's amount, or an edited review's revised amount when larger (a line a review would pay is never hidden).
- An all-overtime booking with no standard row (signed snapshot, invoice) sorts by its overtime line's own times: pass `details`.
- The collector's own sort (`Core/TimesheetPayrollCollector.swift` ~369, `sortedItems`) may stay. The display order is the rulebook's.
- Totals still read every line (`timesheetTotals`): do not drop lines before pricing.

**1 (pushes). One sign-off push per signature.**
- `SignTimesheetView` (InvoicingView.swift ~8286): add a submitting flag so the Sign button calls `onApprove` once.
- `markTimesheetSigned` (~4126): return when a signature is being saved, or when `draft.operativeSignedAt != nil && !mustSignAgain`.
- Owner answer 23 Nov: no server-side push hold-back; the press guard is the fix on both apps.
- To tell the owner whether their two pushes were two rows or two tokens, check the Cloud Functions log.

## New rulebook sections

- 1.73.2 — 2026-11-23

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

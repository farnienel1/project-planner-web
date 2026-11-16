# Timesheet revisions (REV 1, REV 2, …) — rulebook 1.55.0

Owner decisions 16 Nov (register: `docs/OWNER_DECISIONS.md`, "16 Nov decisions (for 1.55)"), refined the same day: a
revision is caused by a booking change, never by someone editing a timesheet. Rule text: `docs/RULEBOOK.md` §8
"Timesheet revisions", §13, §16. Code: `lib/canonical/timesheetRevisions.ts`.

## What we found (before the design)

| Area | How it reads a pay run's sheet today | What a second document for the same pay run would do |
|---|---|---|
| `lib/timesheets/timesheetStorage.ts` `loadTimesheetDraft` | Candidate ids (`timesheet_{uid}_{stamp}` in several zones), then `weekStartKey`, then the `userId` history query + `pickTimesheetRowForPeriod` | The candidate ids never name a revision; the history query returns both and `pickTimesheetRowForPeriod` picked the first "with activity" — the frozen original. |
| `saveTimesheetDraft`, `stampTimesheetExport` | Write to the canonical id **and** the loaded id | A revision save would also try the frozen original (refused) or, worse, stamp it. |
| Lists (`listTimesheetStates`, `loadPayPeriodTimesheetDrafts`, `loadTimesheetDrafts`) | One draft per person per period, first wins | Random version per list. |
| Exported history | Keyed `user|weekStart`, last wins | Original and REV 1 overwrite each other. |
| `timesheetListBucket`, hub counts | From the listed draft | Follow whichever version was listed. |
| Payrun Snapshot (`payrunSnapshotRows`) | `pickTimesheetRowForPeriod` over the person's sheets | Same as above. |
| Weekly report feed + check line (`loadTimesheetFeed`, `weeklyReportPayRows`) | `listTimesheetStates` → `Map(start → draft)` | Last row wins. |
| Invoices / exports | No invoice number existed | — |
| 1.47 / 1.54 change detection | `signedTimesheetBookingChanges` already reports `exported` + `changed` for an exported sheet (warning only); the 1.54 notice functions skip exported sheets | Basis for "revision due". |
| iOS (`FirebaseBackend.timesheetStateDocumentRef`) | Loads and saves the canonical id only; lists by `userId` | An older iPhone only ever opens the original. |

## Decisions

1. **Where a revision lives.** `organizations/{orgId}/settings/{original id}_rev{N}` (N = 1…99). It carries `userId`
   and the period fields like any sheet, so the existing reads, privacy (`privatePay`) and reviewer rules apply, plus
   `revisionOf`, `revision`, `previousVersionId`, `revisionCreatedBy`, `revisionCreatedAt`. The original is never
   written. **No stored `previousExportedTotal`**: the difference is read from the previous (frozen) version when shown,
   so it cannot be forged (the brief suggested storing it; the rules cannot check a stored number).
2. **When a revision is due.** Derived, never written: the pay run's latest version is exported and
   `signedTimesheetBookingChanges` of it reads `exported` + `changed` (the 1.47 comparison: day, slot, times, OT rate,
   break, job or place, removed, added after) → `timesheetRevisionDue`. Before export nothing changes from 1.47.
3. **Who creates it.** The person, with their own owner write, when they press "Review and sign again"; a reviewer
   (admin or line manager, `timesheetWriterIsReviewer`) when reviewing a self-signed person or with "Create revision"
   (kept: it costs one button, and covers corrections a booking did not cause). `canCreateTimesheetRevision`. The rules
   check the same (`tsRevCreate`): subject or reviewer of the subject, exact create shape, previous version exported.
4. **One transaction creates only the new document** (`createTimesheetRevision`): re-reads the previous version and the
   target; refuses when the previous version is not exported (so a second open revision is impossible) or the target
   exists.
5. **What it copies.** `TIMESHEET_REVISION_COPIED_FIELDS` exactly as stored — period identity, price work, expenses,
   late extras, `extraEntryReviews`, `payrollLineReviews` — and the rules check each is equal to the previous version
   (`!d.diff(prev).affectedKeys().hasAny(copied)`), so the person can never create a revision with self-approved
   reviews or raised entries. Labour is never copied: it is priced from the live bookings. Entries stored without an id
   keep their id because `timesheetEntryId` derives a revision's ids from its original's id.
6. **Lists, reports.** Lists and the period page: the latest version, earlier versions read-only under it. Weekly report
   and Payrun Snapshot: the latest version that is exported or signed off (`timesheetReportVersion`), so an open
   revision leaves the previous exported version in force. Implemented once in `pickTimesheetRowForPeriod` (rows with
   `documentId`) and `timesheetVersionsForPeriod`.
7. **Late extras, PAYE days, pay privacy.** After export, price work and expenses still go on the next timesheet. A
   revision carries the late extras as stored (approved ones keep paying). PAYE days are left out exactly as on any
   sheet (`timesheetDaysForPerson`). The revision is a `timesheet_` document, so the `privatePay` read rules apply.
8. **Numbering and difference.** `timesheetInvoiceNumber` (`TS-{original id's stamp}-{6 of the stored userId}`, derived —
   invoices had no number before) + `timesheetInvoiceNumberForRevision` ("-REV1"); `timesheetRevisionDifference` from
   `timesheetExportedTotal` of the previous version.
9. **Notice.** One type, `timesheet_revision_to_sign`: the 1.54 booking-notice functions now also judge the latest
   version when it is exported and write "Update to your exported timesheet" once per exported version
   (`timesheetRevisionDueNoticeId`); a reviewer's Create revision writes "Your timesheet has a revision to sign". Never
   the actor. No Cloud Function writes a timesheet document.
10. **Locks.** Rules: an exported revision never changes; an exported original that has `_rev1` never changes or is
    deleted; revision fields never change; an unexported revision is deleted only by a reviewer. PR #334 (1.54.1, "lock
    all") locks every exported sheet; these narrower locks stay correct with or without it.
11. **Older iPhones.** They load/save the canonical id only: they show the frozen original (writes refused once a
    revision exists), never the revision, and may list a revision as a second row. Nothing they write can change a
    revision's fields. `minimumIosBuild` must be raised to the iOS 1.55 build before revisions are used.

## Judgement calls (owner to confirm)

- J1 Pending late extras ride into the revision still pending (the rules need the copy to be exact); the line manager can
  decide them there. The coordinator's wording was "signed entries plus approved late extras".
- J2 The rules cannot see whether a booking really changed: the person could create a revision with nothing changed
  (it shows "+£0.00" and goes through normal signing).
- J3 Invoice numbers are derived (`TS-20261101-6A9632`), shown on every invoice from 1.55.0, old sheets included.
- J4 Manual "Create revision" kept for admins and line managers (cheap).
- J5 While a revision is open the weekly report and Payrun Snapshot keep using the previous exported version.

## Review of #344 (16 Nov)

- HIGH 1: the person never changes a revision's `priceWorkEntries`, `expenseEntries` or `lateExtras` (rules `tsRevKept`;
  rulebook `timesheetOwnerCanAddExtras` / `canEditTimesheetEntry` / `timesheetOwnerCanAddLateExtras` refuse a revision).
- 2: no signed snapshot on the previous version → difference "Difference not available (older export)".
- 3: revisions priced `decided` everywhere. 4: stored nulls copied exactly.
- 7: a pending late extra on an unsigned revision is with the person. 8: "exported" uses the rules' leftover rule.
- 9: Payrun Snapshot signed off = `timesheetVersionSignedOff`. 10: invoice number from the stored original id + userId
  (`TS-{stamp}-{person}`). 11: the notice function completes a chain cut by its query limit.
  12: `parseTimesheetRevisionDocId` (one parser, in `timesheetPeriod.ts`) refuses `_rev0` / `_rev01`; the hub calls
  `timesheetRevisionDue`.
- Not here: finding 5 (hotfix branch `w-hotfix-settings-read`), finding 6 (owner question).

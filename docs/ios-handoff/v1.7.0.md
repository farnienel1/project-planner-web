# iOS follow-on — rulebook 1.7.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.6.0 → 1.7.0
Packed hash: 7811bcffc829f4790ebd1080578b83323ff74f6c34c4b0af3683859af742d1cb
Rulebook sha256: 7ae887277e0accb7d0229933e9d8132092eacc295004d9cadcda73aea013d872
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: BOOKING_SLOT_WRITE_GROUP, DEADLINE_ASSIGNMENTS_DOCUMENT_ID, DEADLINE_STATUSES, JOB_ADDRESS_WRITE_GROUP, JOB_COLLECTIONS, JOB_MANAGER_WRITE_GROUP, JOB_PIN_WRITE_GROUP, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS, SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP, bookingUpdateWriteFields, deadlineAssignedProjectIds, deadlineAssignmentWriteFields, deadlineProjectKey, deadlinesDocumentId, jobWriteFields, parseDeadlineAssignments, parseDeadlineDocument, parseDeadlineItem, parseJobDocument, parseProjectDocument, parseSmallWorkDocument, parseSubcontractorBookingDocument, parseTimesheetEntries, subcontractorBookingCreateFields, subcontractorBookingWriteFields, timesheetEntryId
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/workDocumentReaders.ts
Done when:
- [ ] Packed hash in iOS equals 7811bcffc829f4790ebd1080578b83323ff74f6c34c4b0af3683859af742d1cb
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 7ae887277e0accb7d0229933e9d8132092eacc295004d9cadcda73aea013d872)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.7.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.7.0

- One reader per work collection (§1): `parseJobDocument` / `parseProjectDocument` / `parseSmallWorkDocument` (`projects`, `smallWorks`), `parseSubcontractorBookingDocument`, `parseTimesheetEntries`, `parseDeadlineDocument` / `parseDeadlineItem`, `parseDeadlineAssignments` / `deadlineAssignedProjectIds`. Ids are the document id or the stored id in stored case and a non-UUID id is kept (iOS randomised or dropped non-UUID job, client, manager, subcontractor-booking, entry and deadline ids; web dropped non-UUID deadline ids). A job with no start date starts on its creation day (web used "now"); no end date ends on its start day.
- Subcontractor bookings created on web are now real records on iOS: the document id is an upper-case UUID also stored as `id`, with `status`, `isBreakRemoved` and the contact lists always written (`subcontractorBookingCreateFields`); the reader accepts older web documents with no `id` or `status` (Confirmed) or slot (FULL DAY) (§1).
- Timesheet price work and expense entries keep their stored ids; an entry without one gets the deterministic `timesheetEntryId` (web minted a new random id on every read, so `extraEntryReviews[entryId]` never matched) (§8).
- Partial writes for work documents (§1): `jobWriteFields`, `bookingUpdateWriteFields` (web no longer rewrites the whole booking on an edit; an edit of a deleted booking is refused), `subcontractorBookingWriteFields`, and `deadlineAssignmentWriteFields` (a field-path update; never a merge-set with a dotted key, which iOS stored as a literal `projects.{KEY}` field — `parseDeadlineAssignments` still reads those).
- Deleting a person or a job removes only bookings from today on, each with its tombstone; past bookings stay; deactivating removes nothing (`bookingsToRemoveOnOperativeDelete`, `bookingsToRemoveOnProjectDelete`) (§2). iOS deleted every booking of a deleted operative without tombstones.

## New rulebook sections

- 1.7.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

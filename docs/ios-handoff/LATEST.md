# iOS follow-on — rulebook 1.59.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.58.0 → 1.59.0
Packed hash: 2f211dbc7bdce132c7e79952e643e96fa68936c562ba1dbffa9028e30d84d4dc
Rulebook sha256: 675ff3cbed895d2265efab663c6365d52a819a4eff1e9b325f943baaaf351d8e
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DELETED_PEOPLE_COLLECTION, FORMER_PERSON_ANONYMOUS_NAME, FORMER_PERSON_CHIP, FORMER_PERSON_EMAIL_MAX, FORMER_PERSON_FIELDS, FORMER_PERSON_IDS_MAX, FORMER_PERSON_LINK_ACTION, FORMER_PERSON_LINK_ADMIN_ONLY_NOTE, FORMER_PERSON_LINK_SKIP, FORMER_PERSON_LINK_TITLE, FORMER_PERSON_NAME_MAX, FORMER_PERSON_RECORD_SKIPPED_MESSAGE, MANAGER_ROW_NOT_LINKED_LABEL, MATERIAL_CONTACTS_COLLECTION, MATERIAL_REQUEST_SAFE_SENDER_NOTICE, formerPeopleForEmail, formerPersonDataHealthLabel, formerPersonForId, formerPersonLabel, formerPersonLinkOfferMessage, formerPersonLinkWriteFields, formerPersonPath, formerPersonRecordFields, formerPersonRecordNeeded, isTaskPersonSelected, materialContactCreateFields, materialContactKey, materialContactPath, materialRequestIsFirstContact, materialRequestSafeSenderNotice, materialSendRecordRecipientEmails, parseFormerPersonDocument, taskCompletionFields, taskPersonIndex, taskPersonKeys, toggleTaskPerson
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingPerson.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/formerPeople.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/liveSources.ts, lib/canonical/materialSafeSender.ts, lib/canonical/operationsDocuments.ts, lib/canonical/organizationSettings.ts, lib/canonical/taskPeople.ts, lib/canonical/unresolvedBookingPeople.ts, lib/canonical/userDelete.ts
Done when:
- [ ] Packed hash in iOS equals 2f211dbc7bdce132c7e79952e643e96fa68936c562ba1dbffa9028e30d84d4dc
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 675ff3cbed895d2265efab663c6365d52a819a4eff1e9b325f943baaaf351d8e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.59.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.59.0

- **Former people on old bookings** (§11, §16, §21; owner decision 17 Nov, "yes, perfect solution"). New `organizations/{orgId}/deletedPeople/{id}` (`displayName`, `email`, `personIds`, `deletedAt`, `deletedBy` only) written by a person delete when they have records (`formerPersonRecordNeeded`, `formerPersonRecordFields`, `userDeleteWrites` `formerPerson`, an `optional` write); read with `parseFormerPersonDocument` / `formerPersonForId`. `resolveBookingPerson` (`formerPeople` → `former`), `scheduleRowPerson` ("Former: Jane Smith", `FORMER_PERSON_CHIP`) and `unresolvedBookingPeople` (`former`, `label`; Data health lists them apart, "Former person · Jane Smith") read it. Add User offers an admin to link a former person on the same email (`formerPeopleForEmail`, `formerPersonLinkOfferMessage`, `formerPersonLinkWriteFields`). Account self-delete leaves anonymised records ("Deleted user", no email). `LIVE_COLLECTIONS` / `OPERATIONAL_COLLECTION_PATHS` list `deletedPeople`; `CONTRACT_NO_READER` until iOS writes it. Security rules: create only in the batch that deletes the person's users document or operatives row; staff read; no update or delete; out of the catch-all read. Compile cost offset by folding `managerRowIsCaller` into `jobListsCaller`, dropping redundant parentheses in `lineManagerIdList` / `homeOrgIs` and merging the catch-all's collection list (no allow / deny change).
- **`resolveBookingPerson` reads `managers` rows** (`BookingPersonInput.managers` → `managerId`): a manager site booking filed under a `managers` row id no longer reads "Unknown person"; `bookingPersonKey` / `scheduleRowPerson` key `manager:<id>`; `bookingIdsForPerson` includes the row. New result fields appear only when set (earlier shapes unchanged).
- **Invite accept** (`inviteAcceptWrites` `placeholderId` → `placeholderKeptUnlinked`): an existing account in the same organisation removes the placeholder only when it already lists the placeholder's id; otherwise it is kept, never deleted unlinked.
- **Task person key in the rulebook** (`taskPersonKeys`, `taskPersonIndex`, `isTaskPersonSelected`, `toggleTaskPerson`), moved from web `lib/tasks/taskAssigneePeople.ts` (web now calls it; same keys).
- **Safe-sender notice** (§16, owner decision 17 Nov): `materialSendRecordRecipientEmails`, `materialRequestIsFirstContact`, `materialRequestSafeSenderNotice`, `MATERIAL_REQUEST_SAFE_SENDER_NOTICE`; the web send route and the email function's `material_request` add the red box on the first email to an address.
- **Task completion** (`taskCompletionFields`, §23): `completedAt` / `completedBy` move with the status; web calls it (unchanged behaviour), iOS adopts it (hand-off).
- **Review of #370** (same release): (M1) a former-person record holds only what the deleted document carries and the rules check it (email, name, ids) — `formerPersonRecordFields` no longer takes `roster` / `catalogueRows` (breaking for callers: pass the document's `formerUserIds`, `sameEmailUserIds` or a row's `linkedIds`); each deleted `operatives` / `managers` row gets its own record (`userDeleteWrites` `formerRows`). (M2) a `managers` row with no account stays listed in Data health (`unlinkedManagerRow`, `MANAGER_ROW_NOT_LINKED_LABEL`). (L1) the rule compares the organisation with `homeOrgIs`; a refused record is reported to the deleter (`FORMER_PERSON_RECORD_SKIPPED_MESSAGE`). (L2) the safe-sender check reads one `materialContacts/{email}` document per recipient (`MATERIAL_CONTACTS_COLLECTION`, `materialContactKey`, `materialContactPath`, `materialContactCreateFields`; `materialRequestSafeSenderNotice` / `materialRequestIsFirstContact` now take whether the contact is known, not a list) and `scripts/backfill-material-contacts.mjs`. (L4) **the task person key joins a catalogue row to an account through its `userId` and `uid` as well as `linkedUserId`** (the web copy it replaces used `linkedUserId` only), so a row linked by `userId` or `uid` is the same person as that account in the task pickers, filter and names — a widening: such a person now appears once, where web listed the row and the account separately. Rules compile-cost offset: 169 redundant parentheses around `&&` operands of `||` removed (no allow / deny change; `&&` binds tighter than `||`).

## iOS work for 1.59.0

Former people on old bookings, managers rows, the task person key, task completion and the safe-sender notice (rulebook 1.59.0, owner decisions 17 Nov). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy.

1. **Deleting a person writes a former-person record** (§11). Where iOS deletes a person (`UserStore` delete through `userDeleteWrites`, and any catalogue `operatives` row delete): work out whether they have records — any labour or manager site booking (every date) under `bookingIdsForAccount` ids, any `holidayBookings`, `operativeDayRateHistory` or `settings` timesheet with `userId` in those ids (`limit(1)` each; a refused read is `nil`) — and ask `formerPersonRecordNeeded({ bookings, managerSiteBookings, leaveRecords, timesheets, payHistoryRows })`. When true, pass `formerPersonRecordFields({ person, deletedBy })` as `formerPerson` to `userDeleteWrites`, built from the users document **as stored** (`firstName`, `surname`, `lastName`, `displayName`, `name`, `email`, `formerUserIds`, `sameEmailUserIds` — the rules check the record against exactly these), and one record per deleted `operatives` / `managers` row as `formerRows["<collection>/<rowId>"]` (from the row as stored, with `linkedIds: [linkedUserId, userId, uid]`); each row record is its own step with that row's delete. The plan puts an `op: 'set'` write with `optional: true` and `serverTimestampFields: ['deletedAt']` into the batch that deletes `users/{uid}` (the account batch for an admin; the users-document step for an operatives manager). Execute it like the other sets (`FieldValue.serverTimestamp()` for `deletedAt`); **if that batch is refused with permission-denied, run the same batch again without the optional write** and tell the deleter `FORMER_PERSON_RECORD_SKIPPED_MESSAGE` (the delete still happened). For a catalogue `operatives/{id}` row delete, write `organizations/{org}/deletedPeople/{id}` in the same batch as the row delete. Never write the record on its own — the rules refuse it.
2. **Former people on screens** (§21). Staff (admins and managers) read `organizations/{org}/deletedPeople` once when the job week grid (Scheduling) opens, through `parseFormerPersonDocument`, and pass them as `formerPeople` to `scheduleRowPerson` / `resolveBookingPerson` with `managers` (the `managers` rows: `{ id, email }`). A row with `former` shows `label` ("Former: Jane Smith") and the chip `FORMER_PERSON_CHIP` ("Former person") instead of "Not linked to a person"; still no Quick Add. A row with `managerId` (a manager site booking filed under a `managers` row id) is a resolved person — name it from that row.
3. **`resolveBookingPerson` callers pass `managers`** (with `name` where iOS shows Data health-style lists; `unresolvedBookingPeople` now also returns `unlinkedManagerRow` groups — a managers row with no account) everywhere iOS builds `BookingPersonInput` (weekly report names, warnings, Daily Overview), so manager schedule bookings under a managers row id never read "Unknown". New result fields `managerId` and `former` are present only when set.
4. **Add User link offer** (admins only): before saving an invite, `formerPeopleForEmail({ email, formerPeople, roster })`; when not empty, ask with `FORMER_PERSON_LINK_TITLE` / `formerPersonLinkOfferMessage(matches)` and buttons `FORMER_PERSON_LINK_ACTION` / `FORMER_PERSON_LINK_SKIP`. On link, after the placeholder is created, update `users/{placeholderId}` with `formerPersonLinkWriteFields(...)`: `FieldValue.arrayUnion` of `arrayUnion.formerUserIds`, plus `set` and `updatedAt`. A failure never stops the invite (say "link them in Data health on the web").
5. **Task person key** (§21): replace the iOS task picker's own grouping (`TaskPeoplePickerSheet`, task filters, assignee names) with `taskPersonKeys({ managers, operatives, roster })` → `{ keys, ghostKeys }` (look ids up lower case; an unknown id is `id:<id>`). One row per person; ghosts (every account a ghost) not offered for a new assignment; existing assignments to an old row id stay shown and ticked. `isTaskPersonSelected` / `toggleTaskPerson` for ticking.
6. **Task completion** (§23): every status change writes `taskCompletionFields(task, status, { completedBy, now })` — `completedAt` / `completedBy` kept when already completed, set on completing, `nil` (removed) for any other status, through `taskWriteFields`. iOS set the status without them.
7. **Safe-sender notice**: no iOS code change — the email function decides it for `material_request` sends once deployed (it reads and creates `materialContacts/{email}`). Do not add it to the iOS payload, and do not write `materialContacts` from the app.
8. **Invite accept**: iOS has no accept flow (it opens the web link); nothing to do. `inviteAcceptWrites` now takes `placeholderId`.
9. Tests: a deleted person's booking shows "Former: Jane Smith"; a managers-row booking resolves; the task picker lists a person with an `operatives` row and a `managers` row once; reopening a completed task clears `completedAt`.
10. `minimumIosBuild`: not needed.

## New rulebook sections

- 1.59.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

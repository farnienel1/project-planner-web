# iOS follow-on — rulebook 1.60.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.60.0 → 1.60.0
Packed hash: 3c74c2db39ced024c2e0cfb06a3ab304ab376a9af485ac4da2bc5ad80f039db7
Rulebook sha256: 5ab1e9d78dee09464b6cd98e68441d55506983e55065dc91232a800490222fe9
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
- [ ] Packed hash in iOS equals 3c74c2db39ced024c2e0cfb06a3ab304ab376a9af485ac4da2bc5ad80f039db7
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5ab1e9d78dee09464b6cd98e68441d55506983e55065dc91232a800490222fe9)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.60.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.60.0

- **More than one person, someone already booked** (§5, owner request 17 Nov): new `multiPersonBookingBlocks`, `MULTI_PERSON_ALREADY_BOOKED_MESSAGE`, `MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL`. A booking for more than one person names each selected person who already has a booking on a selected day and cannot be saved until they are removed; one person keeps ✓ / ✕ / Replace. Web: Book labour multi-select, the Schedule wizard; iOS: Book labour multi-select, the Scheduling wizard (`ScheduleOperativeView`) and Select Operatives. Quick Add books one person (unchanged).
- **Book labour and Daily Overview list "Half-day leave not covered"** (§5, owner report 17 Nov): Book labour lists the day's `leaveCoverageRows` `leave_cover` rows beside `unbookedLabourRowsOnDay` (before, "Book the PM" opened on "Everyone is booked"), prefilled with new `leaveCoverBookingWindow` (the first uncovered stretch, never across a booking); Daily Overview shows the day's rows in its scope. Must merge after 1.59.0 (#370).

## New rulebook sections

- 1.59.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

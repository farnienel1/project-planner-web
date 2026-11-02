# iOS follow-on — rulebook 1.10.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.9.0 → 1.10.0
Packed hash: 077f911f0e261c7c56f43f77af97d760250e0aa002e7a2aaab502b16b073ec33
Rulebook sha256: 90fcaae0389a703600866b0d1f418286eaea24c89b4d5571eeeca23c22b84d27
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: f5bf5e53c4d9cea67cfc6e4fd2aa859fc168361dccd0c67bd34b6a72b8517090
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: BOOKING_PERMISSION_COLLECTIONS, CROSS_PLATFORM_CONTRACT_READERS, IDEMPOTENT_MIGRATION_WRITES, ORG_MEMBERSHIP_ADMIN_FIELDS, ORG_MEMBERSHIP_DEFAULT_ON, ORG_MEMBERSHIP_PERMISSION_KEYS, ORG_MEMBERSHIP_SELF_FIELDS, PAY_HISTORY_NOT_LOADED_MESSAGE, USER_DELETE_REFUSAL_MESSAGES, bookingJobId, canDeleteBooking, canDeleteUser, canSeeJob, canWriteBooking, crossPlatformContractReaderNames, isJobManager, jobDeleteBookingRemovals, jobManagerIds, jobManagerUserIds, jobTypesChangeWriteFields, notificationRelatedIdFor, orgMembershipWriteFields, parseOrgMembershipDocument, payRateChangeWrites, readCrossPlatformSample, stableManagerId, userDeleteRefusal, userDeleteWrites, visibleJobsFor
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookingPerson.ts, lib/canonical/bookingTombstones.ts, lib/canonical/bookings.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/operationsDocuments.ts, lib/canonical/parity-fixture.json, lib/canonical/payRate.ts, lib/canonical/recordsDocuments.ts, lib/canonical/staffAccess.ts, lib/canonical/workDocumentReaders.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/crossPlatformContract.test.ts, lib/canonical/crossPlatformContract.ts, lib/canonical/orgMembership.ts, lib/canonical/userDelete.ts
Done when:
- [ ] Packed hash in iOS equals 077f911f0e261c7c56f43f77af97d760250e0aa002e7a2aaab502b16b073ec33
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 90fcaae0389a703600866b0d1f418286eaea24c89b4d5571eeeca23c22b84d27)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.10.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.10.0

- Job visibility and booking permissions (owner decision; §2, §16). Admins see and book every job; managers see and create, edit, cancel and **delete** bookings only on the projects and small works they manage (`canSeeJob`, `visibleJobsFor`, `canWriteBooking`, `canDeleteBooking`, `isJobManager`, `jobManagerIds`, `stableManagerId`, `bookingJobId`); operatives never write bookings. `seesEveryJob` is now admins only. Labour, manager site and subcontractor bookings and their tombstones are enforced by the security rules against the job document; jobs carry `managerUserIds` (`jobManagerUserIds`). Replaces "deleting a labour booking is admin only".
- Subcontractor bookings are tombstoned (`TOMBSTONED_BOOKING_COLLECTIONS`), and a job delete removes its future labour, subcontractor and job-linked manager site bookings (`jobDeleteBookingRemovals`) (§2).
- A role belongs to its organisation: the rules' manager checks (materials, wholesalers, variations, settings, warnings, holiday staff, send history, operative pay rows, invitations) read this organisation's role, never another company's users document (§14, §16).
- Deleting a person: `canDeleteUser` / `userDeleteRefusal` gate first, `userDeleteWrites` is the one ordered plan (users document, tax ids, membership, email claim and members entry in one batch first; then future bookings with tombstones, roster rows, invitations) (§11).
- One membership shape: `parseOrgMembershipDocument` / `orgMembershipWriteFields`; a person can no longer raise their own membership role or permissions (§14, §16).
- Inbox rows count from their `createdAt` (`inboxNotificationVisibleToUser` / `unreadNotificationBadgeCount` take `now`; push function too) (§13).
- Pay changes: `payRateChangeWrites` — the seed row only when history loaded and is empty, written in the profile's batch; a failed history load refuses the save (§8).
- Notifications: `notificationRelatedIdFor` is the one relatedId source; variation destinations; web writes `toolbox_talk_issued`, `task_created`, `task_completed`, `booking_created`; new `holiday_cancelled_by_manager` and `holiday_booked_for_you` instead of reusing decision types; self-book off writes nothing; the §13 Status column is current (§13).
- Weekly report: a dismissed clash is not open (`isWarningActive`) (§7). `leaveRecordsForAccount` matches leave stored with the account email as `userId` (§10).
- §1 exception for the idempotent warning-key migration (`IDEMPOTENT_MIGRATION_WRITES`, `syncWriteAllowed(trigger, migration)`); job type saves are explicit adds and removes only (`jobTypesChangeWriteFields`).
- Cross-platform contract (`cross-platform-contract.json`, `readCrossPlatformSample`), mirrored to iOS; a write-shape change updates it (§1, "How the rulebook changes").
- Live leftovers from 1.9.0: Daily Overview reads organisation settings from the live organisation listener; the weekly report's subcontractor bookings and the org-wide materials and send records (Home, Warnings) are live. A payment-run save builds `paymentRunHistory` from the server copy, never the screen draft (§4.5).

## iOS work for 1.10.0

Rulebook functions to call through `CanonicalBusinessEngine` (none of these may get a Swift copy):

1. **Job visibility and booking permissions** (owner decision): `canSeeJob` / `visibleJobsFor` for every job list and picker (managers: only jobs they manage; admins: all; operatives: none), `canWriteBooking` / `canDeleteBooking` for every booking control (labour, manager site, subcontractor). Managers may now **delete** bookings on jobs they manage (with the tombstone). `seesEveryJob` is admins only now. Pass the managers list (`JobManagerRosterRow { id, email }`) and the viewer's ids (`personIdSet`) and email. Job saves write `managerUserIds = jobManagerUserIds(job, managers, accounts)` with `managerIds` (`FirebaseBackend.jobDocumentPayload`); without it a manager named only by a managers-row id that is not the job's `managerId` is refused by the rules.
2. **Firestore rules now refuse** operatives writing any booking, and managers writing bookings on jobs they do not manage. Offline replays refused this way are final (`bookingReplayRefusedIsFinal`).
3. **Subcontractor bookings are tombstoned** (`TOMBSTONED_BOOKING_COLLECTIONS`); job delete uses `jobDeleteBookingRemovals` (labour + subcontractor + job-linked manager site bookings, query stored/upper/lower job id, M8/M9).
4. **User delete** (`UserStore`): gate with `canDeleteUser` / `userDeleteRefusal`, run `userDeleteWrites` steps in order (account batch first; it also deletes `private/taxIds` and `orgMemberships/{org}`). Stop rewriting `bookedBy` on every booking (L16).
5. **Memberships**: read with `parseOrgMembershipDocument`; write only with `orgMembershipWriteFields` (nested permissions). Stop `snapshotCurrentUserOntoMembership` / flat `membershipPayload` merges on every switch — the rules now refuse a self-write that changes role or permissions (unchanged values pass). Do not hard-code `skills: false` or force materials/siteAudit.
6. **Inbox**: pass `now` to `inboxNotificationVisibleToUser` / `unreadNotificationBadgeCount` (rows listed from `createdAt`); drop the synthetic annual-leave rows and local read state (M4).
7. **Notifications**: relatedId via `notificationRelatedIdFor(type, id)` — `variation_added` must carry the variation id, `toolbox_talk_issued` the issue id. Use `holiday_cancelled_by_manager` (manager removes approved leave) and `holiday_booked_for_you` (manager books leave for someone) through `holidayDecisionRecipients`; stop `notifyAdminAnnualLeaveApproval`, stop the notice when self-book is switched off, stop the ownerless "New Booking Created" batch row; `task_completed` must go to the task creator, not the completer. Add the two new types to the iOS enum.
8. **Pay history** (M11): `payRateChangeWrites` → rows in the same batch as the profile; a failed history load refuses the save (never treated as empty).
9. **Leave**: `leaveRecordsForAccount` now also matches `userId == email`.
10. **Job types**: save with `jobTypesChangeWriteFields(stored, { add, remove })` only — never the merged/recovered display list.
11. **Warning-key migration** may keep running from scans (`IDEMPOTENT_MIGRATION_WRITES`); nothing else writes outside a user action.
12. **Material lines**: stop deleting lines older than 365 days on add (M6).
13. **Cross-platform contract**: update `scripts/sync-rulebook-from-web.sh` FILES to copy `lib/canonical/cross-platform-contract.json → ProjectPlannerTests/CrossPlatformContract.json`, check `crossPlatformContractSha256` from the manifest in `RulebookParityTests`, and add `CrossPlatformContractTests`: every sample through `readCrossPlatformSample` (packed) equals `expected`; each `iosWriter` named in the file produces its `iosWritten` sample (fields hand-copied on web from the Swift builders — report any field that differs so web regenerates the contract).

## New rulebook sections

- 1.10.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

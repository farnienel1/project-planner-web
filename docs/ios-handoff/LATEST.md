# iOS follow-on — rulebook 1.10.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.10.0 → 1.10.0
Packed hash: b5bb7ba060eb8439943aa23b1a0a9e80e5c572e7da51619eed43f6553dca6c44
Rulebook sha256: f2175fc10debf84694765c865ab93caa4e466eec29bc38c04b8997f45efceb83
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: b02694a57fe948213f6934b89f27a205e0dd6463bd717a82c5d3d992c09a9049
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: inviteAcceptWrites, orgDayHours, payForHours, payrollLineReview, roundPennies, timesheetInvoiceRows, timesheetParticipant
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.indexes.json, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/materialCutOffWarnings.ts, lib/canonical/payRate.ts, lib/canonical/peopleDocuments.ts, lib/canonical/reportPay.ts, lib/canonical/staffAccess.ts, lib/canonical/timesheetEntryReviews.ts, lib/canonical/warningRows.ts, lib/canonical/inviteAccept.ts
Done when:
- [ ] Packed hash in iOS equals b5bb7ba060eb8439943aa23b1a0a9e80e5c572e7da51619eed43f6553dca6c44
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f2175fc10debf84694765c865ab93caa4e466eec29bc38c04b8997f45efceb83)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.10.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.10.0

- Owner decisions round 2 — jobs (§16): admins add and edit every job; managers add jobs, edit any job and change a job's manager list only with that kind's Projects / Small works add/edit/manage permission (`canCreateJob`, `canChangeJobManagers`, `canEditJob`, `JOB_MANAGER_LIST_FIELDS`, `jobWriteWithoutManagerList`); a manager without it edits the details of jobs they manage. `seesEveryJob` and `canSeeJob` take the kind and the toggles: a toggle shows every job of that kind. `canEditWorkCatalogue` no longer gates admins. Enforced by the rules on job create and update.
- New §17: reads are enforced. Managers without a toggle read only their jobs, those jobs' bookings and their own; operatives only their own bookings and their jobs by id. Both apps build their queries from `jobQueryPlan` / `bookingQueryPlan` (`jobIdQueryValues`, `readsEveryBooking`, `JOBS_PER_BOOKING_QUERY`, `OWN_BOOKING_IDS_PER_QUERY`); composite indexes added. Daily Overview and warnings take `warningScopeFor` (`scope` on `unbookedLabourRows`, `qualificationExpiryRows`, `unverifiedOperativeRows`, `materialCutOffWarningRows`) (§5, §6, §17).
- A manager never books themselves onto a job they do not manage (`canWriteBooking`, rules tested) (§16).
- `scripts/backfill-job-manager-user-ids.mjs` writes `managerUserIds` on existing jobs (Deploy notes, `docs/DEPLOY_1.10.0.md`).
- Tasks store `createdByUserId`; `task_completed` goes to `taskCompletedRecipients` (name fallback for older tasks). Scheduled push types are not pushed (no schedule in the push function) (§13).
- Hunt C: invoice rows are `timesheetInvoiceRows` (signed snapshot first, then reviews and entry decisions), payroll line reviews are `payrollLineReview` (any letter case), pay arithmetic is `payForHours` / `roundPennies` / `orgDayHours`, `payRateOnDay` matches every id of the person (`person`, `roster`), `timesheetParticipant` decides the Weekly Report feed and the reminder recipients, the Weekly Report never writes (`weeklyReport` trigger), and accepting an invitation is `inviteAcceptWrites` (role from the invitation; an existing account keeps its profile and the placeholder) (§7, §8, §11).
- Job visibility and booking permissions (owner decision; §2, §16). Admins see and book every job; managers see and create, edit, cancel and **delete** bookings only on the projects and small works they manage (`canSeeJob`, `visibleJobsFor`, `canWriteBooking`, `canDeleteBooking`, `isJobManager`, `jobManagerIds`, `stableManagerId`, `bookingJobId`); operatives never write bookings. `seesEveryJob`: admins, and (round 2, below) managers with that kind's toggle. Labour, manager site and subcontractor bookings and their tombstones are enforced by the security rules against the job document; jobs carry `managerUserIds` (`jobManagerUserIds`). Replaces "deleting a labour booking is admin only".
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

1. **Job visibility and booking permissions** (owner decision): `canSeeJob` / `visibleJobsFor` for every job list and picker (managers: only jobs they manage; admins: all; operatives: none), `canWriteBooking` / `canDeleteBooking` for every booking control (labour, manager site, subcontractor). Managers may now **delete** bookings on jobs they manage (with the tombstone). `seesEveryJob(role, kind, toggles)`: admins, and managers with that kind's toggle (round 2, item 14). Pass the managers list (`JobManagerRosterRow { id, email }`) and the viewer's ids (`personIdSet`) and email. Job saves write `managerUserIds = jobManagerUserIds(job, managers, accounts)` with `managerIds` (`FirebaseBackend.jobDocumentPayload`); without it a manager named only by a managers-row id that is not the job's `managerId` is refused by the rules.
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

14. **Jobs, round 2** (owner): `canCreateJob(viewer, kind)` gates Add Project / Add Small Works; `canChangeJobManagers(viewer, kind)` gates the manager picker; `canEditJob(viewer, job, kind, managers)` gates Edit — a manager without the toggle edits details of jobs they manage and the save must drop `JOB_MANAGER_LIST_FIELDS` (`jobWriteWithoutManagerList`), or the rules refuse it. Pass `toggles: { projects: permissions.projects, smallWorks: permissions.smallWorks }` and `uid` (Auth uid) on the `JobAccessViewer`. `canSeeJob` / `visibleJobsFor` take the job kind (collection) as the 4th argument.
15. **Reads are enforced (§17)** — iOS must stop whole-collection reads for restricted viewers or their lists go empty: `FirebaseBackend.loadProjects` / small works (`getDocumentsPreferringServer(collection("projects"))`, ~2238 / ~2407), `loadBookings` (~7172, ~7375), `loadManagerSiteBookings` (~7524, ~7584), `SubcontractorStore` (`query: { $0.collection("subcontractorBookings") }`), the bookings reads at ~3138 / ~6083–6095 / ~3428 and every listener on those collections. Build them from `jobQueryPlan(viewer, { documentIds })` (operatives: the job ids of their own bookings → single-document reads, never a list) and `bookingQueryPlan(viewer, visibleJobIds, { ownBookingIds: bookingIdsForAccount(...) })`: one query per `queries` entry, adding `date >= bookingLoadStart` where the collection has it, merged by document id; re-plan when the visible jobs or own ids change and close the queries of jobs that left. Admins and managers with either toggle keep whole collections (`readsEveryBooking`).
16. **Warnings and Daily Overview scope**: compute `warningScopeFor({ viewer, visibleJobIds, bookings, managerBookings, people, operatives })` and pass it as `scope` to `unbookedLabourRows` / `unbookedLabourRowsOnDay`, `qualificationExpiryRows`, `unverifiedOperativeRows`, `materialCutOffWarningRows` (`WarningsComputation.swift`, Daily Overview builder).
17. **Tasks**: write `createdByUserId` (signed-in uid) on create (`FirebaseBackend.projectTaskFields`); `task_completed` recipients = `taskCompletedRecipients(task, completer, roster)`.
18. **Hunt C**: invoices (`InvoicingView.swift` ~5397–5533, ~5934–6000, callers ~2337, ~2855, ~5909) use `timesheetInvoiceRows({ sheet, payrollLines, extrasMode })` — the signed `weeklyReportOverride` first; review lookups use `payrollLineReview(sheet, lineId)` (`TimesheetManagerReviewSupport.swift` 43–61); pay maths `payForHours` / `roundPennies` / `orgDayHours` (`PayrollRateResolver.swift` 37–49); `payRateOnDay` with `person` + `roster` and the whole history (drop `mergedEntries`, `PayrollRateResolver.swift:144`); `timesheetParticipant(user, day, tz)` for `WeeklyReportTimesheetFeed.swift:94` and the reminder recipients (`NotificationService.swift:185` — the toggle gates push only, never the row); the Weekly Report never writes timesheets (`WeeklyReportTimesheetFeed.swift` 136–167, trigger `weeklyReport`); invite accept (`FirebaseBackend` ~6560–6880) follows `inviteAcceptWrites` (existing account: no profile rewrite, placeholder kept, role from the invitation).

## New rulebook sections

- 17. Job access and reads (1.10.0)
- Deploy notes

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

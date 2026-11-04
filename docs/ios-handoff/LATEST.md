# iOS follow-on — rulebook 1.31.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.31.0 → 1.31.0
Packed hash: 81e81d52ab41153475e732cfac138f630788bb2b5664e7567a1263d9ab4e7ae8
Rulebook sha256: 0f1071f709e0c26b94e5305d2e3d5f0dd998a9bf5a85a996be07ad2c0c8dc6bb
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: exportedTimesheetHistorySubjects, operativesManagerMayDeleteBooking, timesheetDocumentSubjectId
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bookings.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/parity-fixture.json, lib/canonical/timesheetPeriod.ts, lib/canonical/userDelete.ts, lib/canonical/userTimesheetAccess.ts
Done when:
- [ ] Packed hash in iOS equals 81e81d52ab41153475e732cfac138f630788bb2b5664e7567a1263d9ab4e7ae8
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 0f1071f709e0c26b94e5305d2e3d5f0dd998a9bf5a85a996be07ad2c0c8dc6bb)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.31.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.31.0

- **People and access** (§11, access audit, owner decisions 4 Nov; new `peopleAccess.ts`): no rights carry over on a level change — an operative is nobody's line manager (`lineManagerIds`, `rosterMemberIsOperativeLevel`; rules for leave decisions, timesheet review, pay, overtime, price work, expenses and claim evidence). A line manager cannot be made an operative, deactivated or deleted while anyone reports to them (`lineManagerReports`, `lineManagerChangeBlock`, `LINE_MANAGER_REPORTS_BLOCK_MESSAGE`).
- **Warnings scope** (§5, §6, §17): admins see every warning; a manager only themselves, their reports and the jobs they manage, whatever their toggles (`warningScopeFor` rewritten; `isWarningRowInScope`, `managerBookingJobId`). Counts and Daily Overview's unbooked people use the same scope.
- **Job managers**: admin ↔ manager keeps jobs; made an operative, deactivated or deleted removes the person from their jobs (`jobManagerRemovalWrites`, `changeRemovesJobManager`) and tells the admins (`job_manager_removed`); a new job needs a manager (`jobManagerRequiredError`; rules refuse a create without one).
- **Same-email documents**: Change user type writes only changed fields, clears `hasNoLineManager` when leaving admin and updates `members` for a listed same-email document (`accountTypeChangeWrites` `members`); deactivate writes every same-email document (`userActiveWrites`); `rosterListFor` folds before it classifies.
- **One flag reader** (`userPermissionFlag`; rules `staffFlag`): the top-level value when stored, else `permissions.{key}`.
- **Change Super Admin** is one batch (`superAdminTransferWrites`); the outgoing Super Admin without a line manager keeps self-approval (both self-manage toggles written on — owner to confirm).
- A demoted admin keeps Annual Leave Management (`accountTypePermissions`). "No line manager" is refused by the rules on anyone but an admin.
- **Operatives managers** add, edit, deactivate and delete operatives (`userDeleteRefusal` `actorManagesOperatives`, `operatives_only`; rules widened for exactly those documents); they delete only the operative's bookings dated after today, never today's or past ones, which they may only cancel (`operativesManagerMayDeleteBooking`, `bookingsToRemoveOnOperativeDelete` `futureOnly`; rules: the booking `date` after the request time and no users document). Admins get `operative_created` and the new `operative_deleted` (company activity).
- **Exported timesheets** (§8): `exportedTimesheetHistorySubjects` — the Exported list and hub count include the viewer's own exported sheets (read-only) and inactive people in scope; `userTimesheetSubjects` unchanged; `timesheetDocumentSubjectId` keeps sheets stored without `userId`.
- **iOS follow-up**: pass `jobs` (with stored manager fields) and `roster` to `warningScopeFor` (a caller without `jobs` gives a manager no job rows); call `lineManagerChangeBlock` before Change user type to operative, deactivate and delete; write `jobManagerRemovalWrites` + `job_manager_removed`, `operative_created` / `operative_deleted`; use `superAdminTransferWrites`, `userActiveWrites`, the unfolded roster for `accountTypeChangeWrites` (with `members`), `userDeleteWrites` with `actorManagesOperatives`, `jobManagerRequiredError` on job create and `jobTypeStoredFields`. replace `InvoicingView.usersForExportedHistory()` and the hub Exported count with `exportedTimesheetHistorySubjects`; an operatives manager's delete removes only future bookings (`operativesManagerMayDeleteBooking`). iOS currently blocks the Super Admin from editing their own profile — the rules allow it (only their own self-manage toggles are fixed), so remove that block.
- Web: Edit User and Add User saves are one batch; unbooked labour reads same-email ids; job edits (§21): `jobTypeStoredFields` / `jobTypeDisplayName`, manager group not rewritten by unrelated edits, clearing managers removes all three fields, pin → address removes the coordinates, organisation-zone job dates, derived client ids kept; `parseJobDocument` reads legacy `assignedManagerUserIds`.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

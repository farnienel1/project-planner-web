# iOS follow-on — rulebook 1.31.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.30.3 → 1.31.0
Packed hash: bb4f265f2bd1b10e830c61a92c18a7d2040ccf3a5d09d05331540b3fc32d6635
Rulebook sha256: f65826b58dfab3a6e01b75fba8847e7943ab5992d084352c435db26ba1090373
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: JOB_MANAGER_REMOVED_NOTICE_TYPE, JOB_MANAGER_REQUIRED_MESSAGE, LINE_MANAGER_REPORTS_BLOCK_MESSAGE, changeRemovesJobManager, isWarningRowInScope, jobManagerRemovalWrites, jobManagerRemovedNoticeText, jobManagerRequiredError, jobTypeDisplayName, jobTypeStoredFields, lineManagerChangeBlock, lineManagerReports, managerBookingJobId, rosterMemberIsOperativeLevel, superAdminTransferWrites, userActiveWrites, userPermissionFlag
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/permissionLevels.ts, lib/canonical/recordsDocuments.ts, lib/canonical/rosterLists.ts, lib/canonical/staffAccess.ts, lib/canonical/userDelete.ts, lib/canonical/workDocumentReaders.ts, storage.rules, lib/canonical/peopleAccess.ts
Done when:
- [ ] Packed hash in iOS equals bb4f265f2bd1b10e830c61a92c18a7d2040ccf3a5d09d05331540b3fc32d6635
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f65826b58dfab3a6e01b75fba8847e7943ab5992d084352c435db26ba1090373)
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
- **Operatives managers** add, edit, deactivate and delete operatives (`userDeleteRefusal` `actorManagesOperatives`, `operatives_only`; rules widened for exactly those documents); admins get `operative_created` and the new `operative_deleted` (company activity).
- **iOS follow-up**: pass `jobs` (with stored manager fields) and `roster` to `warningScopeFor` (a caller without `jobs` gives a manager no job rows); call `lineManagerChangeBlock` before Change user type to operative, deactivate and delete; write `jobManagerRemovalWrites` + `job_manager_removed`, `operative_created` / `operative_deleted`; use `superAdminTransferWrites`, `userActiveWrites`, the unfolded roster for `accountTypeChangeWrites` (with `members`), `userDeleteWrites` with `actorManagesOperatives`, `jobManagerRequiredError` on job create and `jobTypeStoredFields`. iOS currently blocks the Super Admin from editing their own profile — the rules allow it (only their own self-manage toggles are fixed), so remove that block.
- Web: Edit User and Add User saves are one batch; unbooked labour reads same-email ids; job edits (§21): `jobTypeStoredFields` / `jobTypeDisplayName`, manager group not rewritten by unrelated edits, clearing managers removes all three fields, pin → address removes the coordinates, organisation-zone job dates, derived client ids kept; `parseJobDocument` reads legacy `assignedManagerUserIds`.

## New rulebook sections

- 1.31.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

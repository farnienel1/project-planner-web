# iOS follow-on — rulebook 1.11.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.10.1 → 1.11.0
Packed hash: 46007c56da40a92a71d770c9bcf19bca4a54caa4bbc4579ae3d2074343c30035
Rulebook sha256: e5a5340c7dae8248326f59ccc643648a37a248e67f82709db838e57a3ccc8ec2
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 43f4b04529bedc38c3827fa084854d1f55d0d4c760c9869c13190a84085298cf
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ACCOUNT_TYPE_OTHER_COMPANY_NOTE, ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE, ADMIN_EDITABLE_PERMISSION_FIELDS, ADMIN_LOCKED_PERMISSION_MESSAGE, BOOKING_JOB_COLLECTIONS, BOOKING_JOB_WRITE_GROUP, INVITE_MEMBERSHIP_FIELDS, LINE_MANAGER_NOT_SET_LABEL, MANAGER_LOCKED_ON_PERMISSION_FIELDS, MANAGER_PERMISSION_TOGGLES, NO_LINE_MANAGER_HELP, NO_LINE_MANAGER_LABEL, OPERATIVE_PERMISSION_TOGGLES, PAYE_RATE_NOT_USED_NOTE, PAY_BASIS_DAY_HELP, PAY_BASIS_HOURLY_HELP, PAY_BASIS_SAVE_NOTE, PERMISSION_DEFAULT_ON, PERMISSION_TOGGLE_CATALOGUE, UNKNOWN_PERSON_LABEL, accountTypeChangeWrites, accountTypePermissions, addUserPermissionDefaults, bookingJobCollectionFields, canManageOperatives, canScheduleOperatives, effectivePermission, effectivePermissions, invitationProfileFields, invitationRole, inviteMembershipWrites, jobCollectionForJobId, jobIdsInBothCollections, jobKind, keepStoredLockedPermissions, lineManagerCandidates, lineManagerOptions, lineManagerSummary, lockedPermissionFields, normalizeBookingJobCollection, organizationLevelFor, permissionLevelOf, permissionToggleRows, permissionsWriteMap, rosterMembersForOrganization, showsMyTimesheets, storedPermissionFlag, timesheetDaysForPerson, withoutLockedPermissionWrites
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.indexes.json, firestore.rules, lib/canonical/bookings.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/createDocuments.ts, lib/canonical/cross-platform-contract.json, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/crossPlatformContract.test.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/leaveRequests.ts, lib/canonical/parity-fixture.json, lib/canonical/payRate.ts, lib/canonical/peopleDocuments.ts, lib/canonical/reportPay.ts, lib/canonical/staffAccess.ts, lib/canonical/userProfile.ts, lib/canonical/workDocumentReaders.ts, lib/canonical/lineManagers.ts, lib/canonical/orgRoster.ts, lib/canonical/permissionLevels.ts
Done when:
- [ ] Packed hash in iOS equals 46007c56da40a92a71d770c9bcf19bca4a54caa4bbc4579ae3d2074343c30035
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 e5a5340c7dae8248326f59ccc643648a37a248e67f82709db838e57a3ccc8ec2)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.11.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.11.0

- Owner decisions round 3 — PAYE (§8): a PAYE day never produces a timesheet line; My Timesheets, reminders, the owner sheet, the invoice and User Timesheets rows exist for a period only when the person is self-employed on at least one day of it, and only those days count (`timesheetDaysForPerson`, `showsMyTimesheets`; `timesheetParticipant` takes a day or a period and no longer counts PAYE; `timesheetInvoiceRows` `timesheetDays`). PAYE reviewers keep User Timesheets.
- Invites (§11, §14, §16): accepting applies exactly what the invitation stores — role, permissions, pay and line manager (`invitationRole`, `invitationProfileFields`, `inviteMembershipWrites`; `invitationCreateFields` stores `role`). The rules let the person accepting a genuine, unused invitation to their email create that membership and their `members.{uid}` with exactly those values, in the batch that marks it used.
- Permission toggles by level (§8, §11): `effectivePermissions`, `lockedPermissionFields`, `permissionLevelOf`. Admins: every toggle on and locked except Annual Leave Management; no operative mode (a stray flag is ignored by the approval rules and the security rules too). Managers: Materials and Site audit on and locked; Wholesalers editable. Saves never write a locked toggle (`keepStoredLockedPermissions` in `userProfileWriteFields`); no document is rewritten. One row set for Add User, its summary and Edit User (`permissionToggleRows`); `canManageOperatives` / `canScheduleOperatives`.
- Change user type writes every document that decides it (`accountTypeChangeWrites`, `accountTypePermissions`): users documents of this organisation, `members.{uid}`, the membership (a profile of another company: the members entry and membership only); refused for a super admin who would stop being an admin (§11).
- Roster (§1, §11, §16): `rosterMembersForOrganization` / `organizationLevelFor` — the members keys and the creator are always on the roster, with their level in this organisation (never another company's flags); a denied read never removes anyone. Rules: a co-member reads a users document anchored on their company (`members` key or creator) even when it names another company (`anchoredInCallerCompany`).
- Line managers (§11): `lineManagerCandidates`, `lineManagerOptions` ("No line manager" only for admins), `lineManagerSummary` (`{ label, ids: [{ id, name }] }`, "Unknown person" for an unknown id, "+N more" only for N ≥ 1). Pay copy is the rulebook's (`PAY_BASIS_SAVE_NOTE`; one basis, saving one removes the other).
- Job kind (§16, §17): the collection decides (`jobKind`); bookings carry `jobCollection` (`bookingJobCollectionFields`, `jobCollectionForJobId`, `normalizeBookingJobCollection`; written by every booking writer, returned by the readers). Rules: a toggle manager reads that kind's bookings by `jobCollection`; a booking without it only admins, its job's managers and its people; `jobCollection` must match the job's collection on a manager's write. `bookingQueryPlan` adds `jobCollection` queries; `readsEveryBooking` (enforced) is admins only. Still behind `ENFORCED_READS_ACTIVE` (false). `scripts/backfill-booking-job-collection.mjs`; composite indexes `jobCollection` + `date`.
- Cross-platform contract v2: iOS samples built by rulebook writers carry `builder` (writer + exact input → exact `iosWritten`); the iOS membership sample is the nested shape (the flat one is an `ios-legacy` read-only case); full iOS job samples (`managerUserIds`, `addressLine2`, `siteAddress`, `manager`, `description`, `hidden*UserIds`, `usesMapPinForLocation`); tasks `createdByUserId`; bookings `jobCollection`.

## New rulebook sections

- 1.11.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

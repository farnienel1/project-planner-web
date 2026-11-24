# iOS follow-on — rulebook 1.88.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.87.0 → 1.88.0
Packed hash: 9d5408501b5e8e069fd4fc6123895e12f29a4d862159fc4d9134e4f4edcf6f11
Rulebook sha256: 95528f6eca8da232670abf1ea13cc9525ddf3b23d24bc99939e95c7b3f2f8f1d
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: MEMBER_LINE_MANAGERS_COLLECTION, MEMBER_LINE_MANAGER_FIELDS, ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE, invitationLineManagerRecord, isHomeOrganization, memberLineManagerPath, memberLineManagerWriteFields, orgLineManagerEditTarget, organizationLineManagerFields, parseMemberLineManagerDocuments, parseOrgLineManager, sameOrgLineManager, withOrganizationLineManager
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/liveSources.ts, lib/canonical/orgLineManagers.ts, lib/canonical/orgRoster.ts, lib/canonical/organizationSettings.ts, lib/canonical/timesheetSignOffReminder.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals 9d5408501b5e8e069fd4fc6123895e12f29a4d862159fc4d9134e4f4edcf6f11
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 95528f6eca8da232670abf1ea13cc9525ddf3b23d24bc99939e95c7b3f2f8f1d)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.88.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.88.0

- **Line managers per organisation** (§8, §11, §14, §16; owner decision 24 Nov, before launch; new `lib/canonical/orgLineManagers.ts`): a member whose home is another company gets this company's own line manager in its record `organizations/{orgId}/memberLineManagers/{uid}` (only the three line-manager keys and write metadata), set by this company's admins or created from the invitation they accepted into this company (a new account's users document holds it, so it gets none); their home company keeps the users document's, and with no record the users document is shown as before (display only). New `organizationLineManagerFields`, `withOrganizationLineManager`, `orgLineManagerEditTarget`, `memberLineManagerWriteFields`, `memberLineManagerPath`, `parseMemberLineManagerDocuments`, `parseOrgLineManager`, `sameOrgLineManager`, `invitationLineManagerRecord`, `isHomeOrganization`, `MEMBER_LINE_MANAGERS_COLLECTION`, `MEMBER_LINE_MANAGER_FIELDS`, `ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE`. `rosterMembersForOrganization` lays it over with `memberLineManagers`; `timesheetSignOffReminderRosterMember` takes `lineManagerRecord`; `inviteMembershipWrites` returns `lineManagerRecord`. `LIVE_COLLECTIONS` and `OPERATIONAL_COLLECTION_PATHS` list `memberLineManagers`; `CONTRACT_NO_READER` until iOS writes it.
- **Review of #455 (same version; owner decision 24 Nov, fix (a)):** the first draft kept this on the membership (`lineManager` map) and widened the membership `get` to every member; memberships written by iPhone builds before 1.10.0 hold a copy of the whole users document (pay, phone), so co-members could have read pay. The membership is back exactly as 1.87.0 (read by the person and the organisation's admins only; `parseOrgMembershipDocument`, `orgMembershipWriteFields`, `ORG_MEMBERSHIP_ADMIN_FIELDS` unchanged), and the line manager moved to its own record. Removed before release: `ORG_MEMBERSHIP_LINE_MANAGER_FIELD`, `ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE`, `orgMembershipLineManagerFields`, `invitationLineManagerMap`; `organizationLineManagerFields` / `withOrganizationLineManager` take `record` (was `membership`), source `record`. Finding 4: every line-manager rule reads one source (`lmData`): home users document, else the record, else none — a home-company line manager has no rights in another organisation without a record. Finding 3: a person deleting their own membership no longer removes the line manager. Finding 2: web Edit user lays the record over again when it arrives after the form loaded (an unsaved choice is kept), and shows a stored line manager who is not offered as the current choice instead of "No line manager".
- Web: `lib/staff/memberLineManagersLive.ts` (one listener on the open company's `memberLineManagers`, laid over the roster and the signed-in user; `useMemberLineManagerRecord`), `prepareSaveUser` (Edit user writes a visiting member's line manager to the record; the users document is not written for it), `completeInviteSetup` (the record in the accept batch for an existing account from another company). `applyDeviceOrgMembership` is unchanged from 1.87.0. Functions: `reportIntegrity.js` and `timesheetSignOffReminder.js` read the record.
- Owner bug 24 Nov (same version): one line-manager answer on every screen — web's profile page reads `lineManagerSummary` (it read only the legacy single id on the folded roster) and web / iOS Edit user read `lineManagerSelectedIds` over the unfolded roster; stored `hasNoLineManager` beside ids reads "No line manager" everywhere and a save writes the group together. Web `displayedLineManagerId` removed.
- Security rules: the `memberLineManagers` write rule; `lmData` (home users document, else the record, else none) in `callerLineManagesUser`, `callerLineManagesRowPerson`, `tsReviewer`, `hbCanDecide` and `canViewPayOfAsMember`; the membership read and write rules exactly as 1.87.0; `storage.rules` `callerLineManagesUser` reads the record. Compile cost paid for by single-use helpers folded into their one caller (no allow / deny change; Deploy notes 1.88.0). New emulator suite `tests/orgLineManagers.rules.test.ts`; `tests/storage.rules.test.ts` case.

## iOS work for 1.88.0

Built in iOS PR #303 on branch `ios-1.87-org-line-managers` (rulebook 1.88.0; the branch name predates the renumber). **It must move from the membership to the record before merge** (review of #455, fix (a), owner decision 24 Nov): the company's line manager for a visiting member is `organizations/{orgId}/memberLineManagers/{uid}` (only `assignedManagerUserIds`, `assignedManagerUserId`, `hasNoLineManager` plus `updatedAt` / `updatedBy` / `updatedFrom`), never `users/{uid}/orgMemberships/{orgId}.lineManager`. The rules refuse a `lineManager` key on a membership write and refuse a co-member's membership `get`. Calls through `CanonicalBusinessEngine` only:

1. `Project Planner/Core/Rulebook+OrgLineManagers.swift` — wrappers take `record:` (was `membership:`) for `organizationLineManagerFields` / `withOrganizationLineManager`; `orgLineManagerEditTarget` now answers `users` / `record` / nil; add wrappers for `memberLineManagerWriteFields`, `parseMemberLineManagerDocuments`, `MEMBER_LINE_MANAGERS_COLLECTION`. Removed from the script: `ORG_MEMBERSHIP_LINE_MANAGER_FIELD`, `ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE`, `orgMembershipLineManagerFields`, `invitationLineManagerMap` (use `invitationLineManagerRecord`); `parseOrgMembershipDocument` no longer returns `lineManager`; `orgMembershipWriteFields` ignores `next.lineManager`.
2. `Project Planner/Core/UserStore.swift` — replace `scheduleLineManagerMemberships()` / `readOrgMembershipForLineManager` (one membership read per visiting member) with ONE snapshot listener on `organizations/{orgId}/memberLineManagers` for the open company (every active member may read it), removed on a company switch or sign-out; lay each record over the roster with `OrgLineManagerOverlay` (`parseMemberLineManagerDocuments`, keys lower-case users ids). Edit user (`updateOperativeProfileFields`): when `orgLineManagerEditTarget` is `record`, `setData` the whole `memberLineManagerWriteFields(...)` result plus `updatedAt: FieldValue.serverTimestamp()` on `organizations/{orgId}/memberLineManagers/{uid}` in the same batch as the profile write (review finding 5: one batch), never the users document's line manager and never the membership. Drop the "no membership" refusal (a members-map-only member can be given one now).
3. `Project Planner/Core/FirebaseBackend+OrganizationMembership.swift` — the session profile in another company takes the signed-in person's own record (`organizations/{orgId}/memberLineManagers/{uid}`, from the same listener or one `getDocument`) through `withOrganizationLineManager(record:homeOrganizationId:)`; never the membership. Remove `readOrgMembershipForLineManager`.
4. Any iOS invite-accept path into another company (if one exists): write `inviteMembershipWrites(...).lineManagerRecord` to `organizations/{orgId}/memberLineManagers/{authUid}` in the same batch as the membership, the `members.{uid}` entry and the invitation mark-used (the rules accept it only there, exactly as the invitation stores it). iOS sends invitees to the web link today, so likely nothing to do.
5. `ProjectPlannerTests/OrgLineManagersTests.swift` — the record replaces the membership map in every case; add: a membership `lineManager` map is ignored; no record → users document shown.
6. `AppUser.orgLineManagerOverlay` (`AppModels.swift`) stays.

Sync the packed rulebook with `scripts/sync-rulebook-from-web.sh` (packed sha256 in `docs/ios-handoff/LATEST.md`). Not changed: the Edit user picker itself (saves through item 2).

## New rulebook sections

- 1.88.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

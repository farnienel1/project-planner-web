# iOS follow-on — rulebook 1.34.0

Generated 2026-11-10 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.33.1 → 1.34.0
Packed hash: 44c4fab397a663348f6aea04d28d82351a4f51fcb9844c210aa5b86ce7b99c29
Rulebook sha256: 01c857dbdce04127751200d6ad474b8ff97f7488507e6332358502393f76b77c
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD, GHOST_ACCOUNTS_SWITCH_FIELD, GHOST_BADGE_LABEL, GHOST_CHECK_ISSUE_LABELS, GHOST_CREATE_REFUSED_MESSAGE, GHOST_EMAIL_REFUSED_MESSAGE, GHOST_FIELD, GHOST_INVITED_BADGE_LABEL, GHOST_INVITE_EMAIL_HINT_FIELD, GHOST_LINE_MANAGER_INVALID_MESSAGE, GHOST_LINE_MANAGER_REQUIRED_MESSAGE, GHOST_NAME_REQUIRED_MESSAGE, GHOST_OPERATIVE_EXPLANATION, GHOST_PHONE_REFUSED_MESSAGE, GHOST_RATE_REQUIRED_MESSAGE, GHOST_TOGGLE_HELP, GHOST_TOGGLE_LABEL, GHOST_UPGRADE_HELP, GHOST_UPGRADE_LABEL, GHOST_UPGRADE_REFUSAL_MESSAGES, INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS, PAYRUN_SNAPSHOT_GHOST_CELL, canBookLeaveFor, canCreateGhost, canUpgradeGhost, ghostAccountsEnabled, ghostAddFormRows, ghostBadgeLabel, ghostConversionCandidates, ghostConversionWrites, ghostCreateError, ghostCreateWrites, ghostLeaveBooking, ghostPermissions, ghostRate, ghostToggleVisible, ghostUpgradeRefusal, ghostUpgradeWrites, ghostsToCheck, inviteAcceptPlaceholderFields, isGhostInvited, isGhostUser, personDedupeKey
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/cross-platform-contract.json, lib/canonical/ghostOperatives.test.ts, lib/canonical/ghostOperatives.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/notificationRecipients.ts, lib/canonical/payeOvertime.ts, lib/canonical/payrunSnapshot.ts, lib/canonical/peopleDocuments.ts, lib/canonical/platformConfig.ts, lib/canonical/userDelete.ts, lib/canonical/userProfile.ts, lib/canonical/userRosterSegment.ts, lib/canonical/userTimesheetAccess.ts, lib/canonical/warningRows.ts
Done when:
- [ ] Packed hash in iOS equals 44c4fab397a663348f6aea04d28d82351a4f51fcb9844c210aa5b86ce7b99c29
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 01c857dbdce04127751200d6ad474b8ff97f7488507e6332358502393f76b77c)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.34.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.34.0

- **Ghost operatives** (§11, owner design 6 Nov "ghost: all recommended", answers rounds 1–2; new `lib/canonical/ghostOperatives.ts`): a bookable operative with no app login — no email, no phone; a `users/{id}` document with `ghost: true`, `passwordSet: false`, `email: ''`, the operative level, self-employed, a day or hourly rate above 0 and a line manager. Added by admins and Operatives managers (`canCreateGhost`, `ghostCreateError`, `ghostCreateWrites`) from a **Ghost account** toggle at the top of Add user / Add new operative (`ghostAddFormRows`, `GHOST_OPERATIVE_EXPLANATION`); the admins are told (`operative_created` / `operative_deleted`). New: `isGhostUser`, `isGhostInvited`, `ghostBadgeLabel` / `GHOST_BADGE_LABEL`, `personDedupeKey`, `canBookLeaveFor`, `ghostLeaveBooking`, `canUpgradeGhost`, `ghostUpgradeRefusal`, `ghostUpgradeWrites` (admin-only Give app access, owner option 1), `inviteAcceptPlaceholderFields` / `INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS`, `ghostConversionCandidates`, `ghostConversionWrites` (owner-run `scripts/convert-no-login-operatives-to-ghosts.mjs`, Q-G2), `ghostsToCheck` (Data health).
- Changed for ghosts: `rosterSegment` / `isIdentifiablePendingLeftover` (never Pending or a leftover), `parseUserDocument` and `USER_DOCUMENT_FIELDS` (`ghost`, `inviteEmailHint`; contract regenerated), `unbookedLabourRows` (a ghost counts as signed up; people with no email are one row each and inactive ones are skipped; an `operatives` row whose id is a person's id is that person, so a converted ghost's leave and exclusion cover its row), `unverifiedOperativeRows`, `timesheetDaysForPerson` / `showsMyTimesheets` / `timesheetParticipant`, `userTimesheetSubjects`, `exportedTimesheetHistorySubjects`, `overtimeUserSubjects`, `notificationRecipientAccountId` / `excludeActor` (never a ghost), `userDeleteWrites` (unchanged plan: the review fix removed the ghost short-cut, so tax ids, membership and a listed `members` entry are always removed), `payrunSnapshotRows` (grey "No app login", `PAYRUN_SNAPSHOT_GHOST_CELL`), `inviteAcceptWrites` (`dropPlaceholderFields`).
- Fixes found on the way: pickers and web's annual-leave people list folded people on the email alone, so only the first person with no email was offered (`personDedupeKey`); web Edit User pooled the rate history of everyone with an empty email.
- **Security rules** (§16): R1 — an Operatives manager never changes a ghost's line manager; R2 — a ghost's line manager gets no overtime booking write on it; review fix — nobody sets `ghost` or `inviteEmailHint` on their own users document (update or self-create). Static compile cost 237,518 → 237,676 (on 1.33.0 with its review fixes) → 237,748 with the review fix; 142,948 → 143,099 → 143,357 bytes. Merged onto 1.33.1 (10 Nov): 236,475 → 236,705; 142,916 → 143,325 bytes.
- Review fixes: `isGhostUser` is the boolean `true` only; `ghostConversionWrites` takes the organisation's `roster` and refuses a line manager `lineManagerCandidates` does not offer.
- Emulator finding (not a rules change): the Firestore emulator (1.22.0) crashes on an Operatives manager's users create that carries `isSuperAdmin: false` or no `email` key, so a ghost is written with `email: ''` and no `isSuperAdmin` key. Web Add user's invite placeholder carries `isSuperAdmin: false` (`invitePlaceholderUserWriteFields`); whether production shares the crash is unknown (follow-up).
- **Ghost account toggle hidden until the iPhone update is out** (owner decision 7 Nov "1b", §11, §18): new `platformConfig/app` switch `ghostAccounts` / `ghostAccountsOrganizationIds` (`ghostAccountsEnabled`, `GHOST_ACCOUNTS_SWITCH_FIELD`, `GHOST_ACCOUNTS_ORGANIZATION_IDS_FIELD`); `ghostToggleVisible({ canCreateGhost, ghostAccountsEnabled })` and `ghostAddFormRows` take it (missing = off), so both apps show the toggle only while it is on. `canCreateGhost` stays the permission. Existing ghosts are unaffected. UI gate only: no `firestore.rules` change.
- Wording fix: the 1.32.4 Deploy notes functions command now names the `inbox-push` codebase (`functions:inbox-push:<name>`); `functions:authClaimsOnUserWrite` gave "No function matches given --only filters".

## iOS work for 1.34.0

**Sync first, then ship the iOS work in the same release.** 1.34.0 adds ghost operatives (rulebook §11): `users/{id}` documents with `ghost: true`, `passwordSet: false`, `email: ''`, the operative level, self-employed, a rate and a line manager. Today iOS drops them (`parseAppUserDocument` needs an email) and defaults a missing `passwordSet` to true (`FirebaseBackend.swift` ~4304). The owner raises `minimumIosBuild` to the iOS 1.34 build (Deploy notes 1.34.0, step 4).

Every rule goes through `CanonicalBusinessEngine`; no Swift copy of any rule.

1. **Read ghosts** — `AppUser.isGhost` / `inviteEmailHint` from `parseUserDocument` (`ghost`, `inviteEmailHint`); `parseAppUserDocument` accepts a ghost with `email: ''`; never default `passwordSet` to true for a ghost. Pass `ghost` through the six AppUser → canonical serialisers (`Core/WarningsComputation.swift` ~284 / ~847 / ~1066 / ~1282, `Core/Rulebook+LineManagers.swift` ~92, `Core/Rulebook+NotificationRecipients.swift` ~194, `Core/Rulebook+PeopleHome.swift` ~33) and to `timesheetParticipant` / `userTimesheetSubjects` / `exportedTimesheetHistorySubjects` (`UserTimesheetAccessRulebook`), `overtimeUserSubjects`, `payrunSnapshotRows` (`Views/WeeklyReportView.swift`, `Views/PayrunSnapshotView.swift`).
2. **Add a ghost** — `Views/AddUserView.swift`: the **Ghost account** toggle at the very top (`GHOST_TOGGLE_LABEL`, `GHOST_TOGGLE_HELP`, expandable `GHOST_OPERATIVE_EXPLANATION`), fields from `ghostAddFormRows({ ghost, canCreateGhost, ghostAccountsEnabled })`, shown only when `ghostToggleVisible` — `canCreateGhost` **and** `ghostAccountsEnabled(platformConfig/app, organizationId)` (owner decision 7 Nov "1b": hidden until the platform owner sets `ghostAccounts` true after `minimumIosBuild` is raised; read from the `platformConfig/app` document the app already reads for the security switches); save `ghostCreateWrites` (check `ghostCreateError`; the write has no `isSuperAdmin` key and `email: ''` — keep it exactly), then `operative_created` to the admins (`Core/NotificationService.swift`). `Core/UserStore.swift` `createGhost` / delete (`userDeleteWrites` with `ghost`; write `operative_deleted`, missing today). Retire `CreateOperativeView` (`Views/HomeView.swift` ~148) and `AddOperativeView` (`Views/OperativesView.swift` ~791) — both write no-login `operatives` rows; open Add user with the toggle on instead.
3. **Pickers fold on `personDedupeKey`** (the dedupe bug: only the first no-email person was bookable) — `Core/ScheduleBookingConflictSupport.swift` (`ScheduleBookablePersonBuilder.build`, `seenEmails` gets ""), `Views/BookLabourFlowView.swift`, `Views/ScheduleQuickAddSheet.swift`, `Core/ScheduleWeekGrid.swift`, `Views/ScheduleOperativeView.swift`, `Views/SelectOperativesView.swift`, `Views/ProjectActiveOperativesView.swift`; annual leave people (`Views/OperativeAnnualLeaveViews.swift`, `Core/HolidayStore.swift`, `Views/HolidayReportView.swift`). Badge `ghostBadgeLabel` on rows (`Views/OperativesView.swift`, `Views/ManageUsersView.swift`).
4. **Warnings, Daily Overview, Home** — `Core/WarningsComputation.swift`, `Views/DailyOverviewView.swift`, `Views/HomeView.swift`: pass `ghost` to `unbookedLabourRows` / `unverifiedOperativeRows`; the Home repair link (~1870) must not create an `operatives` row for a ghost.
5. **Leave** — booking a ghost's leave: `canBookLeaveFor` / `ghostLeaveBooking` (its line manager or an admin; saved approved; no notice).
6. **Manage Users** — `Views/ManageUsersView.swift`: for a ghost hide email, phone, password reset / sign-up email, employment type, timesheets and Change user type; line manager read-only for an Operatives manager (rules R1); admins get **Give app access** (`canUpgradeGhost`, `ghostUpgradeRefusal`, `ghostUpgradeWrites`, the same email check as Add user, then the usual set-up email). iOS has no invite-accept flow (the web link does it; `inviteAcceptPlaceholderFields` drops the ghost markers).
7. **Operative rows** — `Core/OperativeStore.swift`: a converted ghost keeps its `operatives` row under the same id (`linkedUserId` = that id, email cleared); treat it as the ghost, not a separate person.
8. **Claims function** (1.32.4 auth claims): a ghost has no Firebase Auth user; web `functions/authClaims.js` already skips it (`no-auth-user`). Nothing to do on iOS.
9. **Review fixes (same 1.34.0 rulebook, re-sync)** — `isGhostUser` is the boolean `true` only (as the rules): `AppUser.isGhost` must read `ghost == true` (Bool), never `1` / `"true"`. `userDeleteWrites` no longer skips anything for a ghost: the account step always holds the users document, tax ids and membership deletes, the email claim when there is an email, and `members.{uid}` when `listedInMembers` — run the plan as returned (no Swift branch on `ghost`). `unbookedLabourRows` reads an `operatives` row whose id is a person's id as that person (no Swift change; pass the rows as today). `ghostConversionWrites` takes an optional `roster` (script only). Never write `ghost` or `inviteEmailHint` on the signed-in user's own users document (the rules refuse it).

## New rulebook sections

- 1.34.0 — 2026-11-10

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

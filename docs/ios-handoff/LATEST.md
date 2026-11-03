# iOS follow-on — rulebook 1.23.1

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.23.0 → 1.23.1
Packed hash: c31c421bcbbd33ab0c7016c6ddbf86dedf5560cf8241430ff2811209c2ac8261
Rulebook sha256: d7182a37f2e5fd38def1f6f4c22c857e9eceef1af13792dd0b7fa4804fdead43
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: USER_MISSING_LEVEL_MESSAGE, bookingStandardDayOn, userMissingLevel, usersMissingLevel
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingLeaveConflicts.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/leaveCoverage.ts, lib/canonical/parity-fixture.json, lib/canonical/payrollPolicySchedule.ts, lib/canonical/rosterLists.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetLines.ts
Done when:
- [ ] Packed hash in iOS equals c31c421bcbbd33ab0c7016c6ddbf86dedf5560cf8241430ff2811209c2ac8261
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d7182a37f2e5fd38def1f6f4c22c857e9eceef1af13792dd0b7fa4804fdead43)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.23.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.23.1

- Owner decisions on 1.23.0: a person with no level flag is on Managers (1A) and their clashes stay High (2A). Web no longer sets `manager: true` from a `managers` row (3A, `withManagerListHint` removed from the roster store), so web and iOS follow one list rule (§11).
- Every user is created with a level (owner): `userMissingLevel`, `usersMissingLevel`, `USER_MISSING_LEVEL_MESSAGE`; Settings → Data health lists people with none, each linked to Manage Users. Add User / re-invite refuses an invite with no level (§11).
- Weekend named slots (§5, §8): a Saturday or Sunday Full day / AM / PM with no clock times is that day's own window (`weekendFullDayWindow`) and lunch break for clashes, the overlap flag, leave cover and booking conflicts (`bookingStandardDayOn`), never the weekday day. Pay is unchanged (`payrollHoursResult` already used the weekend window).
- One clash rule for every booking flow (§5): Book labour, the Daily Overview booking sheet, Quick Add and booking edit use `bookingRequestClashIds` on the booked day's working hours, as the Schedule wizard does since 1.23.0.
- Setup wizard (§4.3): the working hours are checked with `validatePayrollTimePolicy`, weekend breaks included, before the step and setup finish.
- iOS hand-off: `Core/ScheduleBookingConflictSupport.swift` / `Models/OperativeBookingInterval.swift` (a weekend named slot is `bookingStandardDayOn`'s window — call `bookingRequestClashIds` and pass the policy state); create paths to confirm always write a level — `FirebaseBackend.swift` `signUp` (~700, write ~793), `createOrganization` (~4883), `createUserInvitation` (~7035, placeholder ~7408) and `Core/UserStore.swift` `acceptInvitation` (~1807); refuse an invitation with no level (`userMissingLevel`); `Models/AppModels.swift` `placedByManagersRecord` must not set the manager flag or a list.

## iOS work for 1.23.1

Every item below: call the named function through `CanonicalBusinessEngine`, delete the Swift copy, and keep the screen. Line numbers are at iOS `origin/main` a89f721 (approximate).

### 3-factor check (web / iOS / shared rule)

| Item | Web (this release) | iOS today → what to change | Shared rule | Until iOS ships |
|---|---|---|---|---|
| People lists (finding 9; owner 1A, 3A) | `lib/staff/userRosterUtils.ts` `getOperativeModeUsers` / `getManagersRosterUsers` call `rosterListFor`; 1.23.1: `withManagerListHint` removed from `lib/stores/siteAuditStore.ts`, so a `managers` row never sets `manager: true` | `Models/AppModels.swift:791-808` (`isRosterAdmin`, `appearsOnOperativesList` needs `operativeMode`, `appearsOnManagersList` uses `placedByManagersRecord`) → `rosterListKind(row)` per user and `rosterListFor(kind, roster, claimedEmails)` for each list; pass the stored `role` (null when missing, never a decoded default); stop using `placedByManagersRecord` for list membership | `rosterListFor`, `rosterListKind` — §11 | A user with no level flag and no `managers` row is on web Managers and on no iOS list. A role-`operative` user with no flags is on web Operatives; iOS lists them nowhere (or on Managers through a `managers` row). |
| Clash High / Medium (finding 20; owner 2A: flagless stays High) | `lib/scheduling/bookingClashUtils.ts` `clashManagerIdsForUsers` → `clashManagerIds` (warnings and weekly report) | `Core/WarningsComputation.swift:501-505` `managerOrAdminUsers` → `clashManagerIds(roster)` with `isActive`, `role`, `isSuperAdmin`, `adminAccess`, `manager` | `clashManagerIds` — §5 | None: same rule both sides. |
| Home figures (finding 12) | `lib/home/overviewMetrics.ts` `computeHomeOverviewMetrics` → `homeOverviewMetrics` with the organisation zone | `Views/HomeView.swift:2125-2229` `HomeOverviewMetrics.compute` (device `Calendar.current`, raw ids) → `homeOverviewMetrics({ nowMs, timeZone, viewer, roster (with formerUserIds / sameEmailUserIds), operatives, managers, tasks, bookings, managerSiteBookings, holidays (parsed day keys) })`; keep `liveProjectCount` from `activeJobsCount` | `homeOverviewMetrics` — §23 | iOS figures can be higher (one person under two ids, or on both a labour and a manager booking, counted twice) and use the device day; web counts each person once on the organisation day. |
| Qualification count (finding 16) | No web screen shows this count (nothing to wire) | `Navigation/MainMenuCatalog.swift:524-534` and `Views/HomeView.swift:1503-1517` (device day, 30 days, inactive included) → `qualificationExpiryCount({ referenceIso, timeZone, operatives })`, with `operativeIds` of the signed-in operative on Home | `qualificationExpiryCount` — §5 | iOS-only number; no web equivalent to disagree with. |
| Site map (finding 17) | `app/dashboard/site-map/page.tsx` → `siteMapPins` (cancelled excluded, organisation day); `lib/site-map/siteDayBookings.ts` deleted | `Views/OrgSitesMapView.swift:191-208` (device day, `status != .cancelled`) → `siteMapPins({ jobs, bookings, managerSiteBookings, dayKey, timeZone, people })`, default day `dayKeyInOrganizationZone` | `siteMapPins` — §21 | Same pins; web stopped counting cancelled bookings (iOS already did). Day differs only for a phone outside the organisation zone. |
| Tasks overdue, deadline urgency (finding 18) | `lib/tasks/projectTaskFilters.ts`, `lib/tasks/taskUtils.ts` → `isTaskOverdue`; `lib/deadlines/logic.ts` → `deadlineUrgency` / `dueDayKey` | `Views/TasksDetailView.swift:756-759` `isOverdue`; `Views/DLModels.swift:274-292` `daysRemaining` / `urgency` (device calendar) → `isTaskOverdue`, `deadlineDaysRemaining`, `deadlineUrgency` | `isTaskOverdue`, `deadlineUrgency` — §23 | Differs only when the phone is outside the organisation zone, around midnight. |
| Leave calendar (finding 19) | `lib/annualLeave/dayStatus.ts` → `leaveDayKind` | `Views/OperativeAnnualLeaveViews.swift:1124-1150` `dayKind` → `leaveDayKind(records, dayKey, timeZone, bankHolidayKeys)`; stop skipping approved leave with `cancellationRequestedAt` | `leaveDayKind` — §9 | Web now leaves weekends inside a multi-day record blank (iOS already did). iOS still hides approved leave with a pending cancellation; web shows it approved. |
| Variations (finding 21) | `lib/variations/variationFallback.ts` → `mergeVariationSources`; `components/projects/ProjectWorkspaceChrome.tsx` → `openVariationCount` | `Core/FirebaseBackend+Variations.swift:545-559` and `:379-380` → `mergeVariationSources` (rows with `updatedAtMs`) and `openVariationCount` | `mergeVariationSources`, `openVariationCount` — §22 | None in practice (web now also matches ids without case). |
| Job tile badges (finding 22) | `lib/projects/activeUsers.ts` `countProjectActiveUsers` → `jobTileBadges(...).activeUsers` (people folded); open tasks on the job pages → `jobTileBadges(...).openTasks` | `Views/ProjectDetailView.swift:420-426` (Tentative, open tasks) and `:553-575` `activeBookedPeopleCount` (raw ids, summed) → `jobTileBadges({ jobId, bookings, managerSiteBookings, subcontractorBookings, tasks, people })` | `jobTileBadges` — §21 | iOS Active users can be higher by the people it counts twice. Web shows no Scheduling badge (unchanged). |
| Per-day hours: overlap flag, clashes, leave cover (older gap a) | `lib/timesheets/timesheetPayrollCollector.ts`, `lib/warnings/generateOrgWarnings.ts`, `lib/warnings/managerClashWarnings.ts`, `lib/scheduling/bookingClashUtils.ts`, `lib/warnings/leaveCoverageWarnings.ts`, `lib/weekly-report/weeklyReportData.ts` pass the working-hours state | `Core/TimesheetPayrollCollector.swift:234-238` (`CanonicalStandardDayInput(policy:)`), `Core/WarningsComputation.swift` ~1444-1454 (leave cover `day`) and ~1778 (clash payload `day`) → pass the policy state (the same object `unbookedLabourRows` gets) | `standardDayOn` inside `overlappingBookingIds`, `managerClashGroups`, `operativeClashGroups`, `leaveCoverageRows` — §5, §8 | Only for a period that spans a working-hours change, and only for Full day / AM / PM bookings: web flags or warns on the day's own hours, iOS on today's. The amber overlap flag never changes pay. |
| Booking being made (older gap b) | Every booking flow → `bookingRequestClashIds` + `bookingLeaveConflicts` with the state: Schedule wizard (`lib/scheduling/draftProjectBooking.ts`), and 1.23.1 Book labour (`components/book-labour/BookLabourFlowScreen.tsx` `clashIdsOnDay`), Daily Overview sheet, Quick Add and booking edit (`components/scheduling/useLeaveConflictCheck.ts` `clashRowsFor`, which loads the state itself) | `Views/SelectOperativesView.swift:41-43` (today's policy) and `Core/ScheduleBookingConflictSupport.swift:375` `OperativeBookingInterval.bookingsOverlap` → `bookingRequestClashIds({ request, existing, day: state })` per booked day; `bookingLeaveConflicts` with `day: state` | `bookingRequestClashIds`, `bookingLeaveConflicts` — §5 | Web Schedule wizard now only lists real time overlaps (before: any Full day, or custom against AM/PM, was a clash). iOS Select Operatives reads today's hours for a day after a change. |
| Setup wizard weekend breaks (older gap c) | `components/setup/WorkingHoursSetupSection.tsx` Saturday / Sunday Paid / Unpaid, length, start, end (15-minute steps); 1.23.1 `components/setup/OrganisationFeaturesStep.tsx` runs `validatePayrollTimePolicy` (`lib/orgSetup/orgSetupSettings.ts` `orgSetupWorkingHoursError`) on leaving the step and before setup completes | iOS has no setup wizard working-hours screen of its own in this audit; nothing to change | `weekendBreakFor`, `weekendLunchBreakCopy`, `payrollBreakTimeOnStep` — §4.3 | A new company can choose an unpaid weekend break on web at setup; iOS builds from 1.19.0 price it. |
| Weekend named slots (1.23.1) | Every scan and booking check reads a Saturday / Sunday Full day / AM / PM through `bookingStandardDayOn` (that day's `weekendFullDayWindow` and lunch break) | `Models/OperativeBookingInterval.swift` / `Core/ScheduleBookingConflictSupport.swift:375` measure a weekend Full day on the weekday standard day → pass the policy state to `bookingRequestClashIds`, `overlappingBookingIds`, the clash groups and leave cover, and delete the Swift interval code | `bookingStandardDayOn` — §5, §8 | A Saturday Full day against Saturday custom hours outside the window: web shows no clash or overlap, iOS still does. |
| Users with no level (1.23.1, owner) | Settings → Data health lists `usersMissingLevel` ("Has no user level: open in Manage Users and pick one", linked); Add User / re-invite refuse an invite with no level (`lib/orgSetup/inviteUserCore.ts:157` `inviteLevelError`). Web create paths, all writing a level: Add User / re-invite `components/users/AddUserScreen.tsx:325`, `ManageUsersScreen.tsx:220`, `EditUserProfile.tsx:726` → `inviteUserCore` (guard) → `lib/firebase/userPayload.ts:223` `buildInvitedUserPayload`; invite accept `lib/invites/completeInviteSetup.ts:163` (`invitationProfileFields`, the invitation's level) and `:187` (membership with the invitation's role); guided setup `lib/orgSetup/createOrganization.ts:295,320` (`role: 'admin'` + `founderPermissionFields`); self sign-up `lib/stores/authStore.ts:933` (`role: 'admin'`, `isSuperAdmin`, `adminAccess`); platform owner `lib/platform/ownerProfile.ts:31` (`role: 'admin'`) | Confirm each iOS create path writes a level and refuses one without: `FirebaseBackend.swift:700` `signUp` (write ~793), `:4883` `createOrganization`, `:7035` `createUserInvitation` (placeholder ~7408) → refuse with `userMissingLevel`; `Core/UserStore.swift:1807` `acceptInvitation`. `placedByManagersRecord` (`Models/AppModels.swift`) must not set a list or the manager flag | `userMissingLevel`, `usersMissingLevel`, `USER_MISSING_LEVEL_MESSAGE` — §11 | iOS shows no Data health list; nothing else differs. A flagless person with a `managers` row is no longer treated as a manager on web (pickers, Daily Overview labour kind) — as on iOS today. |
| Push tokens on sign-out (§13 text) | Rulebook text only | Done in iOS PR #166 (`FirebaseBackend.signOutRemovingPushToken`) | `pushTokenSingleOwner` (server) — §13 | None. |

Swift tests: add `ProjectPlannerTests` cases calling each function above through `CanonicalBusinessEngine`; the 1.23.0 cases in `CanonicalParityFixture.json` must pass.

## New rulebook sections

- 1.23.1 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

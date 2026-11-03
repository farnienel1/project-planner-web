# iOS follow-on — rulebook 1.23.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.22.0 → 1.23.0
Packed hash: b29657bd4b510215f695c8e58af06c38669c3b13940f9cc805e2f69067a331c2
Rulebook sha256: 5a31f901744a2681548a09b718c37aa1e45685edd518d804f5c3cdb811faae0a
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: addCalendarDayKeys, bookingRequestClashIds, calendarDaysBetween, clashManagerIds, deadlineDaysRemaining, deadlineUrgency, dueDayKey, homeOverviewMetrics, isPayrollTimePolicyState, isSiteLocationType, isTaskCompleted, isTaskOverdue, jobTileBadges, leaveDayKind, mergeVariationSources, openVariationCount, qualificationExpiryCount, rosterListFor, rosterListKind, siteMapPins, standardDayOn
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bookingLeaveConflicts.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/dueDates.ts, lib/canonical/homeOverview.ts, lib/canonical/index.ts, lib/canonical/jobBadges.ts, lib/canonical/leaveCalendar.ts, lib/canonical/leaveCoverage.ts, lib/canonical/parity-fixture.json, lib/canonical/payrollPolicySchedule.ts, lib/canonical/rosterLists.ts, lib/canonical/scheduleSources.ts, lib/canonical/timesheetLines.ts
Done when:
- [ ] Packed hash in iOS equals b29657bd4b510215f695c8e58af06c38669c3b13940f9cc805e2f69067a331c2
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5a31f901744a2681548a09b718c37aa1e45685edd518d804f5c3cdb811faae0a)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.23.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.23.0

- People, Home and per-day hours: the last audit gaps (findings 9, 12, 16–22) and the older one-standard-day gaps are shared rules; nothing changes in Firestore, the security rules or Cloud Functions.
- People lists (§11): `rosterListFor(kind, roster, claimedEmails)` / `rosterListKind` — each person is on exactly one list by level (`permissionLevelOf`): Admins (never Managers, admin role included), Operatives (operative mode or role), Managers (manager flag, manager role, or no level flag). A `managers` row never moves a person between lists. Web listed a flagless person on Operatives; iOS listed them nowhere unless a `managers` row placed them.
- High vs Medium clashes (§5): `clashManagerIds(roster)` — active admins and manager-flag people, the rule both apps used, written once.
- Home (new §23): `homeOverviewMetrics` on the organisation day, each person once under all their ids; people on site counted once when they have both a labour and a manager booking; leave by list (§11) and leave days (`leaveRecordDayKeys`). Tasks `isTaskOverdue`, deadlines `deadlineUrgency` / `deadlineDaysRemaining`, due dates `dueDayKey`, all on the organisation day.
- Qualification counts (§5): `qualificationExpiryCount` from `qualificationExpiryRows` (one calendar month, expired included), never a device 30-day window.
- Leave calendar (§9): `leaveDayKind` — leave days only (weekends and given bank holidays inside a multi-day record are not leave days), rejected never, a pending cancellation still approved, fixed order pendingFull > approvedFull > pendingHalf > approvedHalf.
- Site map, job tiles, variations (§21, §22): `siteMapPins` (cancelled never counts; organisation day), `jobTileBadges` (Tentative bookings, open tasks, active users each person once), `mergeVariationSources` (ids without case) and `openVariationCount`.
- Working hours by day (§5, §8): `overlappingBookingIds`, `managerClashGroups`, `operativeClashGroups`, `leaveCoverageRows` and `bookingLeaveConflicts` take the working-hours state and read each day's own standard day (`standardDayOn`); a booking being made is checked with `bookingRequestClashIds` under the booked day's hours (web Schedule wizard; iOS Select Operatives), never today's.
- Setup wizard (§4.3): Saturday and Sunday lunch break Paid / Unpaid, length, start and end, from `weekendBreakFor` on 15-minute steps; the Monday–Friday break length steps by 15 minutes.
- Push tokens (§13): every iOS sign-out, forced ones included, goes through one path (iOS PR #166, `FirebaseBackend.signOutRemovingPushToken`, 5-second bounded wait); a forced sign-out removes the token where the app is still signed in to do so, and a Firebase-initiated sign-out relies on `pushTokenSingleOwner`.
- iOS hand-off — each file calls the functions above through `CanonicalBusinessEngine` and deletes its own copy: `Models/AppModels.swift` (~791-808 `appearsOnOperativesList` / `appearsOnManagersList` / `appearsOnAdminsList` → `rosterListKind`, the lists → `rosterListFor`; `placedByManagersRecord` no longer decides a list); `Core/WarningsComputation.swift` (~501-505 `managerOrAdminUsers` → `clashManagerIds`; ~1444-1454 leave cover and ~1778 the clash payload `day` → the policy state); `Views/HomeView.swift` (~2125-2229 `HomeOverviewMetrics.compute` → `homeOverviewMetrics`; ~1503-1517 the 30-day count → `qualificationExpiryCount` with the operative's ids); `Navigation/MainMenuCatalog.swift` (~524-534 → `qualificationExpiryCount`); `Views/OrgSitesMapView.swift` (~191-208 device day and `status != .cancelled` → `siteMapPins` on `dayKeyInOrganizationZone`); `Views/DLModels.swift` (~274-292 `daysRemaining` / `urgency` → `deadlineDaysRemaining` / `deadlineUrgency`); `Views/TasksDetailView.swift` (~756-759 `isOverdue` → `isTaskOverdue`); `Views/OperativeAnnualLeaveViews.swift` (~1124-1150 `dayKind` → `leaveDayKind`; approved leave with a pending cancellation now shows as approved); `Core/FirebaseBackend+Variations.swift` (~545 `mergeVariationSources`, ~379-380 the open filter → `mergeVariationSources` / `openVariationCount`); `Views/ProjectDetailView.swift` (~420-426 and ~553-575 → `jobTileBadges`); `Core/TimesheetPayrollCollector.swift` (~234-238 `overlappingBookingIds` day → the policy state); `Views/SelectOperativesView.swift` (~41-43 today's policy) and `Core/ScheduleBookingConflictSupport.swift` (~375 `OperativeBookingInterval.bookingsOverlap`) → `bookingRequestClashIds` and `bookingLeaveConflicts` with the policy state.

## iOS work for 1.23.0

Every item below: call the named function through `CanonicalBusinessEngine`, delete the Swift copy, and keep the screen. Line numbers are at iOS `origin/main` a89f721 (approximate).

### 3-factor check (web / iOS / shared rule)

| Item | Web (this release) | iOS today → what to change | Shared rule | Until iOS ships |
|---|---|---|---|---|
| People lists (finding 9) | `lib/staff/userRosterUtils.ts` `getOperativeModeUsers` / `getManagersRosterUsers` call `rosterListFor` | `Models/AppModels.swift:791-808` (`isRosterAdmin`, `appearsOnOperativesList` needs `operativeMode`, `appearsOnManagersList` uses `placedByManagersRecord`) → `rosterListKind(row)` per user and `rosterListFor(kind, roster, claimedEmails)` for each list; pass the stored `role` (null when missing, never a decoded default); stop using `placedByManagersRecord` for list membership | `rosterListFor`, `rosterListKind` — §11 | A user with no level flag and no `managers` row is on web Managers and on no iOS list. A role-`operative` user with no flags is on web Operatives; iOS lists them nowhere (or on Managers through a `managers` row). |
| Clash High / Medium (finding 20) | `lib/scheduling/bookingClashUtils.ts` `clashManagerIdsForUsers` → `clashManagerIds` (warnings and weekly report) | `Core/WarningsComputation.swift:501-505` `managerOrAdminUsers` → `clashManagerIds(roster)` with `isActive`, `role`, `isSuperAdmin`, `adminAccess`, `manager` | `clashManagerIds` — §5 | None: same rule both sides. |
| Home figures (finding 12) | `lib/home/overviewMetrics.ts` `computeHomeOverviewMetrics` → `homeOverviewMetrics` with the organisation zone | `Views/HomeView.swift:2125-2229` `HomeOverviewMetrics.compute` (device `Calendar.current`, raw ids) → `homeOverviewMetrics({ nowMs, timeZone, viewer, roster (with formerUserIds / sameEmailUserIds), operatives, managers, tasks, bookings, managerSiteBookings, holidays (parsed day keys) })`; keep `liveProjectCount` from `activeJobsCount` | `homeOverviewMetrics` — §23 | iOS figures can be higher (one person under two ids, or on both a labour and a manager booking, counted twice) and use the device day; web counts each person once on the organisation day. |
| Qualification count (finding 16) | No web screen shows this count (nothing to wire) | `Navigation/MainMenuCatalog.swift:524-534` and `Views/HomeView.swift:1503-1517` (device day, 30 days, inactive included) → `qualificationExpiryCount({ referenceIso, timeZone, operatives })`, with `operativeIds` of the signed-in operative on Home | `qualificationExpiryCount` — §5 | iOS-only number; no web equivalent to disagree with. |
| Site map (finding 17) | `app/dashboard/site-map/page.tsx` → `siteMapPins` (cancelled excluded, organisation day); `lib/site-map/siteDayBookings.ts` deleted | `Views/OrgSitesMapView.swift:191-208` (device day, `status != .cancelled`) → `siteMapPins({ jobs, bookings, managerSiteBookings, dayKey, timeZone, people })`, default day `dayKeyInOrganizationZone` | `siteMapPins` — §21 | Same pins; web stopped counting cancelled bookings (iOS already did). Day differs only for a phone outside the organisation zone. |
| Tasks overdue, deadline urgency (finding 18) | `lib/tasks/projectTaskFilters.ts`, `lib/tasks/taskUtils.ts` → `isTaskOverdue`; `lib/deadlines/logic.ts` → `deadlineUrgency` / `dueDayKey` | `Views/TasksDetailView.swift:756-759` `isOverdue`; `Views/DLModels.swift:274-292` `daysRemaining` / `urgency` (device calendar) → `isTaskOverdue`, `deadlineDaysRemaining`, `deadlineUrgency` | `isTaskOverdue`, `deadlineUrgency` — §23 | Differs only when the phone is outside the organisation zone, around midnight. |
| Leave calendar (finding 19) | `lib/annualLeave/dayStatus.ts` → `leaveDayKind` | `Views/OperativeAnnualLeaveViews.swift:1124-1150` `dayKind` → `leaveDayKind(records, dayKey, timeZone, bankHolidayKeys)`; stop skipping approved leave with `cancellationRequestedAt` | `leaveDayKind` — §9 | Web now leaves weekends inside a multi-day record blank (iOS already did). iOS still hides approved leave with a pending cancellation; web shows it approved. |
| Variations (finding 21) | `lib/variations/variationFallback.ts` → `mergeVariationSources`; `components/projects/ProjectWorkspaceChrome.tsx` → `openVariationCount` | `Core/FirebaseBackend+Variations.swift:545-559` and `:379-380` → `mergeVariationSources` (rows with `updatedAtMs`) and `openVariationCount` | `mergeVariationSources`, `openVariationCount` — §22 | None in practice (web now also matches ids without case). |
| Job tile badges (finding 22) | `lib/projects/activeUsers.ts` `countProjectActiveUsers` → `jobTileBadges(...).activeUsers` (people folded); open tasks on the job pages → `jobTileBadges(...).openTasks` | `Views/ProjectDetailView.swift:420-426` (Tentative, open tasks) and `:553-575` `activeBookedPeopleCount` (raw ids, summed) → `jobTileBadges({ jobId, bookings, managerSiteBookings, subcontractorBookings, tasks, people })` | `jobTileBadges` — §21 | iOS Active users can be higher by the people it counts twice. Web shows no Scheduling badge (unchanged). |
| Per-day hours: overlap flag, clashes, leave cover (older gap a) | `lib/timesheets/timesheetPayrollCollector.ts`, `lib/warnings/generateOrgWarnings.ts`, `lib/warnings/managerClashWarnings.ts`, `lib/scheduling/bookingClashUtils.ts`, `lib/warnings/leaveCoverageWarnings.ts`, `lib/weekly-report/weeklyReportData.ts` pass the working-hours state | `Core/TimesheetPayrollCollector.swift:234-238` (`CanonicalStandardDayInput(policy:)`), `Core/WarningsComputation.swift` ~1444-1454 (leave cover `day`) and ~1778 (clash payload `day`) → pass the policy state (the same object `unbookedLabourRows` gets) | `standardDayOn` inside `overlappingBookingIds`, `managerClashGroups`, `operativeClashGroups`, `leaveCoverageRows` — §5, §8 | Only for a period that spans a working-hours change, and only for Full day / AM / PM bookings: web flags or warns on the day's own hours, iOS on today's. The amber overlap flag never changes pay. |
| Booking being made (older gap b) | Schedule wizard `lib/scheduling/draftProjectBooking.ts` / `bookingClashUtils.detectOperativeClashes` → `bookingRequestClashIds`; `bookingLeaveConflicts` with the state (`components/projects/scheduling/ScheduleOperativeForm.tsx`) | `Views/SelectOperativesView.swift:41-43` (today's policy) and `Core/ScheduleBookingConflictSupport.swift:375` `OperativeBookingInterval.bookingsOverlap` → `bookingRequestClashIds({ request, existing, day: state })` per booked day; `bookingLeaveConflicts` with `day: state` | `bookingRequestClashIds`, `bookingLeaveConflicts` — §5 | Web Schedule wizard now only lists real time overlaps (before: any Full day, or custom against AM/PM, was a clash). iOS Select Operatives reads today's hours for a day after a change. |
| Setup wizard weekend breaks (older gap c) | `components/setup/WorkingHoursSetupSection.tsx` Saturday / Sunday Paid / Unpaid, length, start, end (15-minute steps) | iOS has no setup wizard working-hours screen of its own in this audit; nothing to change | `weekendBreakFor`, `weekendLunchBreakCopy`, `payrollBreakTimeOnStep` — §4.3 | A new company can choose an unpaid weekend break on web at setup; iOS builds from 1.19.0 price it. |
| Push tokens on sign-out (§13 text) | Rulebook text only | Done in iOS PR #166 (`FirebaseBackend.signOutRemovingPushToken`) | `pushTokenSingleOwner` (server) — §13 | None. |

Swift tests: add `ProjectPlannerTests` cases calling each function above through `CanonicalBusinessEngine`; the 1.23.0 cases in `CanonicalParityFixture.json` must pass.

## New rulebook sections

- 23. Home, tasks and deadlines (1.23.0)
- 1.23.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.

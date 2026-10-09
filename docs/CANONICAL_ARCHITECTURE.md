# Canonical architecture

Web and iOS are separate repositories and separate languages. They share one executable business core. Screens, navigation, and platform persistence stay in each app.

## Paths

| Piece | Path |
|---|---|
| Canonical core | `project-planner-web/lib/canonical/` (`engine.ts` for windows, organisation, the standard day and its AM/PM halves, and slot intervals; `organizationSettings.ts` for org-wide defaults, payment-run field names, warningDetection, payroll, leave defaults, schedule options, and material cut-off; `warningRows.ts` for which qualification, unverified, and unbooked warnings exist and the qualification dismiss key; `leaveCoverage.ts` for annual leave against bookings; `staffAccess.ts` for who sees every job, every warning, and every variation, who may edit a work catalogue, and which managers receive a job notification; `userProfile.ts` for the `users/{uid}` document, employment-type day, and Edit User permission copy; `annualLeaveBalance.ts` for allowance vs year-count, the leave year, and a one-year remaining override; `materialSearch.ts` for catalogue search ranking; `qualificationSearch.ts` for organisation qualification library search and section chips) |
| Web consumption | Import `@/lib/canonical`. Existing modules such as `lib/warnings/warningLookahead.ts`, `lib/orgMembership/webActiveOrg.ts`, `lib/timesheets/timesheetWeekUtils.ts`, `lib/permissions.ts`, and `lib/access/workAccess.ts` call that module instead of keeping a second copy. |
| iOS consumption | `Project Planner/Canonical/canonical-business.js` is the bundle built from `lib/canonical/bundleEntry.ts`. `Project Planner/Canonical/CanonicalBusinessEngine.swift` evaluates it. Warning scans and invoicing defaults use that result, with `Europe/London` when the script cannot load. |
| Bundle command | `npm run build:canonical` in the web repo. `npm test` rebuilds it. |
| Backend | There is no Cloud Functions package. Firebase security rules are the server-side organisation boundary: `project-planner-web/firestore.rules` and `project-planner-ios/Project Planner/firestore.rules`. |
| Organisation context | `adoptCurrentOrganization` / `currentOrganizationId` in `lib/canonical/engine.ts`. The web auth store calls it when the signed-in company changes and on sign-out. iOS keeps the open company on `FirebaseBackend.currentOrganization`. Both compare ids with `organizationIdsMatch` (trim, then case-insensitive). |
| Architecture rules | `project-planner-web/AGENTS.md`, `project-planner-web/.cursor/rules/canonical-architecture.mdc`, and `project-planner-ios/AGENTS.md`. |

## What is shared

The canonical module owns:

- Organisation id matching and which company a session should open
- The in-process organisation epoch used to drop a late result after a switch or sign-out
- Invoicing-period bounds, including wrapped payment runs and short months
- Organisation settings defaults and Firestore field names (`organizationSettings.ts`): payment runs write **both** `startDay`/`endDay` (web) and `startDate`/`endDate` (iOS); empty ranges are 1–15 then 16–31; warningDetection is the top-level org map; payroll weekend hours use iOS field names
- Who sees variations (`canSeeVariations`): every admin and manager, never an operative
- Warning coverage windows (`numberOfDays`, full Monday–Friday week, invoicing period)
- Whether a person covers the organisation standard day (`standardDayCoverage`). A full day covers 07:30–16:00 minus the unpaid break. A shorter booking stays unbooked and the missing hours are the gap. Weekend days are included only when that toggle is on.
- Organisation time zone for those windows (default `Europe/London`, never the device zone)
- Named booking slots (`FULL DAY` / `FULL_DAY`, `AM`, `PM`) and their pay (`paidHoursForNamedSlot`)
- The standard day and its two halves (`standardDayWindow`, `halfDayWindows`), and the clock interval any booking occupies (`slotInterval`). See "Standard day, AM and PM" below
- Whether two minute intervals clash, and interval merge / subtract (`intervalsOverlap`, `mergeMinuteIntervals`, `subtractMinuteIntervals`)
- Cache key shape `kind:organizationId`
- Which qualification warnings exist, which operatives are unverified, and which people are unbooked labour (`qualificationExpiryRows`, `unverifiedOperativeRows`, `unbookedLabourRows`)
- Which annual-leave warnings exist: a booking inside approved leave, and a half day whose other half is not booked (`leaveCoverageRows`)
- The key a dismissed expired-qualification warning is stored under (`qualificationDismissKey`, `withoutDismissedQualificationRows`)
- Who sees every job and every warning, who may add or edit a work catalogue, and which managers receive a job notification (`seesEveryJob`, `canViewStaffWarnings`, `canEditWorkCatalogue`, `receivesJobNotification`)
- The `users/{uid}` fields both apps must keep in sync, when PAYE ↔ self-employed takes effect, and the Edit User permission list (`USER_DOCUMENT_FIELDS`, `employmentTypeOnDay`, `applyEmploymentTypeChange`, `MANAGER_PERMISSION_TOGGLES`)
- Whether a person has a paid allowance or only a year-count, the leave-year window, remaining days, and a one-year remaining override (`hasAnnualLeaveAllowance`, `leaveYearBounds`, `annualLeaveBalance`, `applyRemainingOverride`)
- Material catalogue search (`tokenizeMaterialSearch`, `materialSearchScore`, `rankMaterialRecords`). Every typed token must match name, brand, code, category, size or length as an exact, prefix, or contained piece, so `2.5mm LS` finds `2.5mm2 Twin & Earth … LSZH`. Empty query keeps the original order.
- Qualification library search and section chips (`tokenizeQualificationSearch`, `qualificationSearchScore`, `rankQualificationRecords`, `qualificationLibraryFilterChips`, `qualificationMatchesSection`). Every typed token must match name, code, awarding body, section, subsection or notes. Section chips come from the library `section` field (`QUALIFICATION_LIBRARY_SECTIONS`); All shows every row; Other is rows with no section. Search still runs when a section chip is on. Empty query keeps the original order.

## Staff visibility, catalogue toggles, and notification recipients

Each app resolves four flags for the signed-in account (super admin, admin, manager, operative mode) with its own user store and passes them to `staffAccess.ts`. On the web that is `staffAccountRole` in `lib/permissions.ts`; on iOS it is `UserStore`.

- Lists, warnings, and variations. Every admin and every manager sees every project, every small works job, every warning, and every variation in the company, including jobs and people they are not the project manager or line manager for. They can open those warnings and fix them. Neither list is narrowed to assigned jobs. On the web `visibleWorks` in `lib/access/workAccess.ts` returns the whole catalogue for staff; a manager still does not see a job an admin hid from them on the job's View tab (`hiddenManagerUserIds`). Operatives see only the jobs they are booked onto and never get the staff warning list or variations. An account with no staff role keeps the assigned-or-booked rule. `canSeeVariations` is the variation gate; tracker reorder stays admin-only (`canManageVariationTracker`).
- Projects and Small works toggles. The two toggles never hide a list. With a toggle off, an admin or manager still sees every job in that catalogue but cannot add or edit it: create and edit affordances are hidden or disabled (`canEditWorkCatalogue`, web `canManageWorkCatalogue`, and the `ProjectForm` gate for deep links). Super admin ignores both toggles.
- Notifications stay narrower. A manager receives a notification for a job or a person only as an assigned project manager of that job or as that person's line manager (`receivesJobNotification`). Admins and super admins receive it. Seeing the job in the list does not make a manager a recipient, so widening the lists must not widen fan-out. On the web the recipient rows are written with `userId` set (`lib/firebase/notifyInbox.ts`, `lib/variations/variationStorage.ts`, `lib/timesheets/timesheetNotifications.ts`), and `lib/stores/notificationStore.ts` shows a targeted row only to that user.

## Organisation settings document

`organizations/{orgId}` is the company settings record. Both apps read and write the same maps (`ORGANIZATION_DOCUMENT_FIELDS`). A save on one device must not drop fields the other still uses.

- Payment runs live on `invoicing.paymentRunDateRanges`. Each row writes **both** `startDay`/`endDay` and `startDate`/`endDate` with the same numbers. Read prefers `startDay` then `startDate`. Missing or empty ranges are 1–15 then 16–31 (`CANONICAL_HALF_MONTH_RANGES`). That split is what warnings use when the scan mode is end of invoicing period. A company that saved 1–16 / 17–31 keeps those days; do not silently rewrite them to 1–15.
- Warning detection is `organizations/{orgId}.warningDetection` (top-level, not `settings.warningDetection`). Default scan is `numberOfDays` = 7. The nested settings map may only fill excluded user ids when the top-level map left that key out.
- Payroll, annual-leave defaults, schedule options, and material cut-off parse/write through the same module. Material cut-off is company-wide on `settings.materialCutOff`; dual-writing the saver's user prefs must not become the source of truth.
- Operational collection paths (`OPERATIONAL_COLLECTION_PATHS`) stay iOS-compatible: variations collection plus settings fallback, H&S under `settings/healthSafety_…`, dismissed warnings, bookings, timesheets, tasks, site audits, clients, catalogues.

## User profile document

Every account is `users/{uid}`. Both apps read and write the same fields (`USER_DOCUMENT_FIELDS`). A save on one device must not drop fields the other device still uses.

- Account kind is `accountKindFromFlags`: super admin or admin access → admin; `operativeMode` → operative; otherwise manager.
- Employment type is `paye` or `self_employed` (`selfEmployed` on read is `self_employed`). Changing type asks which working day it starts. Immediate (or a date on/before today) writes the new type and clears the transition. A future date writes `employmentType` as the new type, `employmentTypeTransitionFrom` as the old type, and `employmentTypeEffectiveAt` as that day. `employmentTypeOnDay` is what timesheets and the weekly report use.
- Permission toggles on Edit User use `OPERATIVE_PERMISSION_TOGGLES` / `MANAGER_PERMISSION_TOGGLES` (order and copy). The flags themselves live on `users/{uid}.permissions`.
- Opening an operative from warnings or the roster is the same Edit User page (`/dashboard/users/{id}/edit?from=operatives`), not a second catalogue-only editor. Managers see every warning, but **Open operative** is hidden when their Operatives toggle is off — they cannot edit that profile. Admins who can manage users still see the button.
- `annualLeaveEnabled` is the paid-allowance toggle, not access to Holiday. Off (typical for self-employed staff without a set entitlement) still books leave. They see days taken in the company leave year (`annualLeaveBalance`); the count resets on the first day of the next year. On shows days per year and remaining. A mid-year joiner is set with `applyRemainingOverride` → `annualLeaveYearAllowance` + `annualLeaveYearAllowanceKey`. That remaining is for this leave year only and returns to Days per year after the year ends.

New organisations created on the web write the starter material catalogue into `organizations/{orgId}/materialCatalogue` and the starter qualification library into `organizations/{orgId}/qualifications`. The web also seeds an empty qualifications collection when the organisation list loads (`starterCollectionShouldSeed`). Both seeds skip when the collection already has a document (`starterCollectionShouldSeed` is true only for count 0). Never delete-all + rewrite. iOS reads those collections; it does not import the starter files again. Qualification templates always write `name`, `hasEndDate` (false on the library), `createdAt`, and `updatedAt`. Library rows also write `code` (document id), `section`, `subsection`, `awardingBody`, `level`, `renewYears`, `renewalType`, `status`, and `notes`. Assigned qualifications on an operative stay the existing iOS maps (`id`, `name`, `hasEndDate`, timestamps, optional `endDate`) plus `qualificationExpiryDates` and `qualificationCertificateURLs`. Seed the empty collection before restoring names from assignments, or those restored rows would block the library.

## What stays in each app

- SwiftUI and React screens, navigation, and copy
- Firestore listeners, offline outbox, and local databases
- Clash timeline math and the material cut-off message (`lib/warnings/generateOrgWarnings.ts` and `Core/WarningsComputation.swift`). Those dates use the London business calendar on iOS. A full-day slot with no clock times uses the organisation standard day for overlap (`07:30`–`16:00` by default), the same window as iOS `ManagerScheduleInterval` and `OperativeBookingInterval`. Two of those on one person and day are a clash. The unbooked-labour exclusion list does not hide that clash. AM and PM still do not overlap.
- Overtime and break payroll (`Core/PayrollHoursEngine.swift` and the web timesheet helpers that are not named slots)

Do not add a second coverage window, a second unbooked-person loop, a second `FULL DAY` hour value, or a second AM/PM midpoint.

## Standard day, AM and PM

One rule decides where the morning ends and the afternoon starts. Clash detection, annual-leave cover, the calendar export, Home "up next", Quick Add, and the iOS clash and leave scans all call `halfDayWindows(payrollTimePolicy)`.

1. The standard day is `[standardDayStart, standardDayEnd)`. An unparsable or inverted pair falls back to 07:30–16:00, so no setting can produce an empty or negative half. A break field the organisation never set falls back to 12:00–12:30 (`standardBreakWindow`); that is the unpaid break `standardDayCoverage` subtracts for unbooked labour, whether or not it also splits the day.
2. If the break window is valid, strictly inside the day, and leaves at least 60 minutes on each side, it is the split: AM = `[dayStart, breakStart)`, PM = `[breakEnd, dayEnd)`. The break belongs to neither half. Default company: AM 07:30–12:00, PM 12:30–16:00. 07:00–17:00 with a 12:30–13:30 break: AM 07:00–12:30, PM 13:30–17:00.
3. Otherwise the day splits at its wall-clock midpoint, floored to the minute. A company on 13:00–19:00 that left the break at 12:00–12:30 gets AM 13:00–16:00, PM 16:00–19:00. A break jammed against one edge (08:00–08:30) is ignored for the split for the same reason.
4. FULL DAY is the whole standard day. Custom hours are the clock times stored on the booking. Evening is the four hours after the day; overtime the two hours after that.
5. Pay is unchanged: FULL DAY pays `standardPaidHours`, AM and PM each pay half. The windows above decide clashes and cover, not money.

Because AM and PM are disjoint by construction, an AM booking never clashes with PM leave, and a PM booking never clashes with AM leave.

## Annual leave against bookings

`leaveCoverageRows` runs over the same coverage window as the other warnings and only looks at approved leave. Leave is FULL DAY, AM, or PM; anything else stored on a holiday document is treated as FULL DAY.

- **Booked during annual leave** (high). Any booking interval that overlaps the leave window. Full-day leave overlaps every booking that day. The row lists each booking and the overlapping minutes.
- **Half-day leave not covered** (medium). For AM or PM leave, the other half is the working half. Every booking interval that day is subtracted from it. Whatever is left is reported with clock ranges and hours. PM leave with a 07:30–09:30 custom booking on the default company reports "09:30–12:00 (2.5 hours) is not booked". No booking at all reports the whole half. The row respects `excludedUserIdsFromUnbookedWarnings` and `includeWeekendsForUnbookedLabour`; the clash row does not.

`unbookedLabourRows` already skips a person-day with any approved leave, so a half day produces exactly one warning: the cover row from this rule.

People are matched by account first (`userId`), then by any operative profile sharing the account's email. A roster operative without an account is matched by operative id.

## Dismissed warnings

An expired-qualification warning can be dismissed. The dismissal is `organizations/{orgId}/dismissedWarnings/{dismissKey}` where `dismissKey = qualificationDismissKey(operativeId, qualificationId, expiryDayKey)`. The key includes the expiry day, so saving a renewed certificate with a new date produces a fresh warning. Upcoming (not yet expired) rows are never hidden by a dismissal. Both apps read the collection and filter with `withoutDismissedQualificationRows`.

## Organisation context

One signed-in session has one current organisation id.

Web order, in `chooseSessionOrganization`: explicit switch, then the company this browser remembered (`pp.webActiveOrg:{userId}`), then `users/{uid}.organizationId`. A confirmed non-member is skipped. A slow read does not throw away the remembered company.

iOS stores the open company on the backend object and `cached_organizationId`. Membership still has to include that company. The browser and the phone may show different companies until the person switches on that device. Each device still has only one active company.

## Switching organisation

Switching is not a single assignment.

1. Membership in the destination company is checked before its data is shown.
2. `adoptCurrentOrganization` advances the epoch on web. iOS replaces `organizationSwitchToken` and removes the previous organisation listener.
3. A Firestore listener started for company A does not call the callback that now belongs to company B (`lib/firebase/subscribeOrgCollection.ts`).
4. `runOrgLoad` does not keep a successful cache entry when the epoch changed during the request.
5. Booking creates and edits do not write the response into the store when the epoch changed.
6. iOS `SmartCacheService` and `PersistenceService` key memory and UserDefaults by the current organisation id, and by user id. Signing out clears `cached_organizationId`.

## Firebase authorisation

`canAccessOrganization` is membership in that organisation (the user document, the members map, or the creator). On the web rules, the platform owner account is also allowed. An admin flag on the user document is not membership in every company. `organizationExists` is not access.

A signed-in user can still list organisation documents. The apps query that list with `members.{uid}` or `creatorUserId`. Tightening the list rule further has to stay compatible with those two queries. Subcollection reads and writes, and a direct read of another company's organisation document, are membership-scoped.

Other role gaps inside one company (for example who may edit settings) are listed in `project-planner-ios/app-tests/rules/firestore.rules.test.mjs`. Closing the cross-company hole does not by itself close those.

## Where new business logic goes

If both apps must agree, add the function under `lib/canonical/` (`engine.ts`, `organizationSettings.ts`, `warningRows.ts`, `leaveCoverage.ts`, `staffAccess.ts`, or `userProfile.ts`), export it from `lib/canonical/index.ts` and `bundleEntry.ts`, then call it from web and from `CanonicalBusinessEngine`. Committing that change packs the script. `.githooks/pre-commit` runs `npm run build:canonical`, stages `lib/canonical/dist/canonical-business.js`, and refuses the commit when the iOS checkout beside this repo has an uncommitted packed file. `npm install` turns the hook on. `npm run check:canonical` fails when a packed file does not match the rulebook.

## Agent windows

UI work can stay in one repository. Shared business rules cannot.

A window that only has the web repo may change screens and may change `lib/canonical`. A commit that touches `lib/canonical` packs the script and stages `lib/canonical/dist/canonical-business.js`. The pack is written to `Project Planner/Canonical/canonical-business.js` only when the iOS checkout is at `../project-planner-ios`, and the website commit is refused until that iOS file is committed. If that checkout is not there, commit the web packed file and copy it into the iOS repo in a change that has the iOS repo. Do not leave the phone running an older script.

A window that only has the iOS repo may change SwiftUI and data loading. Shared results come from `CanonicalBusinessEngine`. Do not edit `canonical-business.js` by hand, and do not add a second calculator for a rule the script already has. A new shared rule is added in the web `lib/canonical` module, the script is rebuilt, and both copies are committed.

A workspace with both repositories changes the TypeScript, rebuilds, and commits both generated scripts in the same phase.

## First divergences this architecture closes

Warning counts differed because the scan window was calculated twice, and because qualification, unverified, and unbooked rows were selected twice. Web used the organisation time zone. iOS used `Calendar.current`, so a person outside the UK could be on a different calendar day, and an empty payment-run list fell back to days 1–2 instead of the half-month default. The shared window and the shared row functions are the fix. The count is whatever those functions produce from the same data, settings, and time zone. It is not copied from one screen onto the other.

Bookings differed for the same reason when a listener for company A could still publish into the store after a switch to company B, and when local caches were not keyed by organisation.

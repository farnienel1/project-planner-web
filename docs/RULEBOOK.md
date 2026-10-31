# Project Planner Rulebook

Version: 1.0.0
Updated: 2026-10-31

This is the one rulebook for every Project Planner platform: web, iOS and (later) Android. It is written platform-neutral. Each rule names the shared function in `lib/canonical` that implements it; platforms call that function (web `@/lib/canonical`, iOS `CanonicalBusinessEngine`, Android the same packed script) and never keep a second copy.

**Where it lives.** The canonical copy is `docs/RULEBOOK.md` in `project-planner-web`. iOS keeps a byte-identical mirror at `docs/RULEBOOK.md`; the packed script carries this file's version and sha256 (`rulebookStamp()`), so a platform can prove at test time that its mirror matches the rules it runs. Never edit a mirror by hand. See "How the rulebook changes" at the end.

---

## 1. Data, sync and source of truth

- **Firebase is the single source of truth** for shared data. No shared data is kept only on a device or in a browser. Device storage is a cache or a per-device preference only.
- **Identical field names, types, defaults and enums** on every platform. Where platforms differed, the web schema wins. Shapes are listed in `ORGANIZATION_DOCUMENT_FIELDS`, `USER_DOCUMENT_FIELDS` and `OPERATIONAL_COLLECTION_PATHS`.
- **Live screens use real-time listeners.** A screen showing shared data listens for changes (Firestore snapshot listener), so a save on one platform appears on the other without a refresh. Organisation settings come from one live listener on `organizations/{orgId}`; the signed-in user's profile and the Manage Users roster are live too.
- **Bounded downloads.** Booking listeners start at `bookingLoadStart`: the earlier of this week's Monday and the warning window start, filtered on the booking `date`. A screen showing an older day moves the start earlier (never later); history screens ask for the full archive. The notification inbox loads the newest 150 rows for the signed-in user (`createdAt` descending).
- **Writes carry metadata.** Every write to a shared document includes `updatedAt` (server timestamp), `updatedBy` (signed-in user id) and `updatedFrom` (`web` | `ios` | `android`) — `writeMetadataFields(uid, platform)`; each app adds its SDK server timestamp. Security rules never reject a write only because these are missing (older app builds).
- **Partial writes only.** A save writes the fields it changed (dotted partial update). It never rewrites a whole document from a possibly stale copy, and never deletes a field just because the local copy lacks it. A dotted key (`settings.currencyCode`) is only used with a partial update, never with a merge-set, where it would become a literal field name.
- **Shared calculations run on each device from one packed script.** Warnings, overtime, timesheet figures, Daily Overview and pay are calculated on each device by the same packed rulebook script, not re-implemented per platform. Moving a calculation to the server (Cloud Functions) is a separate decision; until then the function named here is the exact specification (inputs, edge cases, rounding) and is locked by tests in `lib/canonical/canonical.test.ts` and `lib/canonical/parity-fixture.json`.
- **One business time zone per organisation**, from `organizations/{orgId}.countryCode` (`organizationTimeZone`): GB → Europe/London; missing or unknown → Europe/London. Every day key, warning window, payment run, timesheet day, cut-off clock and effective date uses this zone, with BST/GMT handled by the zone rules. Never the phone or browser zone.
- **The week starts on Monday** and runs Monday–Sunday for every organisation. Monday–Friday are working days; Saturday and Sunday count only where a setting says so (for example "Include weekends in unbooked labour"). This is fixed, not an organisation setting.
- **Security rules enforce permissions on the server.** Firestore rules enforce role permissions, approvals and who may change organisation settings. Hiding a control in an app is never the only guard.

## 2. Offline rules

- **Web:** online only. No offline editing.
- **iOS and Android:** offline mode with restrictions. The logic is kept separate from screens so Android can reuse the same rules.

**Allowed offline** (queued on the device, pushed automatically when the connection returns; each queued item shows **"Pending sync"** until the server confirms it):
- Create, edit and cancel bookings (projects and small works).
- Annual leave requests.
- The user's own personal profile fields.
- The user's own notification toggles.

**Online only** (controls disabled offline with the message **"Connect to the internet to change this"**):
- All organisation settings: company details, currency, working hours and overtime (including scheduled changes), warning settings (including excluded users), payment runs, material order cut-off and schedule options (including custom items).
- All Manage Users changes: role, line manager, employment status, day/hourly rate and effective dates, exclusions, inactive flag, invites.
- Approvals: annual leave approval, timesheet signing, clash approvals.
- Account actions: sign-in, password changes, switching organisation.

**Read-only offline.** Daily Overview, warnings, weekly reports and My Schedule show the last synced data, labelled "Last updated [date/time]", and are never recalculated from unsynced local changes.

**Conflicts.**
- Last write wins, by server timestamp.
- A booking cancelled or deleted on another device cannot be brought back by an offline edit. Deleting a booking (`bookings` or `managerSiteBookings`) writes a tombstone at `organizations/{orgId}/deletedBookings/{bookingId}` in the same batch (`bookingTombstonePath`, `bookingTombstoneWriteFields`; the app adds the server `deletedAt`); security rules refuse any later create or update of that booking id. A booking stored as `Cancelled` can only be moved off Cancelled by an admin or manager. A refused replay is final (`bookingReplayRefusedIsFinal`): the device removes the queued item, drops the local row and shows `BOOKING_REPLAY_REFUSED_MESSAGE` ("This booking was cancelled or deleted on another device").
- Double bookings created offline are not blocked; warnings pick them up after sync.
- Queued writes to online-only areas are refused by the security rules when they replay.

## 3. The data flow (in order)

1. **Scheduling** (projects and small works) books people onto days.
2. **Daily Overview** is a snapshot of each day: who is booked (and on what), who is unbooked, who is on annual leave. It is driven by bookings, annual leave and organisation settings.
3. **Warnings** consume the same day data plus warning settings and organisation settings.
4. **Weekly Report** is an extraction of Daily Overview and warnings for a chosen date range.
5. **Timesheets** are fed by bookings, annual leave, working hours/overtime rules, payment runs and each person's effective-dated employment profile.
6. **My Schedule** is each person's own view of their bookings and annual leave.

A change upstream flows to everything downstream on every platform.

## 4. Organisation settings

All organisation settings live on `organizations/{orgId}` and are identical on every platform. They are online-only edits, saved only when the user presses **Save**, and a save on one platform appears on the other through the live listener. Settings screens keep an unsaved draft and only refresh it from the server while the draft is unchanged. A value that looks like the factory default on the server is still the server value — no platform re-saves its own cached copy over it.

### 4.1 Company details
Flat fields on the organisation document: `name`, `officeAddressLine1`, `officeAddressLine2`, `officeCity`, `officeCounty`, `officePostcode`, `countryCode` (two letters, GB when missing), `documentAbbreviation` (1–3 characters), `companyLogoURL`, `defaultLatitude`, `defaultLongitude`, `bankHolidayRegionId` (`parseCompanyDetails`, `companyDetailsWriteFields` → `{ set, remove }`, `companyDetailsValidationError`). A legacy nested `officeAddress` map is read only as a fallback and every save deletes it. Blank optional fields are deleted, never saved as empty text; with no office, all address fields are deleted. A missing map pin leaves the saved pin alone. A blank name is never saved (`organizationNameWriteFields`). The country sets the business time zone and the default currency.

### 4.2 Currency
One organisation currency (`resolveOrganizationCurrency`), chosen from `CURRENCY_OPTIONS` (GBP, EUR, USD, CAD, AUD, NZD, SEK, NOK, DKK, PLN, AED). Until one is saved it defaults from the country (`defaultCurrencyForCountry`; GBP when unknown). A save writes `currencyCode`, `currency` and `settings.currencyCode` as one partial update (`organizationCurrencyWriteFields`). Every money figure — timesheets, rates, invoices, weekly report, exports, PDFs — is shown with `formatMoney(amount, currency)`. Subscription prices are billing, not organisation money.

### 4.3 Working hours and overtime
`payrollTimePolicy`: standard day window, break, paid hours, weekday overtime multiplier, Saturday and Sunday rules, paid break. Limits for every platform (`validatePayrollTimePolicy`): paid hours 1–12, break 0–120 minutes, multipliers 1–3. The standard day and its AM/PM halves are `halfDayWindows`; no platform computes a midpoint itself.
Limits also cover weekend "counts as" hours (1–12) — `PAYROLL_POLICY_LIMITS`.

A change is either applied from today or **scheduled** from a chosen date after today (`payrollTimePolicyScheduled { policy, effectiveFrom }`, day keys in the organisation zone). The rules in effect on a day (`effectivePayrollTimePolicy(org, dayKey)`, `payrollTimePolicyTimeline`) are: the scheduled change once its day has arrived (even before any app promotes it); before `payrollTimePolicyEffectiveFrom`, `payrollTimePolicyPrior`; otherwise `payrollTimePolicy`.
- **Apply from today** (`payrollTimePolicyApplyNowWriteFields`) saves the new rules, keeps yesterday's rules as the prior, sets today as the start, removes a scheduled change that is already due and keeps a future one.
- **Schedule** (`payrollTimePolicyScheduleWriteFields`) replaces any pending change; a due change is promoted first so it is not lost.
- **Cancel** (`payrollTimePolicyCancelScheduleWriteFields`) removes a pending change.
No save ever cancels a scheduled change it was not asked to cancel.

The working week is `WORKING_WEEK` (`isStandardWorkingWeekday`): Monday–Sunday, Monday–Friday working.

### 4.4 Annual leave settings
`annualLeaveDefaults { daysPerYear, startMonth, endMonth, carriesOver }` (defaults 25, 1, 12, false) and the bank-holiday region, saved together in one write. Allowance, the leave year and a one-year override are `annualLeaveBalance`.

### 4.5 Payment runs (the invoicing period)
Two modes (`invoicing.paymentRunMode`):
- **Set payment run date ranges** (`date_ranges`): two runs per month on fixed days, e.g. 1st–15th and 16th–last day. "16th–31st" means 16th to the last day of that month in 28, 29, 30 and 31-day months. Run 1 starts on the 1st and must end by the 27th so run 2 exists every month; run 2 starts the day after and ends on the 31st (`validateInvoicingSettings`, `PAYMENT_RUN_1_LAST_END_DAY`). A run is paid on its payment day: the first one on or after the run ends, otherwise that day next month (clamped to short months).
- **Recurring timeframe** (`recurring_timeframe`): a weekly work period (e.g. Monday–Sunday) paid in arrears on the first pay weekday after the period ends (e.g. the following Friday) — `paymentWeekdayAfterPeriodEnd`, shared with timesheet reminders.

The **active payment run** is the work period that contains today in the organisation zone (`invoicingPeriod`); if no date-range run contains today, the run with the latest end day. Its pay date is `paymentRunPayDate`. The summary shown to users is `activePaymentRunSummary(invoicing, now, timeZone)`: `{ start, end, payDate, label }`, e.g. "Mon 26 Oct – Sun 1 Nov · paid Fri 6 Nov", or `{ notConfigured: true }` when the organisation has no payment runs.

### 4.6 Warning settings
`warningDetection { detectClashes, clashLookaheadMode, clashLookaheadDays, includeWeekendsForUnbookedLabour, excludedUserIdsFromUnbookedWarnings }`, parsed by `parseWarningDetection`. See §5.

### 4.7 Material order cut-off
`settings.materialCutOff { materialOrderCutOff, materialCutOffHour, materialCutOffMinute, materialCutOffOnSaturday, materialCutOffOnSunday }` (`parseMaterialCutOff`, `resolveMaterialCutOffClock`). A missing hour defaults to 16:00; a saved 15:30 stays 15:30. A user's notification preferences never hold the clock.

### 4.8 Schedule options
`settings.myScheduleOptions { showOffice, showWorkingFromHome, showSiteSurvey, customItems[], customItemEnabled{name: bool} }`. Missing flags mean on. Every location picker offers exactly `enabledScheduleLocations(options)`. A save writes exactly the list on screen, with names de-duplicated ignoring case (`scheduleOptionsWriteFields`) — it never merges back a deleted item.

## 5. Warnings

Warnings refresh whenever bookings, leave, settings or users change, and when the day changes (midnight in the organisation zone, and when the app or tab returns to the foreground).

**Detection period** (`coverageWindow`):
- **Set number of days:** today through N calendar days including today (2 = today and tomorrow). N is a whole number 1–365; a missing, blank, non-numeric or below-1 value falls back to 7 and both the settings screen and the Warnings screen show a notice (`coverageWindow` → `fallbackReason`, `parseWarningDetection` → `clashLookaheadDaysFallback`, never saved) — never a silent failure.
- **Invoicing period:** every past, present and future day of the active payment run. Selecting it shows the **invoicing schedule summary** (`activePaymentRunSummary`); with no payment run configured the screen asks the user to set one up. The summary is hidden for the other two options.
- **Full week:** Monday–Friday of the current week, including days already past. Saturday and Sunday are added for unbooked labour only when "Include weekends in unbooked labour" is on.
- **Clash days** (`clashScanDays`): clashes follow the scan window. In Full week, a Saturday or Sunday of the current Monday–Sunday week is also checked when it has a booking. Set number of days and Invoicing period are calendar days, so their weekends are always checked. The include-weekends toggle never affects clashes.

**Warning types and severity:**
- **Booking clashes** — a person double-booked on the same date. Operative clashes are **High**; manager/admin overlaps are **Medium**. A clash can be **approved** (online, managers and admins only): `clashApprovalWrites` writes `acceptedBookingClashes/{clashPairKey}` and `warningResolutions/{clashResolutionKey}` with status `approved` — the key is the booking-pair key for operative clashes and `mgr-clash-…` for manager clashes. Un-approving deletes both. A clash is approved when either document exists (`isClashApproved`). Approved clashes are listed separately on the weekly report and no longer count as open. Whether any row still counts is `isWarningActive` over `resolvedWarningKeys`.
- **Unbooked labour (High)** — an operative not booked on a working day in the window (`unbookedLabourRows`). Skipped: excluded users (silently), inactive users, pending users who have not finished sign-up, days on approved annual leave, weekends unless included, anonymised deleted profiles (`listedCurrentLabourPeople`).
- **Low:** materials not ordered by the cut-off (`materialCutOffWarningRows`: once the organisation clock passes the cut-off, each job with an active booking tomorrow warns if tomorrow has no material lines or any line is not ordered — a line counts as ordered when its status is `ordered` or an order send record lists it (`materialLineCountsAsOrdered`); a Saturday or Sunday tomorrow only if that day's flag is on; key `materials-{projectId}-{YYYY-MM-DD}` for tomorrow); qualification expiry including already expired (`qualificationExpiryRows`); unverified accounts (`unverifiedOperativeRows`).

**Excluded users** are a per-user, all-or-nothing exemption from unbooked-labour warnings, for people who are never bookable (office PAYE staff, directors). Temporarily unavailable operatives use the **inactive** flag instead.

Display order (Oldest/Newest) is a per-device preference (`sortWarningsByDate`).

## 6. Daily Overview

One entry per day listing booked people (with project or small work), unbooked people (`unbookedLabourRowsOnDay`) and people on approved annual leave. It respects the organisation working hours (`effectivePayrollTimePolicy`), the fixed working week, include-weekends, exclusions and active/inactive status. Standard and overtime hours are `workedHoursSplit`. It is identical on every platform for the same day.

## 7. Weekly Report

Generated live for any chosen date range from current bookings, Daily Overview, warnings and timesheets. Contents: hours, overtime, warnings including approved clashes, totals. Reports are **not stored**: a report is produced and downloaded (PDF/XLSX/HTML or the share sheet) and that is all. Producing a report again for the same range reflects any changes made since.

## 8. Timesheets and employment profile

**Profile fields** on `users/{uid}`: employment status (`employmentType`: PAYE or self-employed), pay basis (`payBasis`: day or hourly), `dayRate`, `hourlyRate`. A rate save writes exactly one basis and removes the other.

**Effective dating.** Status and rate are both effective-dated; a change asks when it takes effect. Status: `employmentTypeTransitionFrom` / `employmentTypeEffectiveAt` (`applyEmploymentTypeChange`, `employmentTypeOnDay`). Rate: `organizations/{orgId}/operativeDayRateHistory` rows `{ userId, operativeId, dayRate, payBasis, effectiveAt, createdAt }`. History is never rewritten.

**Rate on a day** (`payRateOnDay`): a PAYE day has rate 0 (the line keeps its hours and is flagged PAYE). Otherwise the rate is the latest history row for the person whose effective day (organisation zone) is on or before the day; an explicit 0 is a real rate. If the live profile is hourly, an hourly row stays in force until a day-rate row falls on a later day. With no history row the live profile applies (`users/{uid}`, then the operative row). With nothing set the rate is "rate not set".

**Pay rules.**
- PAYE days pay 0 (in the organisation currency) and still appear on the timesheet as a 0 line.
- Self-employed days pay the effective day or hourly rate.
- Example: PAYE → self-employed changed on Tuesday, effective Wednesday: Monday and Tuesday show 0, Wednesday onwards show figures for days worked.
- **Overlapping bookings are each paid** and never merged. An overlap is a warning managers should have caught; on the timesheet each overlapping line is shown in amber for the person and their line manager with "Overlaps another booking — check with your manager" (`overlappingBookingIds`, `OVERLAPPING_BOOKING_NOTE`). Times that only touch do not overlap.

**Calculation.** Hours, overtime and pay come from bookings, the working-hours policy in effect that day and payment runs (`payrollHoursResult`, `workedHoursSplit`). Timesheets are grouped by payment run (`timesheetPeriodFromInvoicing`, `selectableTimesheetPaymentRunPeriods`); status Awaiting / Signed off / Exported is `timesheetListBucket`.

**Annual leave on timesheets.** Each approved leave day in the period appears as an information line "Annual leave (full day / AM / PM)" for the person and their line manager, with no edit control and no hours or pay (`timesheetLeaveLines`, `timesheetLeaveLabel`). Leave never appears on a generated invoice.

**Line manager.** A person's line managers are `assignedManagerUserIds` (else the single `assignedManagerUserId`; `hasNoLineManager` means none) — `lineManagerIds`. Line managers receive that person's timesheets for signing, annual leave requests and other approval items (`userTimesheetSubjects`, `leaveApproverIds`). With no current active line manager, all active admins and super admins receive them. Nobody approves their own items. Routing is read at the time — changing the line manager on any platform re-routes everything, nothing is stored on the request.

## 9. Annual leave

One document per request at `organizations/{orgId}/holidayBookings/{id}`: a run of calendar-consecutive days with the same slot is one record from `startDate` to `endDate` (`holidayRequestRanges`, `holidayRequestWriteFields`), with `timeSlot` (`FULL DAY` / `AM` / `PM`, applying to every day) and `status` (`pending`, `approved`, `rejected`). Cancelling approved leave is a request (`cancellationRequestedAt`, `cancellationRequestedByUserId`) that an approver accepts (the record is removed) or refuses. Older one-document-per-day records stay valid. A decision writes `status`, `approvedByUserId`, `approvedAt` and an optional trimmed `decisionNote` (blank clears it) shown to the requester (`holidayDecisionWriteFields`, `parseHolidayDecisionNote`). Day counting (`leaveRecordDayKeys`, `annualLeaveBalance`): a single-day record counts its day; a multi-day record counts each day except weekends and bank holidays, each in its own leave year. Submitting a request notifies every approver (`holiday_request_submitted`). Approved leave affects Daily Overview, unbooked-labour warnings (`leaveCoverageRows`), timesheets (information lines) and My Schedule. Only the requester's line managers or an admin may approve or decline — enforced by security rules.

## 10. My Schedule

Every person sees their own bookings and annual leave (approved, and pending marked as pending), matched by account (`bookingIdsForAccount`) — never by name. It updates live when a booking or leave changes on any platform. Hours split as in §6.

## 11. Manage Users

All Manage Users changes — role, line manager, employment status and rates with effective dates, inactive flag, exclusions, invites — are online-only, sync to every platform through live listeners, and are written as partial updates of the changed fields only. People lists use `rosterPeople` / `listedRosterUsers`; Active / Inactive / Pending is `userRosterSegment`. A user may not change their own rates, pay basis, employment type, active flag, line manager or permissions — enforced by security rules. **Roles & permissions** opens Manage Users directly.

## 12. My Profile

Matches on every platform and updates live: profile photo (`profilePhotoURL`), contact details, day/hourly rate and employment status (read-only), and billing details — VAT number and UTR — stored privately at `users/{uid}/private/taxIds` (`sensitiveProfile`). A photo upload stores a fresh download URL; a stale profile copy never removes or rolls back the photo.

## 13. Notifications

- **My notifications** toggles are personal (`users/{uid}.notificationPreferences`), written as dotted partial updates, and sync across platforms (`parseUserNotificationPreferences`, `userNotificationPreferenceFieldPatch`).
- Which toggles a person sees depends on role and features (`visibleNotificationPreferenceKeys`). People who can see variations (`canSeeVariations`: admins and managers) have a **Variations** toggle (`variations`, on by default) covering `variation`, `variation_renumbered`, `variation_added`, `variation_from_tracker` and `variation_numbers_updated`.
- A toggle turned off stops that notification type's device push everywhere (enforced by the push Cloud Function) and hides its rows in the inbox and badge (`notificationPreferenceAllowsDelivery`). The notification record itself is still written.
- Organisation settings (material cut-off, schedule options) never appear in My notifications.
- Web never sends browser or OS notifications.

## 14. Authentication and organisations

- Sign-in and passwords use Firebase Auth email/password on every platform; a password change applies everywhere. Every password — sign-up, invite set-up, reset, change — must be at least 8 characters; the platform owner's developer account needs 10 (`PASSWORD_MIN_LENGTH`, `passwordMinLength`, `passwordPolicyError` → "Password must be at least N characters."). No complexity rule.
- **Switching organisation is per device.** Each platform remembers the last organisation it opened (web `pp.webActiveOrg:{userId}`, iOS `cached_organizationId`) and reopens to it (`chooseSessionOrganization`). Switching on one platform does not change another platform, and does not write `users/{uid}.organizationId`.
- **Membership is shared.** The list of organisations a person belongs to is shared data (`sessionMembershipIds`).

## 15. Platform-specific (not synced)

- Light and dark mode.
- Warning display order (Oldest/Newest).

## 16. Server-side permissions (Firestore security rules)

Deployed only from `project-planner-web/firestore.rules`. Apps hide controls too, but these rules are the guard:
- **Organisation:** only a current admin edits `organizations/{orgId}`; billing is never written by an app; ownership (`creatorUserId`) passes only from the current Super Admin to another admin (or by the platform owner). A demoted creator cannot edit.
- **Company settings documents** (`settings/{id}` such as job types and trades): admins and managers. Deadlines and health & safety documents stay open to the team.
- **Profile:** a person cannot change their own pay (`dayRate`, `hourlyRate`, `payBasis`), line manager, active flag, employment type or permissions. Resending an unchanged value always passes.
- **Annual leave:** a person creates and edits their own pending request and asks to cancel; only an admin or the person's line manager approves or rejects (any manager when the person has no line manager). People allowed to book their own leave save it approved.
- **Timesheets:** a person never counter-signs or exports their own timesheet; only their line manager or an admin writes the sign-off and export fields.
- **Warnings:** only admins and managers accept a clash or approve/dismiss a warning resolution.
- **Bookings:** tombstones as in §2.
- **Write metadata** (`updatedBy` = the signed-in user, `updatedFrom`, `updatedAt`) is validated when present and never required.

---

## How the rulebook changes

1. A rule change starts in `project-planner-web`: edit the function in `lib/canonical`, add a test in `lib/canonical/canonical.test.ts`, and edit this file.
2. Bump `Version:` (major: a breaking field or behaviour change; minor: a new rule; patch: wording) and add a `### <version> — <date>` entry under Changelog.
3. `npm run build:canonical` packs the script with this file's version stamped in, writes `lib/canonical/dist/canonical-manifest.json`, and mirrors the files into `../project-planner-ios` when it is checked out.
4. `npm run rulebook:handoff` writes the iOS follow-on prompt to `docs/ios-handoff/v<version>.md` and `docs/ios-handoff/LATEST.md`.
5. Enforcement: the pre-commit hook, CI (`.github/workflows/rulebook.yml`) and the Claude Code Stop hook (`.claude/settings.json`) all run `node scripts/rulebook-sync.mjs check` and refuse a change to `lib/canonical`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` or this file without a version bump, a changelog entry, a fresh pack and a hand-off. A daily CI job compares the iOS repo's mirror with this version and fails when iOS is behind.
6. iOS runs `scripts/sync-rulebook-from-web.sh`, and its `RulebookParityTests` fail when its mirror, manifest or packed script differ from what web published.
7. A gap found on iOS is reported to the web agent and fixed here first — never by diverging on iOS.

## Changelog

### 1.0.0 — 2026-10-31
- First versioned rulebook. Consolidates the rules previously spread across `docs/CANONICAL_ARCHITECTURE.md`, `AGENTS.md` and the iOS copies into this one file, mirrored to iOS.
- Decisions: organisation currency used for every money figure (11 currencies, country default); one business time zone per organisation from its country; fixed Monday–Sunday week; scheduled working-hours changes on every platform; recurring payment runs paid in arrears after the work period; weekend clashes checked when a weekend booking exists; overlapping bookings each paid and shown in amber; PAYE days shown at 0; annual leave shown on timesheets as information (never on invoices); one leave document per request with a decision note; weekly reports never stored; booking tombstones stop offline resurrection; password minimum 8; Variations notification toggle; write metadata `updatedBy` / `updatedFrom`.

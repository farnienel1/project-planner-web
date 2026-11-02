# Project Planner Rulebook

Version: 1.4.0
Updated: 2026-10-31

This is the one rulebook for every Project Planner platform: web, iOS and (later) Android. It is written platform-neutral. Each rule names the shared function in `lib/canonical` that implements it; platforms call that function (web `@/lib/canonical`, iOS `CanonicalBusinessEngine`, Android the same packed script) and never keep a second copy.

**Where it lives.** The canonical copy is `docs/RULEBOOK.md` in `project-planner-web`. iOS keeps a byte-identical mirror at `docs/RULEBOOK.md`; the packed script carries this file's version and sha256 (`rulebookStamp()`), so a platform can prove at test time that its mirror matches the rules it runs. Never edit a mirror by hand. See "How the rulebook changes" at the end.

---

## 1. Data, sync and source of truth

- **Firebase is the single source of truth** for shared data. No shared data is kept only on a device or in a browser. Device storage is a cache or a per-device preference only.
- **Identical field names, types, defaults and enums** on every platform. Where platforms differed, the web schema wins. Shapes are listed in `ORGANIZATION_DOCUMENT_FIELDS`, `USER_DOCUMENT_FIELDS` and `OPERATIONAL_COLLECTION_PATHS`, all three in the packed script.
- **Live screens use real-time listeners.** A screen showing shared data listens for changes (Firestore snapshot listener), so a save on one platform appears on the other without a refresh. Organisation settings come from one live listener on `organizations/{orgId}`; the signed-in user's profile and the Manage Users roster are live too. The live roster is `users` where `organizationId` is the open organisation. A member linked only through a membership, `userEmails` or a staff link is not in that listener and refreshes on the next full load; this is accepted.
- **Bounded downloads.** Booking listeners start at `bookingLoadStart`: the earlier of this week's Monday and the warning window start, filtered on the booking `date`. A screen showing an older day moves the start earlier (never later); history screens ask for the full archive. The notification inbox loads the newest 150 rows for the signed-in user (`createdAt` descending).
- **Writes carry metadata.** Every write to a shared document includes `updatedAt` (server timestamp), `updatedBy` (signed-in user id) and `updatedFrom` (`web` | `ios` | `android`) — `writeMetadataFields(uid, platform)`; each app adds its SDK server timestamp. Security rules never reject a write only because these are missing (older app builds). **Exception:** a booking tombstone (§2) carries only its own fields (`BOOKING_TOMBSTONE_FIELDS`) and no write metadata.
- **Partial writes only.** A save writes the fields it changed (dotted partial update). It never rewrites a whole document from a possibly stale copy, and never deletes a field just because the local copy lacks it. A dotted key (`settings.currencyCode`) is only used with a partial update, never with a merge-set, where it would become a literal field name. Edits to an existing document — annual leave (`holidayBookings`) and timesheet drafts included — are partial updates.
- **Document ids keep their stored case.** Ids are written exactly as created (iOS `UUID.uuidString` is upper case; web ids may be lower case) and stored keys are never rewritten. Comparisons ignore case: `normalizeDocumentId` (trimmed, lower case) is used for warning resolution keys, accepted clash pairs and timesheet entry-review lookups (`resolvedWarningKeys`, `approvedWarningKeys`, `isWarningActive`, `isClashApproved`, `isClashAccepted`, `timesheetEntryDecision`).
- **Shared calculations run on each device from one packed script.** Warnings, overtime, timesheet figures, Daily Overview and pay are calculated on each device by the same packed rulebook script, not re-implemented per platform. Moving a calculation to the server (Cloud Functions) is a separate decision; until then the function named here is the exact specification (inputs, edge cases, rounding) and is locked by tests in `lib/canonical/canonical.test.ts` and `lib/canonical/parity-fixture.json`.
- **One business time zone per organisation**, from `organizations/{orgId}.countryCode` (`organizationTimeZone`): GB → Europe/London; missing or unknown → Europe/London. Every day key, warning window, payment run, timesheet day, cut-off clock and effective date uses this zone, with BST/GMT handled by the zone rules. Never the phone or browser zone.
- **The week starts on Monday** and runs Monday–Sunday for every organisation. Monday–Friday are working days; Saturday and Sunday count only where a setting says so (for example "Include weekends in unbooked labour"). This is fixed, not an organisation setting.
- **Security rules enforce permissions on the server.** Firestore rules enforce role permissions, approvals and who may change organisation settings. Hiding a control in an app is never the only guard.

## 2. Offline rules

- **Web:** online only. No offline editing.
- **iOS and Android:** offline mode with restrictions. The logic is kept separate from screens so Android can reuse the same rules.

The table below is `OFFLINE_ACTIONS` (stable action ids, e.g. `booking.create`, `users.pay_rate`, `view.warnings`), read with `offlineAvailability(actionId)` → `allowedOffline` | `onlineOnly` | `readOnlyOffline`; an unknown id is online only. The messages are `OFFLINE_PENDING_SYNC_LABEL`, `OFFLINE_ONLINE_ONLY_MESSAGE` and `offlineLastUpdatedLabel(instant, timeZone)`.

**Allowed offline** (queued on the device, pushed automatically when the connection returns; each queued item shows **"Pending sync"** until the server confirms it):
- Create, edit and cancel bookings (projects and small works). Deleting a booking is online only.
- Annual leave requests.
- The user's own personal profile fields.
- The user's own notification toggles.

**Online only** (controls disabled offline with the message **"Connect to the internet to change this"**):
- All organisation settings: company details, currency, working hours and overtime (including scheduled changes), warning settings (including excluded users), payment runs, material order cut-off and schedule options (including custom items).
- All Manage Users changes: role, line manager, employment status, day/hourly rate and effective dates, exclusions, inactive flag, invites.
- Approvals: annual leave approval, timesheet signing, clash approvals.
- Account actions: sign-in, password changes, switching organisation.
- Deleting a booking (the delete and its tombstone are never queued).

**Read-only offline.** Daily Overview, warnings, weekly reports and My Schedule show the last synced data, labelled "Last updated [date/time]" in the organisation zone (`offlineLastUpdatedLabel`, e.g. "Last updated 24 Oct 2026, 14:05"), and are never recalculated from unsynced local changes.

**Conflicts.**
- Last write wins, by server timestamp.
- A booking cancelled or deleted on another device cannot be brought back by an offline edit. Deleting a booking (`bookings` or `managerSiteBookings`) writes a tombstone at `organizations/{orgId}/deletedBookings/{bookingId}` in the same batch (`bookingTombstonePath`, `bookingTombstoneWriteFields`; the app adds the server `deletedAt`). A tombstone carries only `bookingId`, `collection`, `deletedAt`, `deletedBy` and `deletedFrom` — no write metadata. Security rules refuse any later create or update of that booking id. Deleting a labour booking (`bookings`) and writing its tombstone is admin only; managers cancel instead, and apps show Delete on labour bookings to admins only. A booking stored as `Cancelled` can only be moved off Cancelled by an admin or manager. A refused replay is final (`bookingReplayRefusedIsFinal({ code, isCreate })`): permission-denied always, and not-found when the queued item edits or cancels a booking (`isCreate` false), so an edit of a booking deleted elsewhere is never turned into a create. The device removes the queued item, drops the local row and shows `BOOKING_REPLAY_REFUSED_MESSAGE` ("This booking was cancelled or deleted on another device").
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

**Country change asks for the bank-holiday region.** Regions are one shared list, `BANK_HOLIDAY_REGIONS` (`{ id, title, countryCode, subdivisionCodes? }`; ids are stored and never renamed: `GB-ENG-WLS`, `GB-SCT`, `GB-NIR`, `GB`, `IE`, `US`, …; the older web id `GB-ENG` reads as `GB-ENG-WLS`, `normalizeBankHolidayRegionId`). A company's pickers offer only `bankHolidayRegionsForCountry(countryCode)`; the default is `defaultBankHolidayRegionForCountry` (GB → `GB-ENG-WLS`, `DEFAULT_BANK_HOLIDAY_REGION_ID`; a country with one region → that region; none listed → null). When Company Details changes the country and the saved `bankHolidayRegionId` does not belong to the new country, `companyDetailsRegionPrompt(previous, next)` is `{ required: true, choices, defaultRegionId, message }` and the save is refused (`companyDetailsValidationError`, "Choose the bank holidays for {country}.") until a region from `choices` is picked; the region picker is pre-selected with the default. The same country never asks again. `companyDetailsWriteFields` writes the new `countryCode` and `bankHolidayRegionId` (and `settings.bankHolidayRegionId`) in one partial update; a new country with no listed regions removes the old region. With no saved region, the company's country default applies (`parseCompanyDetails`).

### 4.2 Currency
One organisation currency (`resolveOrganizationCurrency`), chosen from `CURRENCY_OPTIONS` (GBP, EUR, USD, CAD, AUD, NZD, SEK, NOK, DKK, PLN, AED). Until one is saved it defaults from the country (`defaultCurrencyForCountry`; GBP when unknown). A save writes `currencyCode`, `currency` and `settings.currencyCode` as one partial update (`organizationCurrencyWriteFields`). Older iOS builds also wrote a top-level field literally named `settings.currencyCode`; `resolveOrganizationCurrency` reads it last, so it is harmless and is left in place (an optional one-off clean-up may delete it with `FieldPath(['settings.currencyCode'])`). Every money figure — timesheets, rates, invoices, weekly report, exports, PDFs — is shown with `formatMoney(amount, currency)`. Subscription prices are billing, not organisation money.

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
`annualLeaveDefaults { daysPerYear, startMonth, endMonth, carriesOver }` (defaults 25, 1, 12, false) and the bank-holiday region, saved together in one write. The region picker offers only the company country's regions (`bankHolidayRegionsForCountry`); the country is changed in Company details (§4.1). Allowance, the leave year and a one-year override are `annualLeaveBalance`. Changing the region never recounts or rewrites existing leave records: day counting (`leaveRecordDayKeys`, `annualLeaveBalance`) uses the region in effect when it runs.

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
- **Set number of days:** today through N calendar days including today (2 = today and tomorrow). N is a whole number 1–365; a missing, blank, non-numeric or below-1 value falls back to 7 and both the settings screen and the Warnings screen show the notice `warningLookaheadFallbackNotice(reason)` (`coverageWindow` → `fallbackReason`, `parseWarningDetection` → `clashLookaheadDaysFallback`, never saved) — never a silent failure.
- **Invoicing period:** every past, present and future day of the active payment run. Selecting it shows the **invoicing schedule summary** (`activePaymentRunSummary`); with no payment run configured the screen asks the user to set one up. The summary is hidden for the other two options.
- **Full week:** Monday–Friday of the current week, including days already past. Saturday and Sunday are added for unbooked labour only when "Include weekends in unbooked labour" is on.
- **Unbooked days** (`unbookedScanDays`): the window above; in Full week with include-weekends on it runs to Sunday. Saturday and Sunday are scanned only when include-weekends is on, in every mode. A weekend day whose "counts as" hours are 0 is still skipped by `unbookedLabourRows`.
- **Clash days** (`clashScanDays`): clashes follow the scan window. In Full week, a Saturday or Sunday of the current Monday–Sunday week is also checked when it has a booking. Set number of days and Invoicing period are calendar days, so their weekends are always checked. The include-weekends toggle never affects clashes.

**Warning types and severity:**
- **Booking clashes** — a person double-booked on the same date. Operative clashes are **High** (`operativeClashGroups`); manager/admin overlaps are **Medium** (`managerClashGroups`). Both group a person's bookings per day (the person is `bookingPersonKey` / the roster account, so former ids, same-email ids and catalogue rows are one person) by overlapping clock intervals; touching times do not clash, and A–B plus B–C is one cluster. An operative cluster lists every booking id and one pair row per overlapping pair, each with its `clashPairKey` and `clashResolutionKey`. A clash can be **approved** and **un-approved** (online, managers and admins only): `clashApprovalWrites` writes `acceptedBookingClashes/{clashPairKey}` and `warningResolutions/{clashResolutionKey}` with status `approved` — the key is the booking-pair key for operative clashes and `mgr-clash-…` for manager clashes; approving an operative cluster writes every pair. Un-approving deletes both documents. A clash is approved when either document exists for it (`isClashApproved`); an operative cluster is approved when every pair is (`isClashGroupApproved`), so a third booking re-opens it. Only approvals count as approved: `approvedWarningKeys` (status `approved`) and `acceptedBookingClashes`; a dismissed clash is hidden but is not approved. Approved clashes are listed separately on the weekly report and no longer count as open. Whether any row still counts is `isWarningActive` over `resolvedWarningKeys` (approved and dismissed). Keys compare without case (§1).
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

**Effective dating.** Status and rate are both effective-dated; a change asks when it takes effect. Status: `employmentTypeTransitionFrom` / `employmentTypeEffectiveAt` (`applyEmploymentTypeChange`, `employmentTypeOnDay`). Rate: `organizations/{orgId}/operativeDayRateHistory` rows `{ userId, operativeId, dayRate, payBasis, effectiveAt, createdAt }`, built by `payRateHistoryWriteFields`: `effectiveAt` is midnight of the effective day in the organisation zone (never London unless that is the organisation's zone, never the device zone). Clearing a rate writes a row `{ dayRate: null, payBasis: null, effectiveAt }`, meaning "rate not set from that day". History is never rewritten.

**Rate on a day** (`payRateOnDay`): a PAYE day has rate 0 (the line keeps its hours and is flagged PAYE). Otherwise the rate is the latest history row for the person whose effective day (organisation zone) is on or before the day; an explicit 0 is a real rate. If the live profile is hourly, an hourly row stays in force until a day-rate row falls on a later day. A "rate cleared" row in force means "rate not set" (it ends an hourly row too). With no history row the live profile applies (`users/{uid}`, then the operative row). With nothing set the rate is "rate not set".

**Pay rules.**
- PAYE days pay 0 (in the organisation currency) and still appear on the timesheet as a 0 line. A PAYE line never appears on any generated invoice — the live invoice or the signed-sheet (`weeklyReportOverride`) invoice (`isInvoiceLine`, `invoiceLines`).
- Self-employed days pay the effective day or hourly rate.
- Example: PAYE → self-employed changed on Tuesday, effective Wednesday: Monday and Tuesday show 0, Wednesday onwards show figures for days worked.
- **Overlapping bookings are each paid** and never merged. An overlap is a warning managers should have caught; on the timesheet each overlapping line is shown in amber for the person and their line manager with "Overlaps another booking — check with your manager" (`overlappingBookingIds`, `OVERLAPPING_BOOKING_NOTE`). Times that only touch do not overlap.

**Who may change pay** (`canChangePersonPay`). A person never changes their own pay, line manager or employment type on any path — `users/{uid}`, `operativeProfiles/{uid}`, `operativeDayRateHistory`, or the pay fields of `operatives/{id}` and `managers/{id}`. An admin may (including their own rate). A manager with Operatives access may change an operative's pay in the same company, never their own or another manager's; a manager's pay is changed by admins only. Resending an unchanged value is not a change.

**Timesheet review** (`timesheetEntryReviews`). Only the person's line manager or an admin writes `payrollLineReviews` and `extraEntryReviews`. The decision for a price-work or expense entry is `extraEntryReviews[entryId] { decision, revisedAmount, reviewedAmount, reviewedByUserId, reviewedAtMs }` (`timesheetEntryDecision`, written with `timesheetEntryReviewWriteFields` as dotted partial updates); a review stored under the entry id in another letter case is found too. A review made against a different amount is stale and the entry is pending again; an entry nobody reviewed counts at its own amount. The inline `managerDecision` / `managerRevisedAmount` on an entry is still written for older builds and counts only when it lowers what is paid, or on a legacy sheet (no map) the line manager already signed. Owner saves go through `timesheetOwnerWriteFields`: it always removes the review maps and the manager sign-off and export fields (`TIMESHEET_MANAGER_SIGN_OFF_FIELDS`); the person writes `weeklyReportOverride` only when they have no line manager (self-signed), cannot change price work or expenses once the line manager has signed, and writes `managerNote` (their own note to the manager). The owner then sends only the fields that changed, as a partial update — never a full merge-set of the sheet. Whether a writer is a reviewer is `timesheetWriterIsReviewer`.

**Calculation.** Hours, overtime and pay come from bookings, the working-hours policy in effect that day and payment runs (`payrollHoursResult`, `workedHoursSplit`). Timesheets are grouped by payment run (`timesheetPeriodFromInvoicing`, `selectableTimesheetPaymentRunPeriods`); status Awaiting / Signed off / Exported is `timesheetListBucket`.

**Annual leave on timesheets.** Each approved leave day in the period appears as an information line "Annual leave (full day / AM / PM)" for the person and their line manager, with no edit control and no hours or pay (`timesheetLeaveLines`, `timesheetLeaveLabel`). Leave never appears on a generated invoice.

**Line manager.** A person's line managers are `assignedManagerUserIds` (else the single `assignedManagerUserId`; `hasNoLineManager` means none) — `lineManagerIds(user, roster)`. Given the roster, only active members count, an old invite id the roster knows as someone's `formerUserIds` / `sameEmailUserIds` is that person, and the person themself never counts under any of their ids (`personIdSet`: id, `formerUserIds`, `sameEmailUserIds`, roster rows with the same email). `hasActiveLineManager` is whether anyone is left. Line managers receive that person's timesheets for signing, annual leave requests and other approval items (`userTimesheetSubjects`, `leaveApproverIds`). With no active line manager (legacy data only), the active admins and super admins outside operative mode receive them — never "any manager". Nobody approves their own items. Routing is read at the time — changing the line manager on any platform re-routes everything, nothing is stored on the request.
- **Every operative and every manager needs an active line manager**, whatever the annual-leave self-book permission and whether annual leave is switched on for them. Only an admin or super admin outside operative mode may have none (`lineManagerRequired`, `isAdminOutsideOperativeMode`); an inactive person is not checked. `lineManagerRequiredError(user, roster)` returns `LINE_MANAGER_REQUIRED_MESSAGE` ("Set a line manager — this person's timesheets and annual leave need approval.") when a required line manager is missing, and Manage Users on every platform refuses that save. People saved before this rule who fail it are listed for admins by `usersMissingLineManager(roster)`; until fixed, their timesheets and requests go to the admins (`leaveApproverIds`), so nothing is stranded.
- **An admin or super admin with no active line manager is self-approved** (`timesheetSelfSigned(user, roster)`). Their timesheet has no "note to manager" and no "pending manager signature" state: their own signature completes the sheet (generate invoice is ready), and their owner save may write `weeklyReportOverride` (`timesheetOwnerWriteFields` with `subjectHasLineManager: !timesheetSelfSigned(...)`). Their annual leave saves approved (§9). An admin who has a line manager goes through normal approval.
- **`hasNoLineManager`** is a line-manager field: it is written only by whoever may change the line manager (admins; operatives managers for operatives), never by the person, together with the line-manager ids in one partial update. It is only valid for an admin or super admin.

## 9. Annual leave

One document per request at `organizations/{orgId}/holidayBookings/{id}`: a run of calendar-consecutive days with the same slot is one record from `startDate` to `endDate` (`holidayRequestRanges`, `holidayRequestWriteFields`), with `timeSlot` (`FULL DAY` / `AM` / `PM`, applying to every day) and `status` (`pending`, `approved`, `rejected`). Cancelling approved leave is a request (`cancellationRequestedAt`, `cancellationRequestedByUserId`) that an approver accepts (the record is removed) or refuses. Older one-document-per-day records stay valid. A decision writes `status`, `approvedByUserId`, `approvedAt` and an optional trimmed `decisionNote` (blank clears it) shown to the requester (`holidayDecisionWriteFields`, `parseHolidayDecisionNote`). Day counting (`leaveRecordDayKeys`, `annualLeaveBalance`): a single-day record counts its day; a multi-day record counts each day except weekends and bank holidays, each in its own leave year. Submitting a request notifies its approvers (`holiday_request_submitted`, `holidayRequestRecipients`), and the requester is notified of the decision (`holidayDecisionRecipients`); see §13. Approved leave affects Daily Overview, unbooked-labour warnings (`leaveCoverageRows`), timesheets (information lines) and My Schedule. Editing an existing record is a partial update of the changed fields.

**Self-booking** (`canSelfBookAnnualLeave(user, roster)`): a person's own leave saves approved when they have the `annualLeaveSelfBook` permission outside operative mode, or they are an admin or super admin outside operative mode with no active line manager (self-approved, §8). Having no line manager does not make an operative or manager a self-booker. Everyone else sends a pending request to `leaveApproverIds`. The submit button reads "Submit" when the leave saves approved and "Submit request" otherwise (`leaveSubmitLabel`, `LEAVE_SUBMIT_LABEL`, `LEAVE_SUBMIT_REQUEST_LABEL`). Self-booked leave notifies nobody.

**Who decides** (`canDecideLeave(viewer, requester, roster)`): never the requester under any of their ids, admins included. An admin or super admin not in operative mode may decide any request in the organisation; anyone else only when they are in `leaveApproverIds(requester)` (an admin in operative mode decides only as a line manager). The list a person sees to decide — pending requests and cancellation requests — is `leaveDecisionQueue(viewer, requests, roster)`. Enforced by security rules.

## 10. My Schedule

Every person sees their own bookings and annual leave (approved, and pending marked as pending), matched by account (`bookingIdsForAccount`) — never by name. It updates live when a booking or leave changes on any platform. Hours split as in §6.

## 11. Manage Users

All Manage Users changes — role, line manager, employment status and rates with effective dates, inactive flag, exclusions, invites — are online-only, sync to every platform through live listeners, and are written as partial updates of the changed fields only. People lists use `rosterPeople` / `listedRosterUsers`; Active / Inactive / Pending is `userRosterSegment`. A save that leaves an operative or manager with no active line manager is refused with "Set a line manager — this person's timesheets and annual leave need approval." (`lineManagerRequiredError`, §8) — the self-book permission does not waive it; only admins and super admins outside operative mode may have none. Admins see the people already in that state (`usersMissingLineManager`). The line manager, `hasNoLineManager` and self-book flag are written by admins (operatives managers for operatives) only. The live roster is the `users` query on `organizationId` (§1). A user may not change their own rates, pay basis, employment type, active flag, line manager or permissions — enforced by security rules. **Roles & permissions** opens Manage Users directly.

## 12. My Profile

Matches on every platform and updates live: profile photo (`profilePhotoURL`, with `profilePhotoUpdatedAt` set on every upload so other devices refresh the cached avatar), contact details, day/hourly rate and employment status (read-only), and billing details — VAT number and UTR — stored privately at `users/{uid}/private/taxIds` (`sensitiveProfile`). A photo upload stores a fresh download URL; a stale profile copy never removes or rolls back the photo.

## 13. Notifications

- **My notifications** toggles are personal (`users/{uid}.notificationPreferences`), written as dotted partial updates, and sync across platforms (`parseUserNotificationPreferences`, `userNotificationPreferenceFieldPatch`).
- Which toggles a person sees depends on role and features (`visibleNotificationPreferenceKeys`). People who can see variations (`canSeeVariations`: admins and managers) have a **Variations** toggle (`variations`, on by default) covering all five variation types. Admins and super admins have a **Company activity** toggle (`companyActivity`, on by default: "People, clients, jobs added and warnings removed.") covering the six company activity types; the older per-type toggles for them (`projectCreated`, `smallWorksCreated`, `operativeCreated`, `managerCreated`, `clientCreated`, `warningDismissed`) are retired — still parsed, never shown.
- A toggle turned off stops that notification type's **device push** everywhere (`notificationPreferenceAllowsDelivery`, `devicePushAllowed`; enforced by the push Cloud Function). It **never hides the inbox row**: every notice addressed to the person stays in the notification centre and the unread count, on every platform (`notificationShowsInInbox`, `NOTIFICATION_TOGGLE_HIDES_INBOX_ROW = false`). The app-icon badge counts the same unread rows.
- Types that send a device push are `DEVICE_PUSH_NOTIFICATION_TYPES`, including every variation type (`variation`, `variation_renumbered`, `variation_added`, `variation_from_tracker`, `variation_numbers_updated`).
- Organisation settings (material cut-off, schedule options) never appear in My notifications.
- Web never sends browser or OS notifications.

**Who receives each notification** (`lib/canonical/notificationRecipients.ts`). One rule per type, the same on every platform, and **never the person who caused it** (the actor) under any of their ids. Every recipient function is pure over the roster (`id`, `email`, `isActive`, `role`, `formerUserIds`, `sameEmailUserIds`, line-manager fields), drops inactive roster members, and de-duplicates ids without case. `personIdSet(person, roster)` is every id of a person (id, `formerUserIds`, `sameEmailUserIds`, roster rows with the same email); `excludeActor(ids, actor, roster)` removes them.
- Timesheets: `timesheetSubmittedRecipients(subject, roster)` — the subject's active line managers, else the active admins (never the subject); nobody when the sheet is self-signed. `timesheetSignedRecipients(subject, signer, roster)` — the subject, unless they signed. `lineManagerPeerRecipients(subject, actor, roster)` — the subject's other active line managers (no admin fallback).
- Annual leave: `holidayRequestRecipients(requester, roster)` — `leaveApproverIds` without the requester; nobody when the leave is self-booked. `holidayDecisionRecipients(requester, decider, roster)` — the requester, unless they decided.
- `bookingCreatedRecipients`, `deadlineAssignedRecipients`, `toolboxTalkRecipients`, `ideaRecipients` — the given ids without the actor.
- **Company activity** (`operative_created`, `manager_created`, `client_created`, `project_created`, `small_works_created`, `warning_removed`, `COMPANY_ACTIVITY_NOTICE_TYPES`): `companyActivityRecipients(actor, roster)` — the active admins and super admins outside operative mode, without the actor. One row per admin with `userId` and `actorUserId`; a row without `userId` is never written.
- **Push test** (`push_test`, Settings "send a test notification"): `pushTestRecipients(actor)` — the signed-in user only. It is the one type pushed to its actor (`notificationPushesToActor`); no toggle turns it off. On web its only effect is the inbox row.
- Job notices keep `materialOrderRecipients` and `receivesJobNotification`, then `excludeActor`. Neither has an "all admins" fallback: a job with no managers notifies no manager.
- Every inbox row an app writes carries `actorUserId` (the signed-in user who caused it; security rules require it to be that user when present). Scheduled notices nobody caused (`timesheet_submission_reminder`, `deadline_reminder`, `deadline_due`) leave it out. Notice dates shown in leave notices (`annualLeaveDecisionDateText` on web, `AnnualLeaveNoticeText.decisionDateText` on iOS) use the organisation business time zone. The push Cloud Function never pushes a row whose `userId` is its `actorUserId`, except a type whose push is for the actor (`notificationPushesToActor`: `push_test`).
- **The inbox is the rows addressed to the person.** `inboxNotificationVisibleToUser` and `unreadNotificationBadgeCount` count only rows whose `userId` is one of the person's ids; a row with no `userId` is not an inbox row and is never listed, counted or pushed. The push Cloud Function's app-icon badge counts the recipient's own unread rows the same way (bounded read).
- Timesheet notice document ids are each app's synthetic UUID of `timesheetNotificationDedupeKey` — the period start as unix seconds of midnight in the organisation zone (never the device calendar).
- **Device push tokens belong to the signed-in account only.** A token is written to `users/{uid}.pushTokens` of the account signed in on that device, never copied to other users documents on the same email; signing out removes this device's token from every users document it was written to. Known iOS gap: a forced sign-out (expired session, trial blocked) does not yet remove the token.
- `NOTIFICATION_CATALOG` is the table below (`notificationCatalogRow(type)`). Push follows `DEVICE_PUSH_NOTIFICATION_TYPES`. `variation_from_tracker`, `variation_numbers_updated`, `booking_clash`, `booked_onto_job` and `material_order_created` are on the push allow-list but nothing writes them. Status is the divergence each platform must fix to meet this section.

| Type | Trigger | Recipients | Push | Written by | Status |
|---|---|---|---|---|---|
| `holiday_request_submitted` | Leave request, or a request to cancel approved leave | `holidayRequestRecipients` | yes | web, ios | web: pass a roster with aliases (PersonalLeave). iOS: replace `filterRecipientsExcludingRequester` with `holidayRequestRecipients`. |
| `holiday_request_approved` | Leave request approved (or a cancellation accepted) | `holidayDecisionRecipients` | yes | web, ios | iOS: also writes this type for a manager-booked confirmation and to every admin (`notifyAdminAnnualLeaveApproval`); stop — only `holidayDecisionRecipients`. |
| `holiday_request_declined` | Leave request declined (or a cancellation refused) | `holidayDecisionRecipients` | yes | web, ios | iOS: also writes this type when a manager cancels leave and when self-book is switched off; route through `holidayDecisionRecipients` with the actor. |
| `timesheet_pending_manager_signoff` | Owner signs their timesheet (not self-signed) | `timesheetSubmittedRecipients` | yes | web, ios | both: recipients included the submitter and inactive managers; iOS remapped stale ids to same-email accounts. Use `timesheetSubmittedRecipients` and `timesheetNotificationDedupeKey`. |
| `timesheet_signed_by_manager` | Line manager or admin signs a timesheet | `timesheetSignedRecipients` | yes | web, ios | ok |
| `line_manager_peer_update` | One line manager signs a timesheet or decides leave for a shared report | `lineManagerPeerRecipients` | no | web, ios | web: not written for leave decisions (iOS is). Both: use `lineManagerPeerRecipients`. |
| `timesheet_submission_reminder` | Scheduled reminder before the submit deadline | `dueTimesheetSubmissionNotices` (schedule); recipients are each participating user | yes | web, ios | scheduled: rows carry `actorUserId`: null (nobody caused them). Who participates is still decided in each app; no shared recipient rule yet. |
| `material_order_placed` | A line is added to a job material list | `materialOrderRecipients`, then `excludeActor` | yes | web, ios | iOS: falls back to every admin when the job has no managers; there is no fallback — write nothing. |
| `variation` | Variation created | `receivesJobNotification`, then `excludeActor` | yes | web, ios | iOS: passes `assignedManagerUserIds`: [] to `receivesJobNotification`; pass the job managers. |
| `variation_renumbered` | Variation renumbered | `receivesJobNotification`, then `excludeActor` | yes | web, ios | iOS: passes `assignedManagerUserIds`: [] to `receivesJobNotification`; pass the job managers. |
| `variation_added` | Variation added to a job | `receivesJobNotification`, then `excludeActor` | yes | web, ios | iOS: passes `assignedManagerUserIds`: [] to `receivesJobNotification`; pass the job managers. |
| `toolbox_talk_issued` | Toolbox talk issued | `toolboxTalkRecipients` | yes | ios | iOS only. |
| `hs_toolbox_reminder` | Reminder to the people who have not signed a toolbox talk | `toolboxTalkRecipients` | yes | web | web: the actor is not removed; use `toolboxTalkRecipients`. |
| `booking_created` | People booked onto a job | `bookingCreatedRecipients` | yes | ios | iOS: the booker is not removed; use `bookingCreatedRecipients`. Web writes none. |
| `task_created` | Task assigned | `excludeActor` (the assignees) | yes | ios | iOS only. The Settings diagnostic writes `push_test`, not this type. |
| `push_test` | Settings "send a test notification" | `pushTestRecipients` (the signed-in user) | yes | web, ios | pushes to its actor (`notificationPushesToActor`); no toggle turns it off. |
| `task_completed` | Task completed | `excludeActor` (the task creator) | yes | ios | iOS only. |
| `deadline_assigned` | Assignees added to a deadline | `deadlineAssignedRecipients` | yes | web, ios | both: the actor is not removed; use `deadlineAssignedRecipients`. |
| `deadline_reminder` | Scheduled deadline reminder | the assignees (on-device schedule, no shared rule) | no | ios | iOS only. Scheduled: no actorUserId. |
| `deadline_due` | Deadline due | the assignees (on-device schedule, no shared rule) | no | ios | iOS only. Scheduled: no actorUserId. |
| `operative_created` | Operative added | `companyActivityRecipients` | yes | ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `manager_created` | Manager added | `companyActivityRecipients` | yes | ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `client_created` | Client added | `companyActivityRecipients` | yes | web, ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `project_created` | Project created | `companyActivityRecipients` | yes | ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `small_works_created` | Small works created | `companyActivityRecipients` | yes | ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `warning_removed` | Warning dismissed | `companyActivityRecipients` | yes | web, ios | one row per admin (`userId` + `actorUserId`); never written without `userId`. Toggle: `companyActivity`. |
| `idea_status` | Feedback idea status changed | `ideaRecipients` | no | web | web: the actor is not removed; use `ideaRecipients`. |
| `idea_shipped` | Feedback idea shipped | `ideaRecipients` | no | web | web: the actor is not removed; use `ideaRecipients`. |
| `idea_comment` | Comment on a feedback idea | `ideaRecipients` | no | web | web: the actor is not removed; use `ideaRecipients`. iOS: type missing from its enum. |
| `idea_merged` | Feedback idea merged into another | `ideaRecipients` | no | web | web: the actor is not removed; use `ideaRecipients`. iOS: type missing from its enum. |
| `material_order_cut_off` | On-device clock before the organisation material cut-off | the signed-in user (local notification, not an inbox row) | no | ios | iOS only. |
| `qualification_expiry` | On-device clock before a qualification expires | the signed-in user (local notification, not an inbox row) | no | ios | iOS only. |

## 14. Authentication and organisations

- Sign-in and passwords use Firebase Auth email/password on every platform; a password change applies everywhere. Every password — sign-up, invite set-up, reset, change — must be at least 8 characters; the platform owner's developer account needs 10 (`PASSWORD_MIN_LENGTH`, `passwordMinLength`, `passwordPolicyError` → "Password must be at least N characters."). The platform owner is `isPlatformOwnerEmail(email)` (`PLATFORM_OWNER_EMAIL`, compared without case); `passwordMinLength({ email })` applies the 10 for it. No complexity rule.
- **Switching organisation is per device.** Each platform remembers the last organisation it opened (web `pp.webActiveOrg:{userId}`, iOS `cached_organizationId`) and reopens to it (`chooseSessionOrganization`). Switching on one platform does not change another platform, and does not write `users/{uid}.organizationId`.
- **Membership is shared.** The list of organisations a person belongs to is shared data (`sessionMembershipIds`).

## 15. Platform-specific (not synced)

- Light and dark mode.
- Warning display order (Oldest/Newest).

## 16. Server-side permissions (Firestore security rules)

Deployed only from `project-planner-web/firestore.rules`. Apps hide controls too, but these rules are the guard:
- **Organisation:** only a current admin edits `organizations/{orgId}`; billing is never written by an app; ownership (`creatorUserId`) passes only from the current Super Admin to another admin (or by the platform owner). A demoted creator cannot edit.
- **Company settings documents** (`settings/{id}` such as job types and trades): admins and managers. Deadlines and health & safety documents stay open to the team.
- **Profile and pay:** a person cannot change their own pay (`dayRate`, `hourlyRate`, `payBasis`), line manager, active flag, employment type or permissions — on `users/{uid}`, `operativeProfiles/{uid}`, `operativeDayRateHistory`, `operatives/{id}` or `managers/{id}`. Pay changes are admins, or operatives managers for operatives (§8). Resending an unchanged value always passes.
- **Annual leave:** a person creates and edits their own pending request and asks to cancel. Nobody decides their own request, admins included (`canDecideLeave`). The person's line manager or an admin (not in operative mode) approves or rejects; a person with no line manager waits for an admin — never any manager. Only a self-booker (`canSelfBookAnnualLeave`: the `annualLeaveSelfBook` permission outside operative mode, or an admin / super admin outside operative mode with no current line manager) saves their own leave approved; having no line manager does not allow it for an operative or manager. The rules cannot read the whole roster: a person's line manager is "current" when one is listed that is not the person and, when exactly one is listed, that users document exists and is not `isActive: false`.
- **Timesheets:** a person never counter-signs or exports their own timesheet (their saves never carry those fields, `timesheetOwnerWriteFields`); only their line manager or an admin writes the sign-off and export fields and the review maps (`payrollLineReviews`, `extraEntryReviews`); after sign-off the person cannot change price work or expenses. The owner writes `weeklyReportOverride` only without a current line manager (same test as annual leave).
- **Notifications:** any member creates inbox rows; `actorUserId`, when present, is the signed-in user. Reads and updates are the addressee's own rows (or an admin's).
- **Warnings:** only admins and managers accept or un-accept a clash (create and delete `acceptedBookingClashes`) and approve, dismiss or undo a warning resolution.
- **Bookings:** tombstones as in §2, carrying only their own fields. Deleting a labour booking (`bookings`) and its tombstone is admin only; managers cancel instead.
- **Write metadata** (`updatedBy` = the signed-in user, `updatedFrom`, `updatedAt`) is validated when present and never required; tombstones never carry it.

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

### 1.4.0 — 2026-11-02
- Bank-holiday regions are one shared list (`BANK_HOLIDAY_REGIONS`, `bankHolidayRegionsForCountry`, `defaultBankHolidayRegionForCountry`, `normalizeBankHolidayRegionId`). Changing the company country asks for that country's region and the save waits for it (`companyDetailsRegionPrompt`, `companyDetailsValidationError`); Annual leave defaults offer only the company country's regions. Existing leave is never recounted (§4.1, §4.4).
- Company activity notices (`operative_created`, `manager_created`, `client_created`, `project_created`, `small_works_created`, `warning_removed`) go to the active admins outside operative mode, never the actor, one row each (`companyActivityRecipients`); admins get a Company activity toggle (`companyActivity`) and the six per-type toggles are retired (§13).
- `push_test` (Settings "send a test notification") reaches its sender: `pushTestRecipients`, `notificationPushesToActor`, and the push function's actor guard skips it (§13).
- Noted: iOS forced sign-outs do not yet remove the push token (§13).

### 1.3.0 — 2026-11-02
- Every operative and manager needs an active line manager, whatever the self-book permission or annual leave setting; only admins and super admins outside operative mode may have none (`lineManagerRequired`, `lineManagerRequiredError`, "Set a line manager — this person's timesheets and annual leave need approval.") (§8, §11).
- An admin or super admin with no active line manager is self-approved: their timesheet is self-signed (`timesheetSelfSigned`) and their leave saves approved behind a "Submit" button (`canSelfBookAnnualLeave(user, roster)`, `leaveSubmitLabel`). An admin with a line manager follows normal approval (§8, §9).
- Line managers and approvers are active only and never the person under any of their ids (`lineManagerIds(user, roster)`, `personIdSet`). With no line manager only admins decide — never any manager (`leaveApproverIds`, `canDecideLeave`, rules `hbCanDecide`) (§8, §9, §16).
- One recipient rule per notification type, never the actor (`notificationRecipients.ts`, `excludeActor`); `NOTIFICATION_CATALOG` is the §13 table with known app divergences in its Status column (§13).
- Inbox rows carry `actorUserId` (validated by the rules); the push function never pushes to the actor; the badge counts only the recipient's own unread rows — ownerless rows are not inbox rows (`unreadNotificationBadgeCount`) (§13, §16).
- Timesheet notice de-dupe keys use the organisation-zone day (`timesheetNotificationDedupeKey`). A device push token belongs to the signed-in account only and is removed from every users document on sign-out (§13).

### 1.2.0 — 2026-10-31
- Booking tombstones carry only their own fields and are the one exception to write metadata (§1, §2).
- Annual leave: self-booking is the `annualLeaveSelfBook` permission outside operative mode only (`canSelfBookAnnualLeave`). Anyone who does not self-book must have a current active line manager (`lineManagerRequiredError`, `usersMissingLineManager`). Nobody decides their own request; admins decide any request (`canDecideLeave`, `leaveDecisionQueue`). Holiday deletes follow the same deciders (§8, §9, §11, §16).
- Operative clashes come from `operativeClashGroups`, one approval pair per overlapping pair; a cluster is approved only when every pair is (`isClashGroupApproved`). Managers may un-approve (§5, §16).
- Only approvals count as approved clashes (`approvedWarningKeys`); a dismissed clash is hidden but not approved (§5).
- Document ids keep their stored case and compare without case (`normalizeDocumentId`) for warning keys, clash pairs and timesheet entry reviews (§1).
- Offline: the §2 table is exported (`OFFLINE_ACTIONS`, `offlineAvailability`, the three messages). Deleting a booking is online only; a not-found edit replay is final (`bookingReplayRefusedIsFinal({ code, isCreate })`). Labour booking deletes stay admin only (§2, §16).
- `unbookedScanDays`, `warningLookaheadFallbackNotice` and `isPlatformOwnerEmail` are in the packed script (§5, §14).
- Clearing a rate writes a "rate not set" history row, and history days are organisation-zone midnight (`payRateHistoryWriteFields`) (§8).
- PAYE and leave lines never appear on any invoice (`invoiceLines`) (§8).
- `timesheetOwnerWriteFields` drops sign-off and export fields itself; owner saves and leave edits are partial updates (§1, §8, §9).
- `ORGANIZATION_DOCUMENT_FIELDS` and `OPERATIONAL_COLLECTION_PATHS` are in the packed script; `profilePhotoUpdatedAt` is a user field (§1, §12).
- Documented: the live roster is the `organizationId` query; the legacy literal `settings.currencyCode` field is left in place (§1, §4.2, §11).

### 1.1.0 — 2026-10-31
- My notifications toggles stop the device push only; the inbox row and unread count always show the notice (`notificationShowsInInbox`, `devicePushAllowed`). The app-icon badge matches the inbox.
- Every variation notification type sends a device push (`variation_renumbered`, `variation_added`, `variation_from_tracker`, `variation_numbers_updated` join `variation`).
- Pay and manager decisions are protected on every path (security rules and shared rules; see §8 and §16).

### 1.0.0 — 2026-10-31
- First versioned rulebook. Consolidates the rules previously spread across `docs/CANONICAL_ARCHITECTURE.md`, `AGENTS.md` and the iOS copies into this one file, mirrored to iOS.
- Decisions: organisation currency used for every money figure (11 currencies, country default); one business time zone per organisation from its country; fixed Monday–Sunday week; scheduled working-hours changes on every platform; recurring payment runs paid in arrears after the work period; weekend clashes checked when a weekend booking exists; overlapping bookings each paid and shown in amber; PAYE days shown at 0; annual leave shown on timesheets as information (never on invoices); one leave document per request with a decision note; weekly reports never stored; booking tombstones stop offline resurrection; password minimum 8; Variations notification toggle; write metadata `updatedBy` / `updatedFrom`.

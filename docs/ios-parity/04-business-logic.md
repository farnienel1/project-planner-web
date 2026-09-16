# 04 — Business logic

> Spec: rebuild Phase 1 `04-business-logic.md` · Blueprint starting point: §1.4, §1.5, §7.
>
> Port these as **pure TypeScript** with unit tests **before** the screens that use them (Phase 2 for Home/shell/permissions; remaining modules at the start of the section that needs them). Function names should match Swift. Time zone **Europe/London**. Weeks **Monday-first**.
>
> Swift files were not opened. The rules below are from the blueprint; 3A must extract edge-case tests from the actual functions (clock-change days, wrapped pay runs, scheduled policy changes, PAYE days, half days, bank holidays).

## 1. Module map

| Swift | What it does | Web module |
|---|---|---|
| `Core/PayrollHoursEngine.swift` | **Single** payroll calculation: slots, custom hours, break, standard window, weekday OT outside window, Sat/Sun rules, AM/PM = half standard day | `lib/payroll/hoursEngine.ts` |
| `Core/PayrollTimePolicyCatalog.swift` + scheduled change | Which policy applies on a day (prior / current / scheduled); `yyyy-MM-dd` day keys | `lib/payroll/policyCatalog.ts` |
| `Core/PayrollRateResolver.swift` | Rate on a day: history, hourly XOR day rate, **£0 on PAYE days** | `lib/payroll/rateResolver.ts` |
| `Core/PayrollPolicyBookingRecalibrator.swift` | Adjust bookings when working-hours policy changes | `lib/payroll/recalibrator.ts` |
| `Core/TimesheetPayrollPolicy.swift` | Current / last completed pay run, pay date, previous periods; timesheet access; who appears on a manager’s list | `lib/timesheets/policy.ts` |
| `Core/TimesheetPayrollCollector.swift` | Payroll lines for a person + period | `lib/timesheets/collector.ts` |
| `Core/InvoicingPeriodResolver.swift` | Current invoicing period; warnings scan range | `lib/timesheets/invoicingPeriod.ts` |
| `Core/WeeklyReportExportBuilder.swift` | Weekly report `.xlsx` + PDF content | `lib/reports/weeklyReport.ts` |
| `Models/AnnualLeavePolicy.swift`, `Core/AnnualLeaveCalendarRules.swift` | Leave-year bounds (wrap), consumption, half days, carry-over, bookable days | `lib/leave/*` |
| `Core/BankHolidayService.swift`, `Core/BankHolidayRegionDirectory.swift` | Fetch, UK-region filter, cache | `lib/leave/bankHolidays.ts` |
| `Core/WarningsComputation.swift` + Service + RefreshHelper + models | Clashes, unbooked labour, material cut-off, priorities, exclusions | `lib/warnings/*` (partial web exists; rewrite against Swift) |
| `Core/ScheduleBookingConflictSupport.swift`, interval models, `ScheduleDateSelectionPolicy.swift` | Intervals, overlap, selectable dates | `lib/schedule/*` |
| `Core/WorkAccess.swift` | Job visibility, live users on a job, deadline notification text | `lib/access/workAccess.ts` |
| `Core/UserStore.swift` permissions, `QualificationsAccessPolicy.swift`, `UserRoleTransitionPolicy.swift`, `LineManagerSupport.swift`, `ProjectManagerPickerSupport.swift` | Permissions + role changes | `lib/permissions.ts`, `lib/users/roleTransition.ts` |
| `Views/HomeUpNextSupport.swift`, `HomeOverviewMetrics` | Up Next + Home metrics | `lib/home/*` |
| `MaterialCatalogCSV.swift`, `MaterialCatalogDuplicateDetection.swift`, `MaterialRequestEmailBuilder.swift` | CSV, duplicates, quote/order HTML | `lib/materials/*` |
| `SiteAuditPDFBuilder.swift` | Audit PDF + org abbreviation badge | `lib/pdf/siteAudit.ts` |
| `OrganizationCurrencyCatalog.swift`, `CountryCapitalDirectory.swift`, `OrganizationMembershipSupport.swift` | Currencies, default map centre, trial policy | `lib/org/*` |

**Do not port:** SmartCache / Persistence / DataPersistenceManager, Offline* outbox, LocalNotificationService, PlaygroundDemoSeeder (never run against live).

Web already has fragments: `lib/warnings/*`, `lib/timesheets/*`, `lib/scheduling/*`, `lib/navigation/menuPermissions.ts`, `lib/annualLeave/*`, `lib/weekly-report/*`. Treat them as **suspect** until they match Swift tests.

## 2. Hours, overtime, breaks, rounding

**Source of truth:** `PayrollHoursEngine` only. Anywhere the UI shows hours (My Schedule, booking sheets, timesheets, weekly report) must call this.

From Blueprint §5.3 / §7 (details ❓ until Swift is read):

- Standard window from `payrollTimePolicy.standardDayStart` / `End` (default 07:30–16:00).
- Unpaid break `unpaidBreakMinutes` **Int** default 30 unless `breakPaid` or `isBreakRemoved`.
- `standardPaidHours` default 8.
- Weekday hours **outside** the window × `weekdayOutsideStandardMultiplier` (default 1.5).
- Saturday: default custom window 07:30–13:00 counting as 8h, ×2 outside; or `allHoursAtMultiplierMode`.
- Sunday: default all hours ×2; `sundaySameAsSaturday` can copy Saturday.
- Slot `AM` / `PM`: **half** the standard paid day.
- `FULL DAY` / `FULL_DAY`: standard day.
- `CUSTOM_HOURS`: `workStartTime`–`workEndTime` `"HH:mm"`.
- `Evening` / `Overtime`: ❓ UNVERIFIED — read engine.
- `otMultiplierOverride` on a booking overrides policy when set.

**Rounding:** not stated in the blueprint. Rebuild §11 example even flags 0.25h vs 0.5h. **Do not invent.** Extract from `PayrollHoursEngine.swift` in Phase 2/3A. Until then mark ❓.

## 3. Pay, VAT, markups, invoicing

- Rate: `dayRate` **or** `hourlyRate`, never both. History in `operativeDayRateHistory` with `effectiveAt`.
- PAYE days: resolver returns **£0** (`PayrollRateResolver`).
- PAYE users: My Timesheets stays available until the **open pay run is paid**, then a disabled message (`TimesheetPayrollPolicy`). Self-employed get My Timesheets. Managers/admins with assigned operatives get Operative Timesheets.
- Payment runs: `invoicing.paymentRunMode` `date_ranges` (1–2 ranges covering days 1–31, wrap allowed, short months trimmed) or `recurring_timeframe` (weekdays). Payment dates: up to 2 calendar days or a recurring weekday.
- Timesheet totals: hours subtotal + price work + expenses, plus line-manager adjustments (`payrollLineReviews`, `managerRevisedAmount`).
- Generate Invoice: UTR-blank warning (`InvoiceUTRBlankWarningSheet`); PDF via Storage `timesheetExports/` + email function.
- VAT number / UTR stored on the user; not a computed markup. Material quotes/orders have no VAT engine in the blueprint.

## 4. Annual leave

- Feature flag `annualLeaveEnabled` (default true). Off → “Annual leave is turned off” copy (full text in 3A).
- Entitlement: `annualLeaveDaysPerYear` in **0.5 steps**; year `startMonth`–`endMonth` (1–12) **can wrap**; `carriesOver` optional.
- Org defaults for new users: 25 days, Jan–Dec, no carry (`annualLeaveDefaults`).
- Half day = 0.5. Calendar: Monday-first; marks weekend, bank holiday, taken (green), pending (red), half (orange).
- Self-book (`annualLeaveSelfBook` **or** `hasNoLineManager`) → bookings created **approved**. Else **pending** to `assignedManagerUserIds`, or admins if none.
- Approving/declining sends `holiday_request_*` notifications.
- Turning self-book off: confirm “Turn off Annual Leave Management?”; clears self-booked leave; notifies user. Role transition: switching onto self-book deletes **pending requests** only; approved bookings stay (`UserRoleTransitionPolicy`).
- Overlap alert “Annual Leave Overlap”. Remove confirm: green Yes / red No.
- Bank holidays: Nager.Date `{year}/{countryCode}` filtered by org region. CORS may require a proxy (Gate 1).
- Cancellation request: `cancellationRequestedAt` + by uid; “Cancellation pending manager approval”.

## 5. Job status, progress, numbering

- **Status is calculated**, not stored: Inactive if `!isLive`; Upcoming if today &lt; start; Completed if today &gt; end; else Active (`ProjectsView` pills).
- **Progress** on work cards: elapsed time start→end; 100% if completed or past end.
- Job number is free text (“Project reference”). Org `documentAbbreviation` (1–3 chars) is for PDF badges, not auto-numbering.
- New jobs: `manager: "Custom"`, `managerIds` = selected roster, `isLive: true`.
- Max **500 tasks** per project; Home admin banner when any project hits the cap: “Warning: Task limit reached” / “{jobNumber}: Delete first 50 completed tasks…”.
- Small works are a **subset in memory**; never concatenate lists (`ProjectWorksMerge`). Site map: projects blue, small works red, maintenance orange.

## 6. Tasks

- New task requires title, assignee, **due date** (“Every task must have a due date.”). Until valid: “Add a title and assignee to continue”.
- Completing requires checklist ticks; proof of work + notes optional; failure “Cannot complete task”.
- Notifications `task_created` / `task_completed`.
- Scopes on Tasks screen: Assigned to me, Active, Overdue, Completed; plus Holiday approvals and Qualification reminders.

## 7. Scheduling / clashes

- Operative bookings: `timeSlot` with **space** `FULL DAY`. Manager site bookings: `FULL_DAY` **underscore**. Mixing these is a parser footgun.
- Group bookings share `bookingGroupId`.
- Clash review must be acknowledged before confirm (“Acknowledge each clash above…”).
- iOS clash **dismissals for warnings** are UserDefaults (`WarningResolutionStore`) — not Firestore. Web `acceptedBookingClashes` is web-only and will not match the iPhone.
- Book labour “Other” locations require org My Schedule options enabled.
- Restriction: “Office and site attendance booking is only available to administrators and managers.” Operatives: My Schedule view-only.

## 8. Warnings

- Admins. **Never auto-scan on Home.** Manual Refresh. Home badge = cached count.
- High: operative/manager/admin booking clashes + unbooked labour (empty-state copy).
- Material cut-off extra line: “Managers should confirm material lists with site teams.”
- Dismiss copy: “Are you sure you would like to dismiss this warning? Any warnings that are dismissed will not reappear again…” + “All admins will get a notification with who dismissed it…”; buttons “Dismiss permanently” / “Keep warning”.
- Exclusions: `warningDetection` + excluded users (org settings).

## 9. Materials

- Quantity **Int**. Duplicate catalogue: “Duplicate material” Cancel / Add anyway.
- CSV 5MB; exact header (see 01); filenames `material_catalogue.csv` / `material_catalogue_upload_template.csv`.
- Send quote/order emails via Cloud Function HTML from `MaterialRequestEmailBuilder`. Writes `materialSendRecords`; updates `lastSentAt` + line `status`.
- Operatives with materials flag: add lines, **cannot send**.
- Cut-off reminder: org + user notification prefs (`materialCutOffHour/Minute`, Sat/Sun). iOS schedules **local** notifications.

## 10. Site audit / H&S / deadlines

- Audit photos: max side 1280, JPEG 0.72; PDF embeds ≤720px. Types General / Variations / Snags. Operative visibility: `visibleToOperatives` missing counts as true, plus creator, on visible jobs.
- H&S stored in `settings/healthSafety_*` (not the rules’ nested `healthSafety` subcollection). Toolbox library: `Resources/TOOLBOX-TALK-LIBRARY.md`. Signatures base64 PNG.
- Deadlines: statuses `notStarted` / `inProgress` / `blocked` / `complete`; history on reschedule; reminders N days before (**local** notifications on iOS); assignments in `settings/deadlineAssignments` feed `WorkAccess` for operatives.

## 11. Dates, locale, formatting

- Display locale: device (UK). Payroll/material emails: `en_GB`.
- Currency default `£` / GBP (`currencyCode`).
- Day fields: local midnight Europe/London as Timestamp.
- Day keys: `yyyy-MM-dd`.
- Times of day: `"HH:mm"`.
- Date row on work cards: `d MMM yyyy – d MMM yyyy`. Detail timeline: `dd MMM yy – dd MMM yy`.
- Up Next headings: ordinals “Wednesday 17th September”.
- Home date line: full weekday + day + short month (“Tuesday 16 Sep”).
- Weeks: Monday first (`MondayFirstCalendarSupport`).
- Timesheet doc id: `Int(startOfDay(weekStart).timeIntervalSince1970)` London.

## 12. Validation and wording (high level)

Full strings live in 3A specs. Critical ones already in the blueprint:

- Duplicate invite email: “A user with the email address '{email}' already exists in this organization…”
- Delete client: “Are you sure you want to delete {name}? This action cannot be undone.”
- Delete user/operative: booking-count variants; cannot delete org creator.
- Sign out: “Are you sure you want to sign out?”
- Delete organisation: **not available in the app** — info alert only.

## 13. Notifications

- Inbox: targeted `userId` or null, filtered by `requiresPermission`.
- Creating users/jobs/tasks/holidays/timesheets/materials cut-off/quals expiry/clashes writes `organizations/{orgId}/notifications`.
- Deep links: Blueprint §2.4 / `02-navigation-map.md`.
- iOS-only local: material cut-off, qualification expiry, deadline reminders. Web equivalent = web push (ask).

## 14. Exports

| Export | Builder | Output |
|---|---|---|
| Weekly report | `WeeklyReportExportBuilder` | `.xlsx` + PDF, same layout |
| Site audit | `SiteAuditPDFBuilder` | PDF + abbreviation badge |
| Timesheet / invoice | `InvoicingView` / generator | PDF to Storage + email |
| Material catalogue | `MaterialCatalogCSV` | CSV |
| My Schedule | `ScheduleCalendarExport` | Google / Outlook / Apple deep links + `.ics` |
| Holiday report | `HolidayReportView` | ❓ format in 3A |

## 15. Permission checks

See `01-data-model.md` §9 and Blueprint §1.4–1.5. Web `menuPermissions.ts` must be replaced, not extended, once `lib/permissions.ts` matches Swift (including `canManageSubcontractors` loading=true, `canViewProjects` always true, timesheet surface from `TimesheetPayrollPolicy`, qualifications hub policy).

## Blueprint corrections

None proven. Open ❓:

1. Exact overtime rounding.
2. Evening / Overtime slot maths.
3. Whether editing a client rewrites embedded `client` maps on jobs.
4. Full `QualificationsAccessPolicy` boolean.
5. Full `visibleToOperatives` / `canEditSiteAudit` rules.
6. Warning priority ranking table.

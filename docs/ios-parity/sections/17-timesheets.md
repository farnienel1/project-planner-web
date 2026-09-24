# 17 — Timesheets

iOS source: `Views/InvoicingView.swift` hub + `MyTimesheetsHubView`, `Core/TimesheetPayrollPolicy.swift`, `Core/InvoicingPeriodResolver.swift`.

## Hub
Title **Timesheets**. CURRENT PAYMENT RUN card shows the **period containing today** from org payment-run settings (calendar dates, month-clamped), then **this run’s pay date** (first payment day on/after the period end, otherwise the first payment day next month). Example: 21 Sep with ranges 16–31 and pay days 19 & 5 → **16 – 30 September 2026**, **Paid on 5 October 2026**. Recurring runs use the current week window and the next recurring pay day. Optional note-to-users sits under that.

Tiles: My Timesheets; User/Operative Timesheets for managers/admins; PAYE disabled copy when employment type blocks My Timesheets. Past runs are **not** a separate hub page.

## My Timesheets
`/dashboard/timesheets/mine`. Current pay run period card, then **Past timesheets**. Detail is the signed-in user only (never the org roster). Hours come from bookings / manager site bookings across the **pay period**, including a single booked day. Empty copy matches iOS when nothing is booked yet.

## User Timesheets
`/dashboard/timesheets/team`. Tabs **Awaiting sign-off / Signed off / Exported** (iOS `OperativeTimesheetsView`). Admins see the org roster; managers see people who report to them (`assignedManagerUserId` / `assignedManagerUserIds`). Nested heading: Timesheets (back to hub) + User Timesheets. The left-menu Timesheets item and that back control open `/dashboard/timesheets` with no query. Older `?surface=mine` / `?surface=team` links redirect onto these paths.

## Access
`canAccessTimesheetsSurface` = my timesheets (self-employed) OR operative timesheets (manager/admin) OR PAYE disabled message.

Full payroll extras / signature pad / invoice PDF engine remains a later slice of this section.

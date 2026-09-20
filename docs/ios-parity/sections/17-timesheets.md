# 17 — Timesheets

iOS source: `Views/InvoicingView.swift` hub, `Core/TimesheetPayrollPolicy.swift`, `Core/InvoicingPeriodResolver.swift`.

## Hub
Title **Timesheets**. CURRENT PAYMENT RUN card (Day a–b or recurring arrears + paid-on line).
Tiles: My Timesheets; User/Operative Timesheets for managers/admins; PAYE disabled copy when employment type blocks My Timesheets.
Previous Timesheets is reached from the hub (web convenience; iOS keeps past runs under My Timesheets).

## Inner surfaces
`?surface=mine|team` reuses the existing week hours table (bookings + manager site bookings) for the current payment-run period. Full payroll extras / signature pad / invoice PDF engine remains a later slice of this section.

## Access
`canAccessTimesheetsSurface` = my timesheets (self-employed) OR operative timesheets (manager/admin) OR PAYE disabled message.

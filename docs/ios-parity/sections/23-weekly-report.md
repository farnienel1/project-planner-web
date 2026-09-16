# 23 — Weekly Report

## Evidence
- `Views/WeeklyReportView.swift`
- `Views/WeeklyReportLaunch.swift`
- `Core/WeeklyReportExportBuilder.swift`

## Period
Monday-first week (`weekStartsOn: 1`).
Quick Select: **This Week**, **Last Week**, **Current invoicing period**.
Custom Range: Start / End.
Invoicing Period picker from org settings.

## Generate
**Generate Report** builds HTML from live Firebase stores (bookings, managerSiteBookings, smallWorks, projects, holidays, subcontractorBookings, users, operatives) via `buildWeeklyReportData`.
Sections: Warnings Summary, Project Breakdown (projects + small works), Sub Contractors, Annual Leave, Manager/Admin Additional Schedule, Pay Summary.

## Permissions
`canViewWeeklyReports` → `permissions.weeklyReports`.

## Desktop
Period controls in a header card; report tables full width.

## Out of this chat
Native xlsx/pdf binary (web exports HTML print/download). PayrollHoursEngine (section 17) still estimated in related hours views.

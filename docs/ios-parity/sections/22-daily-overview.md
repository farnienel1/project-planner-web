# 22 — Daily overview

## Evidence
- `Views/DailyOverviewView.swift` (read in full for layout, grouping, unbooked, empty states)
- Access: `canViewDailyOverview`. Title “Daily overview”.

## Layout
Date navigator (prev / “EEEE, d MMMM yyyy” / next). “Today · Tap to change”.
Hero “TODAY AT A GLANCE” / “DAY AT A GLANCE”: hours, people, unbooked capsule, Standard hrs / OT / Jobs active, **WHERE THE TEAM IS** bar, Office / WFH / On site.
Weekdays only: **Unbooked labour** (“n people”, chips with initials, **Book labour** if admin or manager).
**Annual leave** (approved covering the day).
**Other**: Office, Working from home, custom locations.
**Site survey**.
**By project** cards + “Open project” / “Open small works”.
Empty: **No bookings**.

## Desktop
Date picker in header. Job cards 2–3 columns. Unbooked / leave / other in the right column.

## ⚠️ Payroll hours
Hero OT and “missing Nh” use estimated slot/clock hours (full day = 8h) until `PayrollHoursEngine` (section 17). Grouping and wording match iOS.

## Book labour
Web: `/dashboard/schedule?date=yyyy-MM-dd` (iOS sheet `BookLabourFlowView` is section 14).

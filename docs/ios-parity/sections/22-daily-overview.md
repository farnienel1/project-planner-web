# 22 — Daily overview

## Evidence
- `Views/DailyOverviewView.swift` (read in full for layout, grouping, unbooked, empty states)
- Access: `canViewDailyOverview`. Title “Daily overview”.

## Layout
Date navigator (prev / “EEEE, d MMMM yyyy” / next). “Today · Tap to change”.
Hero “TODAY AT A GLANCE” / “DAY AT A GLANCE”: hours, people, unbooked capsule, Standard hrs / OT / Jobs active, **WHERE THE TEAM IS** bar, Office / WFH / On site.
Weekdays only: **Unbooked labour** (“n people”, chips with initials, **Book labour** if admin or manager).
**Annual leave** (approved covering the day; subtitle “Annual leave”).
**Other**: Office, Working from home, custom locations.
**Site survey**.
**By project** cards: job number + site name + SMALL WORKS badge, “N people · Xh booked”, **person rows** (operative / manager / subcontractor) from Firebase bookings, footer “Open project” / “Open small works”.
Empty: **No bookings**.

Bookings are loaded with getDocs + live `onSnapshot` on `organizations/{org}/bookings` and `managerSiteBookings`. Date match uses London day, local calendar day, and UTC date-only so iOS and web see the same day.

## Desktop
Date picker in header. Job cards 2–3 columns. Unbooked / leave / other in the right column.

## ⚠️ Payroll hours
Hero OT and “missing Nh” use estimated slot/clock hours (full day = 8h) until `PayrollHoursEngine` (section 17). Grouping and wording match iOS.

## Book labour
Web: `/dashboard/schedule?date=yyyy-MM-dd` (iOS sheet `BookLabourFlowView` is section 14).

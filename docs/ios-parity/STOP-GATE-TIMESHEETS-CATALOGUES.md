# Stop Gate — Timesheets sub-pages, catalogue restore, wholesalers/history

Date: 2026-09-21
Branch: `cursor/timesheets-quals-catalogues-fix-6b85`

## What shipped

### Timesheets
- Current payment run card uses the **period containing today** and **this run’s pay date** (21 Sep + 16–31 + days 19 & 5 → 16–30 September, paid 5 October).
- My Timesheets is the signed-in user only, pay-period hours from bookings (including one day), with Past timesheets in-page. Previous Timesheets hub tile removed.
- User Timesheets tabs: Awaiting sign-off / Signed off / Exported. Admins see the roster; managers see their reports.
- One Timesheets back control + My/User Timesheets heading. App shell no longer doubles the page title on these screens.

### Qualifications / job types
- Org qualification templates restore from names still assigned on operative profiles. Cause: iOS load required `hasEndDate` as Bool then delete-all rewrite; expiry dates on assignments did not delete templates.
- Job types restore from `jobType` / `customJobType` on projects and small works when `settings/jobTypes` is empty.

### Other catalogues
- Wholesaler quote/order history shows line items. Lenient load so missing timestamps do not hide rows.
- Material catalogue uses iOS category sections. Empty CSV cannot wipe the catalogue.
- Subcontractor/material loads no longer drop docs for missing timestamps.

### Rule
`.cursor/rules/ios-parity-upgrades.mdc` — iOS web upgrades must include nested screens and behaviour, not hub-only.

## Not in this slice
- Full timesheet extras / signature pad / invoice PDF engine.

## How to verify
1. Timesheets hub on 21 Sep with 16–31 / pay 19 & 5 shows 16–30 September and Paid on 5 October.
2. My Timesheets: only you; one booked day in 16–30 appears; Past timesheets listed.
3. User Timesheets: three tabs; no other-org users on My Timesheets.
4. Organisation Qualifications lists names that exist on staff profiles; Job Types lists names still on projects.
5. Wholesaler history shows material lines. Material catalogue groups by category.

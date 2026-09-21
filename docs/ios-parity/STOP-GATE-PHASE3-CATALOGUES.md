# Stop Gate — Phase 3 catalogues + Switch organisation

Date: 2026-09-20
Branch: `cursor/phase-3-catalogues-switch-org-6b85`

## What shipped

### 1. Switch organisation / empty same-name orgs
Activate was minting a new pending org UUID on every retry and immediately writing `users.organizationId` onto it. That listed many identical names with no projects, and hid the real workspace.

- Reuse the newest pending org with the same name for the same creator on Activate retry.
- Do **not** switch away from a paid/complete org when starting another organisation. Switch only after that new org is activated (Stripe success or test Activate).
- Switch list shows **Created {date}**, short **ID**, and **Setup incomplete**. Incomplete rows are not switchable. Complete orgs sort above incomplete copies so the workspace with data is obvious.

### 2. Phase 3 screens (desktop-first)
Job Types, Qualifications, Wholesalers, Material catalogue, Sub contractors, Timesheets hub — rebuilt from iOS copy, layout, and Firestore write style.

## Not in this slice
- Full timesheet payroll extras (price work, expenses, signature pad, invoice PDF). Hub + current-run hours table are in. Engine port is still later in §17.
- Trade-type inventory settings document (subcontractor trade field still accepts free text + existing trades).

## How to verify
1. Switch organisation: same-name rows show date + ID; Setup incomplete is disabled; the org with projects is labelled and clickable.
2. Start another organisation, cancel before payment — you stay on the live org.
3. Job Types Management: add/delete overwrites `settings/jobTypes`.
4. Qualifications: name-only templates + My Qualifications.
5. Wholesalers / Sub contractors: list+detail, editors, iOS copy.
6. Material catalogue: add item, CSV download/upload.
7. Timesheets: payment-run card + My / User Timesheets tiles.

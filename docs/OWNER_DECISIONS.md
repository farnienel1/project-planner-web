# Owner decisions register

Every product decision the owner has made, with the date and the release that delivers it. **Every Claude session reads this before planning work** (imported from `CLAUDE.md`). The rulebook (`docs/RULEBOOK.md`) is the specification; this file is the reason behind it and the list of what is still owed.

How to use it:
- A new decision is added here in the same change that acts on it, or by the session lead the day it is made: date, what was decided, and the release.
- When a release delivers it, set **Status** to `done (vX.Y.Z / PR #n)`. Never delete a row. A decision the owner reverses gets a new row that names the old one.
- `open` means decided but not built yet. `question` means waiting on the owner.
- Plans, PRs and hand-offs quote the rows they implement (`docs/agent-rules/feature-completeness.md`, step 4).

## Standing rules

| Date | Decision | Status |
|---|---|---|
| 3 Nov | Every change considers all three: web app, iOS app, shared rulebook. Every brief and PR has a 3-factor table (Web / iOS / Shared rule). | standing |
| 4 Nov | Nothing drops off: every call site, every way in, every decision accounted for (`feature-completeness.md`). | standing (#261) |
| 4 Nov | Guardrails 1–7 (`platform-guardrails.md`): one person-ids rule, organisation time zone only, never hide old data, release order, rules size budget, this register, UI-only means UI-only. A sweep of both apps for second calculators, plus CI checks. | open |
| 4 Nov | Firebase rules and functions are deployed by the owner by hand from Terminal; Claude sends the exact commands. No automated deploy for now. | standing |
| 4 Nov | **Release split** (owner: "happy with your suggestion"). 1.32: overtime multiplier, PAYE payday, overtime review, price work and expenses review, rulebook version in Settings. 1.33: remove Cancel, PAYE ✕ deletes once approved, iOS offline delete (built on a merged 1.32; Cancel removal and PAYE ✕ ship together). 1.34: ghost operatives. Each release has its own deploy and test list. | standing |
| 4 Nov | `minimumIosBuild` is raised before 1.32 switches on; older iPhone builds must update (pre-launch, testers only). Claude sends the owner the exact steps. | open: owner steps in PR #274 Deploy needed (raise after the iOS 1.32.0 build ships) |
| 4 Nov | 1.32: the rulebook version (e.g. "Rules 1.32.0") is shown to **everyone** at the bottom of Settings on web and iOS. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | Cross-referencing safeguards A–F ("all yes"): A screen map (web ↔ iOS ↔ rulebook functions per screen); B PR checklist enforced by CI; C an independent reviewer checks every PR against this register, the screen map and the other app before merge; D shared test scenarios for both apps; E a weekly drift check; F checkpoint test lists generated from this register. Accepted that changes take longer. | open (A, B, E being built; C applies from now; D after A; F at the next checkpoint) |
| 11 Nov | **Fix on both apps.** Whatever platform an issue is reported on (web or iOS), it is checked and fixed on both apps and against the shared rulebook; the PR's 3-factor table says what changed on web, iOS and the rule, or why nothing needed to. | standing |

## Scheduling, bookings and working hours

| Date | Decision | Status |
|---|---|---|
| 4 Nov | **Who may delete a labour booking:** admins any booking; managers bookings on jobs they are assigned to (current rule A, `canDeleteBooking`), plus their own office/WFH/site-survey bookings. Operatives never. | done (rule since 1.10.0; iOS wording fixed #186) |
| 4 Nov | **Cancel is removed as a user action**: bookings are Book / Edit / Delete only. Old Cancelled bookings stay hidden; no data is changed. Web removes the "Cancel booking" button. | open (1.33, split) → done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 4 Nov | **PAYE overtime ✕ on an all-overtime day** (weekend, or entirely outside working hours): the operative's ✕ is a request to their line manager and all admins (notified); on approval the booking is **deleted** (not cancelled). Rules: the approving line manager may delete that one booking even if not the job's manager. Lines under an older record still need an admin (decision A). No line manager / Super Admin: applied directly after the warning. | open (1.33, split) |
| 4 Nov | **Offline delete on iOS** ("offline delete: all recommended"): deleting a labour or manager-schedule booking works offline. It queues with its tombstone and shows "Pending sync", undo from the sync list. A booking created and deleted offline sends nothing. If the booking was changed on another device after the offline delete, the replay is **refused** with "changed on another device — not deleted". If permission was lost, it is refused and the booking reappears with a message. Subcontractor bookings stay **online only**. Deleting a booking on a day that is on a signed timesheet **warns but allows** (the signed sheet never changes). Fixes the two existing iOS outbox bugs (refusal detection, lower-case schedule ids). Web stays online only. | open (1.33, split) |
| 3 Nov | Weekend set-window part booking is pro rata: counts-as hours on the day's own Saturday or Sunday settings. 07:30–11:00 in a 07:30–14:00 window counting 8h = 4.31h. Saturday outside-window example 9.5h confirmed. | done (1.20.4) |
| 3 Nov | Bookable jobs: live only, visible to the booker, and `canWriteBooking`. Job start and end dates are not checked. | done (1.21) |
| 3 Nov | Job visibility is by account and email only, never by name. | done (1.21) |
| 3 Nov | Book Labour "covered" uses the web clock-time rule (`standardDayCoverage`, lunch excluded); iOS adopts it via `managerCoverageHours.covered`. | done (1.22) |
| 4 Nov | A booking's own overtime multiplier (`otMultiplierOverride`) is edited in Edit Booking by admins and managers (never operatives), 1–3 in 0.25 steps. It applies to self-employed pay too, so raise `minimumIosBuild` before enabling. | done (1.29), see 1.32 |
| 4 Nov | 1.32: every custom-hours create screen gets the multiplier, pre-filled with the organisation rate for that day. The weekly report shows the multiplier per overtime row ("2h at ×1.5 = 3h") and marks rows changed from the organisation rate. Raise `minimumIosBuild` first. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | 1.32 multiplier, owner chose **A**: the multiplier is stored on the booking (`otMultiplierOverride`) only when the person changes it from the pre-filled organisation rate. Bookings left at the organisation rate follow later rate changes, including scheduled ones, and only edited rows are marked on the weekly report. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | Book labour lists exactly the warning's unbooked people (`unbookedLabourRowsOnDay`), weekends included when the setting is on. | done web (#262); iOS already |
| 4 Nov | Judgement call in #262: an operative with an app login but no Operatives-list row is booked under their users id from web Book labour (the rulebook counts it, `bookingIdsForAccount`). iOS already booked them since iOS #187; from iOS #198 every iOS way in asks `bookingIdsForAccount`. | done, owner kept 6 Nov: keep on web; iOS matches (iOS #198) |

| 4 Nov | **Booking screens follow `canWriteBooking` (1.10.0 rule kept)** (owner: "yes"). Managers book their own Office / Working from home / Site survey from any screen (My Schedule, project and small works scheduling, Daily Overview, Warnings → Book labour), and book other people only onto jobs they manage. Admins book anyone anywhere. Operatives: jobs only, never book themselves. Every screen offers exactly what the rule allows, so a save is never refused after the fact (fixes Book labour offering Office etc. for a manager's reports). | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) — Book labour and the Daily Overview booking sheet |
## Warnings

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Every active user (operative, manager, admin, Super Admin) who is not booked shows as unbooked labour. The organisation chooses whom to exclude (Excluded users). Inactive users and pending invites never show. Rulebook §5 wording ("an operative not booked") to be updated to say this. | decided; rulebook wording open |
| 4 Nov | Book labour shows the same unbooked people as that viewer's Warnings: admins see everyone; a manager sees only the people they line-manage (and themselves). | done web (#262); iOS open |
| 4 Nov | Excluded users do not appear in Book labour. Book them through Scheduling. | done web (#262); iOS open |
| 4 Nov | Admins and the Super Admin see every warning. A manager sees warnings about themselves, their reports, and the jobs they manage (materials etc.). | done web (1.31.0); iOS open |

## People, levels and access (Manage Users)

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Rules 1.31.1 (owner OK): operatives managers cannot add an email or extra account ids to an operative (ghost upgrade will use the invite route); admins cannot switch off their own self-manage toggles. | open (#264) |
| 4 Nov | **Ghost operatives** (owner design, "ghost: all recommended"): an operative with no app login, created by admins and managers with the Operatives toggle (admins notified on add and delete). Required: first name, last name, trade, and a day **or** hourly rate (self-employed, cost shown on the weekly report). Phone optional; no email, so no invite. A line manager is required, so their manager sees the unbooked warning. Admins or their line manager book leave for them (approved straight away). Bookable everywhere (Book labour, scheduling, Quick Add); appears in Warnings, Daily Overview and the weekly report. They never get a login, notifications, timesheets, overtime requests, price work or expenses, or My Schedule. Can be upgraded to a normal user by adding an email and inviting them, keeping all history. Existing no-login operatives rows become ghosts automatically, listed for the owner to check first. The new-operative screen on both apps explains what a ghost is. Cross-checked against the rulebook, firestore.rules, web, iOS, the screen map and an independent review before merge. | done web + rulebook (1.34.0, w134-ghosts); iOS open (hand-off v1.34.0) · trade and phone **superseded** by the 6 Nov rows below |
| 6 Nov | **Ghost operatives, owner answers round 1:** creation by admins and Operatives-toggle managers; a **Ghost account** toggle at the very top of Add new operative / Add user (operative) with a small expandable explanation; with it on every field a ghost does not need disappears. A ghost has **no email and no phone** — "just name and day rate". Q-G2 yes (convert existing no-login rows, check list with line managers to fill). Q-G4 wording yes, without the phone mention. | done web + rulebook (1.34.0); iOS open (hand-off v1.34.0) |
| 6 Nov | **Ghost operatives, round 2:** (A) option 1 — admin-only **Give app access** on the ghost's profile (the invite placeholder flow; history follows via `formerUserIds`); converted rows keep their email aside as `inviteEmailHint` for that button. (B) Required: first + last name, a day **or** hourly rate, a line manager; trade optional; email, phone, permissions, timesheets and employment type hidden (always self-employed). Q-G3: an invited ghost that has not accepted stays bookable and unbooked. | done web + rulebook (1.34.0); iOS open (hand-off v1.34.0) |
| 3 Nov | Every user has a level. Flagless users are legacy data: they go on the Managers list (1A), their clashes stay High (2A), and admins are shown them to fix. | done (1.23) |
| 4 Nov | Add User never offers the invitee as their own line manager. | done (1.27) |
| 4 Nov | Everyone needs a line manager, except an admin with both self-manage toggles on (Annual Leave Management and Timesheet self-sign); a PAYE admin needs the leave toggle only. The Super Admin counts as both on. | done (1.28) |
| 4 Nov | The Timesheet self-sign toggle is for admins only and never carries into a manager profile after demotion. Admins with Manage Users change the toggles; nobody changes their own. No notification. | done (1.28) |
| 4 Nov | A demoted admin keeps Annual Leave Management; the person changing the user type is responsible for it. | done (1.31.0) |
| 4 Nov | The Super Admin card shows both toggles on, greyed out, with a note. | done web (1.31.0); iOS open |
| 4 Nov | No rights carry over on a level change (for example manager → operative loses operatives management and line-manager rights). | done web (1.31.0); iOS open |
| 4 Nov | Demoting, deactivating or deleting a line manager is blocked, with a warning listing their reports, until each report has another line manager. | done web (1.31.0); iOS open |
| 4 Nov | Operatives managers (manager + Operatives toggle) add, edit and delete operatives only, with or without a login. Admins are notified on operative added and deleted. | done web (1.31.0; edits of the users document reliable from 1.31.1 — before, some were refused by the rules' expression limit); iOS open |
| 4 Nov | Operatives managers delete only future labour bookings of operatives without a login; past and today's they may only cancel. | done web (1.31.0); iOS open · "may only cancel" **superseded** by 6 Nov Q-E1 (1.33.0: no Cancel; only admins or the job's managers delete today's and past bookings) |
| 4 Nov | Managers can see and change the Wholesalers toggle. | done web (1.31.0); iOS open |
| 4 Nov | Super Admin transfer: if the outgoing Super Admin has no line manager, both self-manage toggles are switched on for them. | done web (1.31.0); iOS open |
| 4 Nov | "No line manager" is for admins only. | done web (1.31.0) |

## Projects and small works

| Date | Decision | Status |
|---|---|---|
| 4 Nov | The job manager picker shows active admins and managers, one per person (`jobManagerCandidates`), with former managers in amber. | done web (1.30.3), iOS (#185) |
| 4 Nov | Job managers are kept across admin ↔ manager. They are removed when the person becomes an operative, is deactivated or deleted, and admins are notified. The job stays, even with no manager. A manager is required only to create a job. | done web (1.31.0); iOS open |
| 4 Nov | Web: the projects and small works list spacing gets tidied. | done web (6 Nov / PR #290) |
| 4 Nov | Blank "Assigned manager" rows made by older iOS builds are removed with an owner-run script (dry run first). | script merged (#260); owner to run |
| 10 Nov | The My Projects and My Small works ⚙ picker gets an All / Active / Upcoming / Completed filter (owner said "active, completed and pending"; pending = Upcoming, the rulebook's word), default All, with counts. Tabs are the rulebook's (`worksInTab` / `worksTabCounts`); ticks are kept across filters and Save writes the whole list. | done web (branch web-myworks-filter) + iOS (iOS #210, 1.33.1) |

## Annual leave

| Date | Decision | Status |
|---|---|---|
| 4 Nov | **Never delete leave** when the Annual Leave Management toggle changes. The toggle only decides whether *future* leave saves straight away or is requested. Existing approved and pending leave stays as it is. (The iOS app deleted approved leave on switch-off and pending requests on switch-on: `HolidayStore.deleteSelfBookedApprovedHolidaysFor` / `deletePendingHolidayRequestsFor`.) Until fixed, change the toggle on web only. | open (iOS 1.31 removes the deletes; rulebook §9 sentence in the next rule release) |

## Timesheets

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Price work needs a job number (1–60 characters) on PAYE price work and on timesheet price work entries. New and edited entries only; old entries show "—". | done (1.30.1) |
| 4 Nov | Nobody reviews their own timesheet. | done (1.30.2) |
| 4 Nov | Exported history shows the viewer's own exported sheets (read-only) and inactive or deleted people's sheets (admins: all; managers: their reports). | done web (1.31.0); iOS open |
| 4 Nov | 1.32: a notice when an export skips the exporter's own sheet. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |

## PAYE overtime, price work and expenses

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Overtime follows the organisation policy and is shown as hours only, never £, with the multiplier shown. The cog edits start, finish and multiplier and writes back to the booking. | done (1.29) |
| 4 Nov | ✕ means "I didn't work those overtime hours": weekday bookings are clamped to the working day. A weekend multiplier-only day, or a weekday booking that is all overtime, is cancelled after a clear warning. A weekend set window is trimmed to the window. | done (1.29) |
| 4 Nov | Operative-level PAYE users' changes are requests, approved by their line manager or any admin. Push goes to line managers and all admins. "Send for approval" / "Generate overtime report". | done (1.29) |
| 4 Nov | PAYE payday (day of month; 29–31 means the last day of shorter months). A change applies from the next payrun; past payruns keep their dates. Current / past payruns / custom range. | done (1.29) |
| 4 Nov | 1.32: the PAYE payday is saved by the main Save, is mandatory at organisation setup, and a banner shows if it is missing. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | 1.32 (option 2): ✓ ✕ ⚙ are allowed on future days within the current payrun; future payruns stay locked. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | 1.32: own-overtime edits are requests when the person has a line manager, and direct when they have none or are the Super Admin. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 4 Nov | 1.32: one shared "all records for this person" rule for overtime loading, sending and approving. ✓ ✕ ⚙ on each line, one Approve button, clear messages ("Approved 2 of 5…", "Nothing was approved…"). | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) (`overtimePersonIds`) · **one Approve button superseded** by 6 Nov "Overtime: Send → Return" (1.33.0) |
| 4 Nov | Owner chose **A**: overtime filed under an older (operatives-row) record is approved by admins only; the line manager sees "Needs an admin". | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) · **superseded** by 6 Nov "A line manager can always approve" (1.33.0) |
| 4 Nov | Price work: approver is a required pick from admins and managers only. Expenses need at least one piece of evidence. Personal site audits are visible to their creator only. | done (1.30) |
| 4 Nov | 1.32: the price work and expenses review screen matches the overtime review (✓ ✕ per line, one Approve button), plus the same all-records-per-person check. | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |

## Files, data and privacy

| Date | Decision | Status |
|---|---|---|
| 3 Nov | Data export: a ZIP with one CSV per area plus a JSON copy; admins only. | done |
| 4 Nov | File recovery and company restore windows are both 30 days; the privacy policy says so. Admins can still hard-delete files. Keep a `removedEvidence` list. Profile photos get versioned names. | done (1.27) |
| 4 Nov | The invited rate is copied to private pay on accept. Operatives managers see catalogue operatives' rates. | done (1.27) |
| 4 Nov | Material email: the sender must be able to see the job, and the job number must match. | done |

| 5 Nov | **Who sees pay rates (owner restatement).** Day and hourly rates are seen by **admins (all users)** and by **managers with the Operatives toggle (operatives only)**. With the toggle on, a manager sees the Operatives page (live, pending, inactive), opens any operative and sees their rate, and can add operative-level users only. With it off, a manager has no Operatives page and sees live operatives only through project and small works scheduling, with no rates. **This differs from rulebook §8 / `canViewPersonPay` (1.13.0), which also lets a person's line managers see their pay** — to be changed in the next rulebook release. Open: the person's own rate on My Profile (§12 shows it read-only) and whether a line manager signing a self-employed timesheet sees its £ amounts (see Open questions). | done web (screens) and rulebook §8 (1.32.0 / PR #274); rules not narrowed (owner to sign off); iOS open |
| 5 Nov | **Private pay switch on before launch** (owner: "yes before launch"). Order: merge rules #264; raise `minimumIosBuild` to at least the iOS 1.26.0 build (changed-fields-only saves) with 1.32; then the owner switches `privatePay` on in `platformConfig/app` with steps Claude sends. Until then pay is hidden on screen only; the stored rate is on the users document that every member can read. | open (before launch) |
| 5 Nov | **Weekly report admin-only** (owner U-turn): only admins and super admins open the Weekly report; the manager `weeklyReports` toggle is removed (stored values ignored, never rewritten; a promotion gives it, a demotion takes it away). Supersedes the 5 Nov weekly-report pay questions (price work / expenses visibility and the rate-type rows no longer apply). Guardrail 3 — who loses access: every manager whose `weeklyReports` toggle is on today (operatives never had it). | done web + rulebook (1.32.0 / PR #274); iOS open (hand-off) |
| 5 Nov | **Pay visibility edge cases (answers to the 5 Nov open question).** (a) A person sees their own rate, read-only, on My Profile. (b) A line manager who is not an admin and has no Operatives toggle sees a report's rate **only on the timesheets they review** (rate, overtime calculation and invoice, so every timesheet looks the same) — nowhere else: no Operatives page, no profile rate, no rate history. A level change recalculates all of this (no rights carry over). Rulebook §8 `canViewPersonPay` to be narrowed to this in the next rulebook release. | done web (screens: people profile, Edit User rate fields, weekly report Pay Summary and its exports — 1.32.0 / PR #274); rules not narrowed (owner to sign off: the timesheet review reads the same pay documents); iOS open |

## Home, sidebar and Daily Overview (web)

| Date | Decision | Status |
|---|---|---|
| 5 Nov | **Web Home dashboard restyle** (owner: "all recommended", 13 decisions). (1) Sidebar keeps its sections (Home, Navigate, Tools, Team, App & account), restyled, and nav Customise keeps reorder / hide / add. (2) No Warnings or Tasks counts in the sidebar. (3) Team panels — the team-today ring, "Who's on today" and today's hours — are **admins only**; managers get "N people have nothing booked → Book labour", counted from the Book labour list itself so it always matches their Book labour (their team only); operatives get their own items (tasks, Up next, quick actions). (4) Admins' "Who's on today" includes subcontractors (subcontractor bookings load on Home for admins only). (5) Daily Overview's "today" set-up is one shared module used by Daily Overview and Home; Daily Overview's output stays identical (test). (6) The hero gear stays as an admin-only "Customise" button opening the existing metrics chooser. (7) Labour summary shows **today's** figures from Daily Overview (existing rulebook functions only); no "this week". (8) No 12-week chart. (9) Tasks reuse the Tasks page's "To do" list with status pills (no progress bars). (10) Ring: booked / unbooked / on leave, admins only. (11) The designer palette as scoped tokens, with dark-mode values, and the four contrast failures fixed (AA). (12) A "Waiting for you" card with only items that need no new data loading: leave requests to decide (`leaveDecisionQueue`), people missing a line manager (admins, `usersMissingLineManager`), PAYE payday not set (admins), pending invites — each linking to its page. (13) Built on 1.32 (Weekly report admin-only, `canOpenWeeklyReport`): its header button, sidebar item and quick action follow that check. | done web (PR #276, on 1.32 / #274); iOS `HomeView.swift` not changed (visual only, may follow) |
| 5 Nov | **Web Home judgement calls** (owner: "all 7 are fine, keep them"). (A) Ring "On annual leave" is the number of leave rows Daily Overview lists; a half-day-leave person who is also booked counts in both. (B) The admin's ring "Unbooked" and the banner may differ by people with no app account. (C) A line manager without the Annual leave Team tab is linked to the Tasks approvals list (same requests). (D) The card is titled "Tasks to do". (E) An admin with Warnings as a metric sees one Warnings tile. (F) Quick-actions hint: "Remove an action with ×, or add one with Add." (G) Sidebar Home stays its own row; Data health is a sidebar foot link with the same gate. | done web (PR #276) |
| 5 Nov | A manager's Daily Overview shows only their own team (people they line-manage, and themselves): booked people, leave, unbooked and hours, matching Warnings and Book labour. Admins and the Super Admin see every user and every subcontractor booking. Owner yes. Rulebook change in a later release (1.33). | open (1.33; not in the Home restyle PR #276) → confirmed 6 Nov (Q-D1); done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |

## iOS

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Booking and scheduling design upgrade (owner spec, "UI: all recommended"): reuse the Home design kit; "on site" = finish − start; keep the shared lunch-warning text; rate chips ×1 / Org (real rate) / ×2 / ×3 plus More rates; the tab bar stays hidden on Scheduling; "Next 3/5 working days"; projects green, small works amber. | open (iOS #186) |
| 4 Nov | The design upgrade PR also fixes the PAYE break bug from Scheduling, shows Delete on labour bookings to admins only, and fixes the hours display. | open (iOS #186) |
| 4 Nov | 1.32: the overtime rate on managers' own site bookings is shown consistently on Scheduling, Daily Overview and My Schedule. | web already consistent (bookingHoursLabel gets the stored rate; 1.32.0 / PR #274 checked); iOS open |

| 4 Nov | **Materials catalogue** (add, edit, delete catalogue items and prices) is **admins only** on both apps, through one rulebook rule. iOS `canManageMaterialCatalogue` currently has its own role check (found in the #188 sweep). Sending material orders is unchanged. | open (next rulebook release) |
| 4 Nov | Very old timesheets with sign-off dates but no signer name or signature image read **Sign Off Pending** (rulebook `isTimesheetFullySigned`), on both apps. No rulebook exception: new organisations only use the new rules. | done (iOS #188, web already) |
| 5 Nov | **My Profile UI upgrade, iOS and web** (iOS: opened from the Home screen). General UI upgrade with personal metrics, the same on both apps and following the same rules. Metrics come from rulebook functions only (no new calculators); proposed set awaiting owner confirmation. | figures confirmed 7 Nov (see My Profile below); done web + rulebook (1.35.0, w135-my-profile); iOS (ios-1.35) |

## My Profile (1.35)

| Date | Decision | Status |
|---|---|---|
| 7 Nov | **My Profile figures** (owner approved): five figures from existing rules — annual leave left this year, hours booked this week, open tasks, qualifications expiring soon, your line manager. The rest of My Profile (§12) and Delete my account are unchanged. Each figure links to its screen. | done web + rulebook (1.35.0, `myProfileSummary`); iOS (ios-1.35) |
| 7 Nov | **Q1 = a**: hours are worked hours — clock time less the unpaid break, no overtime multiplier, overlapping bookings once. | done (1.35.0, `bookedWorkedHours` over `payrollHoursResult.workedHours`) |
| 7 Nov | **Q2 = yes**: the week is Monday–Sunday in the organisation's time zone and includes days later in the week already booked. | done (1.35.0, `organizationWeekDayKeys`) |
| 7 Nov | **Q3 = yes**: open tasks include tasks with no due date; the number overdue is shown underneath. | done (1.35.0) |
| 7 Nov | **Q4 = after**: leave left is `annualLeaveBalance.remaining`, which already takes pending requests off. | done (1.35.0) |
| 7 Nov | **Q5 = all**: every line manager is listed by name, not "First +N more". | done (1.35.0) |

## Known rulebook bugs (fix in the next rulebook release)

| Date | Bug | Status |
|---|---|---|
| 4 Nov | **SECURITY (live 1.30.2):** a manager with the Operatives toggle can make an operative an admin through `permissions.adminAccess` (or `manager`, `operatives`, `isSuperAdmin`, `annualLeaveSelfBook`, `timesheetSelfSign`), and can create a user with `permissions.adminAccess: true`. Owner: fix before launch; no interim toggle change. | fixing (#264 1.31.1: second review F1, F2, F4 and third review B1, B2, S1, S3, S4 fixed with emulator tests; owner deploy pending) |
| 4 Nov | **F5 (unverified email edits a pending invite)** is closed in the **next rules release**, not in #264: first the apps stop touching pending placeholders in the same-email profile sync (or verify emails), then the rules require `email_verified` on the email self path. Accepted pre-launch risk until then. | superseded (by the row below: F5 fixed now in #264) |
| 4 Nov | **F5 fixed now in #264** (reverses the earlier "next rules release" row). No `email_verified` requirement, so web `saveUser` same-email sync keeps working. Accepting an invitation needs proof of the emailed invitation: the new `users/{authUid}` carries the secret `invitationId` (for that email and organisation, not used) and the invitation is marked used in the same batch (rules `inviteBeingAccepted` via `getAfter`); the email-claim take-over, users update and delete by email of a pending placeholder (`passwordSet` not true), its tax ids and the invited pay copy need an account created that way in the placeholder's organisation (`callerAcceptedPlaceholder`); the invitee's own mark-used needs the account or membership written with that invitation id. Web `completeInviteSetup` writes the account and marks the invitation used in one batch; iOS has no accept flow of its own (it sends invitees to the web link). The reviewer probe c3 is refused at every step. | done in #264 (owner deploy pending) |
| 4 Nov | A manager or operative can still switch off their own Annual Leave Management (rulebook: nobody changes their own toggles). Owner: close in the next rule release, after iOS sends changed-fields-only profile saves. | open |
| 4 Nov | 93 rules tests still get their refusal from the 1,000-expression limit rather than logic (74 after #264's second round: users create, overtime booking updates and organisation moves are logical now; 49 of 203 after the third round and F5: invite accept, email claims, invitation mark-used and organisation updates by strangers are logical now); apply the 1.31.1 ternary restructure to the rest of firestore.rules (`RULES_STRICT_BUDGET=1 npm run test:rules` lists them). | open (next rule release) |
| 4 Nov | Web `setUserActive` merge-sets the membership `{accountActive}`, creating a bare membership; and `userActiveWrites` writes `users/{uid}.isActive` even when that document's `organizationId` is another company. | done (1.33.0: `userActiveWrites` skips another company's users document and never creates a membership; web `setUserActive` updates it, never merge-sets — tests `1.33.0 userActiveWrites`; verified 7 Nov in 1.36.0) |
| 4 Nov | `preferFinishedAccount` (warningRows.ts:410) lets an inactive account through, so inactive users can show as unbooked in Warnings and Book labour. The rulebook says inactive users are skipped. | done (1.33.0: an active account only; test `1.33.0 unbooked labour: an inactive account is never picked`; verified 7 Nov in 1.36.0) |
| 4 Nov | Web clash check when booking (`lib/scheduling/bookingClashUtils.ts:151`) compares `operativeId` with letter case, so an existing iOS upper-case booking is missed. | done (#266 sweep / 1.33.0 h5: `normalizeDocumentId` both ways, tests in `bookingClashUtils.test.ts`; verified 7 Nov in 1.36.0) |
| 4 Nov | Web: a rate change's `operativeId`, the weekly-report/timesheet-export rate fallback and the "is this my own booking" check each pick one operatives row (`EditUserProfile.tsx`, `weeklyReportPayroll.ts`, `timesheetExport.ts`, `scheduleNavigation.ts`; sweep FU-5). | done web (1.36.0, w136-fixes): rate history read under every id (`personRateHistoryIds`); own-booking check `bookingIdsForAccount`. Left: the single `operativeId` written on a new rate-history row and the live-rate fallback row still use the linked row (display / one field); `weeklyReportData.ts`, `timesheetWeekUtils.ts`, `DailyOverviewBookingSheet.tsx`, My Schedule page (other FU-5 entries) are follow-ups |
| 4 Nov | Web week grids use the browser's week in 11 files; needs a shared "organisation week" rule (sweep FU-4; iOS Scheduling has the same problem). | done web (1.36.0, w136-fixes: `organizationWeekDayKeys` via `lib/orgTime/organizationWeek.ts`; organisation's today and week); follow-up: grid cells are still browser-local midnights read as organisation instants (wrong day for a browser east of the organisation zone), and iOS Scheduling `Calendar.current` (hand-off v1.36.0) |
| 4 Nov | Overtime: until 1.32's partial approval, a request containing one line under an older record cannot be approved by the line manager at all (whole approval refused, "Needs an admin"); admins can. | fixed (1.32.0 / PR #274: partial approval) · superseded by 6 Nov "A line manager can always approve" (1.33.0) |
| 10 Nov | **Notifications stuck (live rules):** creating an inbox row with a server-time `createdAt` (both apps, rulebook 1.16.0) crashed the rules engine on the combined notifications `allow create, update` (merged in 1.32.2), and so did a notification update written as a merge-set or full set with a server timestamp; the write never answered, Rules metrics showed 21 errors, and an iPhone kept every later write at "Pending sync" behind it. An invitation create with a server timestamp crashed the same way (no app writes one). | fixed (1.33.1 rules: notifications allow split, invitation privilege check hoisted; permanent suite `tests/methodTernary.rules.test.ts`); owner publish pending; stuck "Pending sync" phones expected to clear after publish (untested — owner checks one affected phone) |

## 1.32.0 judgement calls (owner kept all, 6 Nov)

| Date | Choice made in PR #274 | Status |
|---|---|---|
| 5 Nov | Partial approval: Approve is enabled once **any** line has ✓ ✕ ⚙; undecided lines stay waiting on the request (not refused). A booking changed since the request now stays waiting on its own line instead of refusing the whole approval. Note (review r274): a changed (stale) or refused line keeps the request pending until the person sends that range again (which replaces it) or withdraws it; the line reads "Booking changed since request". | accepted by the owner as built (5 Nov) · **superseded** by 6 Nov "Overtime: Send → Return" (1.33.0: Return needs every line decided) |
| 5 Nov | Price work and expenses review stores a separate `payeClaimReviews/{kind}_{itemId}` document (the items stay written only by the person) and does **not** gate the person's report. A changed item needs review again. | done, owner kept 6 Nov |
| 5 Nov | "Own overtime is a request with a line manager" applies to admins with a line manager too; a manager with no line manager edits directly only where `canWriteBooking` allows (else a request). The security rules still accept a direct edit from an admin with a line manager (the app no longer offers it). | done, owner kept 6 Nov |
| 5 Nov | The PAYE payday banner shows on Settings (admins), Payment runs and the Overtime hub. Settings → Payment runs does not refuse a Save without a payday; only setup requires it. | done, owner kept 6 Nov |
| 5 Nov | The weekly report marks a row "changed from organisation rate" only when the stored `otMultiplierOverride` differs from the organisation's rate; an older booking that stored the same value as the organisation's is not marked. | done, owner kept 6 Nov |
| 5 Nov | Removed web `lib/firebase/mergePlaceholderUser.ts` and its sign-in call: since #264 (F5) the rules refuse every write it made, so an invitee's account is created only by the invitation accept. | done, owner kept 6 Nov |

## 6 Nov decisions (for 1.33)

| Date | Decision | Status |
|---|---|---|
| 6 Nov | **Pay records fixed before launch** (answer to HANDOVER §6 Q1). In 1.33, narrow the Firestore pay rules to match `canViewPersonPay`: admins see everyone; Operatives-toggle managers see operatives only; the person sees their own, read-only; a line manager who is not an admin and has no Operatives toggle sees pay only through the timesheets they review. Order: rules change → raise `minimumIosBuild` → the owner switches `privatePay` on in `platformConfig/app` (Claude sends beginner steps). Keep the rules compile cost under the CI budget (395,000). | open (1.33) → 1.33.0: Q-C1 = (a) (no rules narrowing; tests only); `privatePay` switch-on and strip remain owner steps after `minimumIosBuild` |
| 6 Nov | **Payrun Snapshot: build it** (replaces "proposal only" in the 1.33 prompt). Weekly report (admins only, `canOpenWeeklyReport`) → **Payrun Snapshot** button → period picker: current PAYE period (`payePayrunPeriod`), current payment run period (self-employed timesheets), or a custom range. Rows: every active person; inactive or deleted people only if they had a timesheet, overtime, expense or price work item in the period. Columns: Name; User level; Employment type; Timesheet (self-employed: Not started / Submitted / Signed; PAYE: red "PAYE"); Overtime (PAYE with an active line manager: Not started / Submitted / Returned; with none: Report generated Yes / No; self-employed: red "Self Employed"); Expenses and Price work (PAYE: "Report generated: Yes", else the item count, e.g. "2 items, no report" / "No items"; self-employed: red "Self Employed"). Tapping a cell opens that person's page for that kind. Rule: `payrunSnapshotRows({ roster, organization, period, sheets, overtimeRequests, overtimeReports, payeClaimReports, priceWork, expenses, timeZone })` in `lib/canonical`, with tests; both apps only render it. Judgement calls for the PR: several timesheets in one period (suggested: the least-advanced state with a count, "Submitted · 2 of 4 signed"); before the 1.33 overtime flow ships, a pending request counts as Submitted and fully approved as Returned; no export unless trivial. | open (1.33 if it fits, else straight after) → done web + rulebook (1.33.0); iOS open (hand-off v1.33.0) |
| 6 Nov | **Overtime: Send → Return** (prompt §1). The person marks every line ✓, ✕ or ⚙ + ✓; then **Send for approval** is green. The line manager marks every line; then **Return overtime** is green. Return is the only action that writes the bookings and reviews, in one transaction; no "Approved" text at the person's stage; Return notifies the person "Your line manager {name} has returned your overtime request". People without a line manager (incl. the Super Admin) keep direct writes. Replaces the 4 Nov one Approve button and the 5 Nov partial approval. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **A line manager can always approve** their report's overtime lines and price work / expense items, under every id the person goes by (`overtimePersonIds`); no "Needs an admin". Replaces 4 Nov decision A. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0); price work / expenses filed under a former id also need the one-off backfill (Deploy notes 1.33.0) |
| 6 Nov | **Report PDFs look like the invoice / timesheet report** (prompt §2–§3): header (logo, company, person, payrun), item table with totals, one page per piece of evidence headed by its item; overtime: day, job, start–finish, overtime hours × rate = total, generated by / at. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Each button's readiness is a rulebook rule** (overtime and timesheets), with its label per level (6b.1). A later booking change by a manager or admin **reopens that line** on the person's page for that payrun, even after Return or a report, and the cycle starts again for it; the person is notified. Overtime is paid only through a generated report. Q-A1 = **skip-and-name** (a changed line goes back; the rest is applied). | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) (overtime; timesheet buttons not changed in 1.33) |
| 6 Nov | **Q-A2: the line manager's ✕ means "I don't agree with this line at all"** (not "not paid"): on Return the booking is left as it was; the person sees it red ✕ and can challenge, ⚙ and resend. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Labels** (6b.3, 6c.1): ✓ "Confirmed", ✕ "Not worked", ⚙ "Changed"; the person's button stays **"Send for approval"**; the line manager's **"Return overtime"**; **"Generate overtime report"**. After a Return, Send is grey until the person changes a line; only changed lines are sent. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Report out of date** (6c.2–6c.4): a report generated before a line reopens stays as a record marked "Out of date" and Generate turns green for a replacement; a reopened line notifies the person, plus their line manager if it had been returned; a line still red ✕ at Generate is in the report at 0h, "Declined by {name}". | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Q-E1**: managers add, change and delete bookings on the jobs they manage (`canWriteBooking` / `canDeleteBooking`); the Operatives toggle adds no booking powers. Replaces 4 Nov "past and today's they may only cancel". | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Q-F3**: the red X delete warning ends "This cannot be undone. A manager can book it again." | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Q-C1 = (a)**: line managers keep reading their reports' pay documents for timesheet review (screens limit it to the review); `privatePay` and the strip are the real fix. | done (1.33.0: tests only, no rules change) |
| 6 Nov | **Q-B2** (line-manager booking reads under `enforcedReads`): answered by 6d.2 below — every manager reads every booking. | done (1.33.0 rules) |
| 6 Nov | **Line manager set once, then locked** (6d.1): an Operatives-toggle manager sets an operative's line manager only when adding them or on their own unaccepted invitation; afterwards only admins change any user's line manager; the rules enforce it. Delete and re-add is the accepted way round. Add operative already requires a line manager. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Every manager sees every project and small works** (6d.2) and reads every booking; the Projects / Small works toggles govern creating jobs and changing manager lists only. Daily Overview and Warnings stay team-scoped. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Per-job hide lists removed** (6d.3, `hiddenManagerUserIds`, `hiddenOperativeUserIds`). **Partly reversed the same day — see the next row.** | superseded (operatives part) |
| 6 Nov | **Keep the per-job hide list for operatives only** (later 6 Nov, reverses 6d.3 for operatives): `hiddenOperativeUserIds` stays (an operative named on it does not see the job, even when booked on it); only the managers' list goes. The job's **View** tile and page come back showing only the operatives list ("Hide this job from these operatives"). | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **My Projects / My Small works** filter (6d.4), the default instead of Active; ⚙ opens the full list to pick from; picks persist per person per company, synced across web and iPhone; pre-filled with the jobs they manage on first open; empty list shows "No projects in your list yet" with a button to the ⚙. | done web + rulebook (1.33.0, w133-integration); iOS open (hand-off v1.33.0) |
| 6 Nov | **Materials requests: any manager may send a materials request for any job** (the side effect of every manager seeing every job; `materialRequestJobCheck` via `canSeeJob`). | done web + email function check (1.33.0); no rules change |

## 1.33.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 6 Nov | Overtime: tapping ✓ or ✕ again clears it; lines waiting for the line manager are locked for the person; Generate stays grey while an up-to-date report of exactly that range exists; the reopen notice may over-notify when the editor cannot read the person's overtime records. | done, owner to confirm |
| 6 Nov | Clash review "Cancel booking" only ever abandoned the booking being made: web's panel had no callers and was deleted; iOS relabels it "Don't book" for everyone. | done web; iOS open |
| 6 Nov | Payrun Snapshot: invite-only people are hidden unless they have records; an unsigned sheet is "Not started"; a report overlapping the period counts "Yes" (while its live lines still match it); red (blocked) cells have no link; the report generator defaults to the person. | done, owner to confirm |
| 6 Nov | Price work / expenses filed under a former id: items carry `personUserId` (the creator's current id) and a one-off backfill stamps older ones; until the backfill runs, the line manager cannot read an older item filed under a former id (admins can). | done (1.33.0); backfill is an owner step |
| 6 Nov | Line-manager lock in the rules: an Operatives manager changes the line manager only while the person has not finished sign-up (`passwordSet` not true); the rules do not check who invited that placeholder (the app does). | done (1.33.0 rules) |

## 1.34.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 7 Nov | J1: an invited ghost (Give app access sent, not accepted) shows "No app login · Invited" and keeps `ghost: true` (so it stays bookable, Q-G3); accepting removes the flag. | done web + rulebook, owner to confirm |
| 7 Nov | J2: ghosts are not offered as toolbox-talk or deadline assignees and never get a notice; web task pickers list `operatives` catalogue rows, so a converted ghost's row is still offered there (follow-up). | done web, owner to confirm |
| 7 Nov | J3: a ghost has no timesheet; once it accepts an invitation, its timesheets start from the payrun it accepts in (the self-employed rule from then on). | done (rulebook), owner to confirm |
| 7 Nov | The annual-leave allowance stays on the ghost form (it is needed to book their leave). | done web, owner to confirm |
| 7 Nov | A ghost is written with `email: ''` and no `isSuperAdmin` key (the emulator crashes on an Operatives manager's create otherwise); no rate-history row is written at create (as Add user), the first change seeds it. | done, owner to confirm |
| 7 Nov | Conversion script: a duplicate no-login row on the same email is linked to the ghost and made inactive (its id goes on `formerUserIds`); the kept row's email is cleared and kept aside as `inviteEmailHint`. | done (script), owner to confirm before `--apply` |
| 6 Nov | R1 (review): an Operatives manager can never change a ghost's line manager, not even while it has no login — only admins do (rules: the `passwordSet` lock also applies to `ghost: true`). Deleting and re-adding is the way round for them, as for any operative after sign-up. | done (rules), confirmed 7 Nov (Q2) |
| 6 Nov | R2 (review): a ghost's line manager gets no overtime booking writes on it (a ghost sends no overtime, so there is nothing to return); its bookings are edited by admins and the job's managers as usual (`canWriteBooking`). | done (rules), owner to confirm |
| 6 Nov | Release order (review F2): the web Add user **Ghost account** toggle is live as soon as web 1.34.0 deploys, before iOS 1.34 ships. Until `minimumIosBuild` is raised to the iOS 1.34 build, an older iPhone reads a ghost as a pending invite (not bookable, not in Warnings) — nothing is written wrongly. Owner to accept, or ask for the toggle to be hidden until `minimumIosBuild` is raised. | answered 7 Nov (1b): hidden — see 7 Nov decisions |
| 6 Nov | Review fix B1: nobody changes `ghost` or `inviteEmailHint` on their own users document (rules), and deleting a person always removes their tax ids, membership and (when listed) `members` entry, whatever `ghost` says (`userDeleteWrites`). `isGhostUser` reads only the boolean `true` (F1), the same test as the rules. | done |

## 7 Nov decisions (for 1.34)

| Date | Decision | Status |
|---|---|---|
| 7 Nov | **(1b) Ghost account toggle hidden until the iPhone 1.34 update is out.** Both apps hide the Ghost account toggle on Add user / Add new operative until the platform owner sets `platformConfig/app.ghostAccounts` true (or lists the company in `ghostAccountsOrganizationIds`), after `minimumIosBuild` is raised to the iOS 1.34 build. Rule: `ghostAccountsEnabled` / `ghostToggleVisible` (the permission `canCreateGhost` and the switch); missing = off. Existing and converted ghosts display, book and work normally whatever the switch says. UI gate only, no rules change. Replaces the 6 Nov "Release order (review F2)" choice. | done web + rulebook (1.34.0, w134-ghosts); iOS (ios-1.34) |
| 7 Nov | **Q2 confirmed:** only admins change a ghost's line manager (R1). | done (rules, 1.34.0) |
| 7 Nov | **Q4 confirmed:** the iPhone ghost details as built; creating any user, a ghost included, needs a signal (already enforced: rulebook §2 `users.invites` online only; iOS AddUserView disables Create offline). | done |
| 7 Nov | **Q5: My Profile figures approved** — annual leave left this year, hours booked this week, open tasks, qualifications expiring soon, line manager. Each from an existing rulebook function only. | done web + rulebook (1.35.0, w135-my-profile, `myProfileSummary`); iOS (ios-1.35) — see My Profile (1.35) |
| 7 Nov | **Q3 decided: option (a), keep R2 as built.** To change a ghost's booking hours or overtime you must manage the job (`canWriteBooking`) or be an admin; the line manager gets no extra booking power. Ghost bookings feed the weekly report as normal. | done (1.34.0, web #291 / iOS #203) |

## 10 Nov decisions (for 1.36)

| Date | Decision | Status |
|---|---|---|
| 10 Nov | **Rate history across duplicate Operatives records: option (a), follow the rulebook.** A person is identified by their email (their login), never their name. (a) every record on the person's email counts (rulebook §8: `payRateOnDay` matches history under `personIdSet` — the person's own id, former ids and same-email ids); the read-only report `scripts/report-duplicate-operative-rate-history.mjs` is available but not required. Answers the 7 Nov open question. | done web (1.36.0, w136-fixes); rule since 1.10.0 |
| 10 Nov | **Duplicate-name warning when adding a user.** Add User / Add new operative (the Ghost account path included): when the first and last name match an existing person of the organisation, show "A user with this name already exists. Are you sure you want to add this user?" with **Add anyway** and **Cancel** before saving. Email stays the identity; a warning only, never a block. Rule: `usersWithSameName` + `DUPLICATE_NAME_*` (rulebook §11). | done web + rulebook (1.36.0, w136-fixes); iOS (ios-1.36) |

## 10 Nov decisions (for 1.37)

| Date | Decision | Status |
|---|---|---|
| 10 Nov | **Who is on a job's schedule.** The project and small works week grid (web and iOS) lists only people booked on that job somewhere in the visible days. Leave never adds a person to a job's list. | done web + rulebook (1.37.0, w137-leave-grid); iOS (ios-1.37) — unchanged behaviour, now written in §21 |
| 10 Nov | **Annual leave on the job's schedule, in brown** (iOS "Ann. leave"; web matches). For people on the list: full day = brown cell "AL"; half day "AL AM" / "AL PM" (the iOS half-day split style); a booking on a leave day keeps its booking cell with a thin brown band across the top marked "AL"; overtime keeps its own marking with the band on top. Rule: `jobScheduleLeaveMarks` (§21). | done web + rulebook (1.37.0); iOS (ios-1.37) |
| 10 Nov | **Pending leave shows too**, paler brown, "AL?". Rejected never. | done web + rulebook (1.37.0); iOS (ios-1.37) |
| 10 Nov | **One booking colour scheme.** Web booking cells adopt the iOS scheme and legend: Standard (blue), Std + OT (blue with orange hatched OT part), OT only (orange hatched), Ann. leave (brown), Half day. The web legend "Operative / Manager / Admin / Sub contractor" is removed; the coloured role pill under each name stays (Op green, Admin/Manager blue, Sub purple). Rule: `JOB_SCHEDULE_LEGEND`. | done web + rulebook (1.37.0); iOS legend unchanged |
| 10 Nov | **Build now, before launch, working on both apps.** | done (1.37.0 web + iOS PRs), owner to test |

## 11 Nov decisions (for 1.39)

| Date | Decision | Status |
|---|---|---|
| 11 Nov | **Booking hours explained on every booking picker** (owner request from iPhone screenshots: "Saturday 07:30–10:30 = 3.69h" and "Missing to standard day 4.31h" did not say why). Each day shows its rule ("Saturday full day: 07:30–14:00 counts as 8h, hours outside it at 2×"; "Sunday every hour at 2×"; weekdays the working day, unpaid break and overtime rate) and the steps ("Booked 07:30–10:30 = 3h of the 6.5h window → 8h × 3 ÷ 6.5 = 3.69h"; "07:30–14:00 = 8h (full day) + 14:00–16:00 = 2h × 2 = 4h → 12h"; an unpaid break as its own "− 0.5h unpaid break" line). "Missing to standard day" on iOS names what it compares against ("Short of a full Saturday (8h)"). Wording only, figures unchanged, same text on both apps. Rule: `bookingHoursExplanation`, `bookingShortfall`, `weekendBookingBreakdown` `explanation` (§4.3). | done web + rulebook (1.39.0, w139-booking-breakdown); iOS (ios-1.39) |
| 11 Nov | **Tap anywhere on a person's tile to select them** (iOS scheduling Select people; every similar people picker on both apps). Keep accessibility (button, selected state). UI only (guardrail 7). | done iOS (ios-1.39); web already whole-row buttons, `aria-pressed` added (1.39.0) |
| 11 Nov | **My Schedule booking clash marker** (My Schedule only). A small triangle on each of the viewer's own bookings that overlaps another of theirs — red not approved, grey approved, a third overlapping booking re-opens it (red) — worked out as Warnings does. Tap: a popup in the app's style: "Booking clash", the other booking(s) (day, job, times), "Open Warnings" only when the viewer can open Warnings and the clash is in their scope, else "Ask your manager to review this clash." and Close; approved: "Clash approved — This clash was already approved. The booking will have to be adjusted manually." Close only. Rule: `myScheduleClashMarkers` (§10). | done web + rulebook (1.39.0, w139-booking-breakdown); iOS (ios-1.39) |
| 11 Nov | **"Replace existing booking"** beside the keep option when a new booking overlaps an existing booking of that person that day (iOS Scheduling wizard + Quick Add; web Schedule wizard / Quick Add / Book labour), only for people who may delete that booking (`canDeleteBooking`); replace = create the new booking and delete the old one with its tombstone in one batch. | open — not built in 1.39.0 (reported: needs a new atomic create-and-delete path through the iPhone offline queue; see PR #302) |
| 11 Nov | **Hours labels** (figures unchanged; break words from the working hours in effect that day): Daily Overview tile "12h OT × 1.5 = 18h"; job line "60.5h booked (incl. 12h OT × 1.5)"; Daily Overview booking row shows "Custom 07:00–22:00" and the hours pill only; My Schedule total with "incl. 6h OT × 1.5 = 9h" under it; Edit booking tiles "9 Standard (−0.5 break)", "6 OT", no break tile; "30 min unpaid break 11:30–12:00"; "30 mins deducted 11:30–12:00"; "17.5 hours" and "Save · 17.5 hours"; a paid break says "(not deducted)". Rule: `bookingHoursText.ts` (§4.3). | done web + rulebook (1.39.0); iOS (ios-1.39) |
| 11 Nov | **Daily Overview booking sheet move between collections in one batch** (new booking + old booking's delete + tombstone). | done web (1.39.0); iOS has no such move (n/a) |
| 11 Nov | **The break in the hours explanation always follows the organisation's working hours** (paid / unpaid, window, length, a weekend day's own break). `bookingHoursExplanation` (§4.3). | done (1.39.0) |

## 1.39.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 11 Nov | The shortfall is compared with **that day's own full day**: a set-window weekend day's "counts as" hours, a weekday's paid day. Before, iOS compared every day with the Monday–Friday paid day; for the owner's organisation both are 8h, so no figure moves there, but a company whose Saturday counts as, say, 6h now sees "Short of a full Saturday (6h)". A day paid every hour at a multiplier has no full day, so the line is not shown there. | done, owner to confirm |
| 11 Nov | On weekend rows the explanation replaces the small "Set hours / Outside hours / Total paid hours" list under each row (same figures, now with the reason). Saturday and Sunday share one row only when both the figure and the explanation read the same. | done, owner to confirm |
| 11 Nov | The explanation uses the organisation's overtime rate, as the existing breakdowns do; a booking's own custom rate (`otMultiplierOverride`) is not yet shown in the picker breakdown (unchanged behaviour). | done, follow-up if wanted |
| 11 Nov | Weekday explanations name the day ("Monday full day: 07:30–16:00 − 30 min unpaid break (12:00–12:30) = 8h, hours outside it at 1.5×"). | done, owner to confirm |
| 11 Nov | The break is named on the part of the booking it falls in ("07:30–16:00 = 8h (day, less 30 min unpaid break)"), instead of a separate "− 0.5h unpaid break" line; hours at a multiplier keep the separate line (the break comes off after the multiplier, 1.20.3). The window is in the day's rule line. | done, owner to confirm |
| 11 Nov | Daily Overview job line with several overtime rates on one job reads "… (incl. 12h OT)" without a rate, rather than picking one. | done, owner to confirm |
| 11 Nov | The clash popup's "Open Warnings" is offered to admins and managers for their own clashes (their own bookings are always in their own warning scope); operatives never get it. | done, owner to confirm |
| 11 Nov | Web has no Edit booking tiles; the hours editor shows "17.5 hours" and the break toggle names the day's break. The Home labour summary keeps its "Overtime 1.5×" wording (not in the owner's list). | done, owner to confirm |
| 11 Nov | Review fixes: "missing hours" now names the window it measures ("Short of a full Monday (07:30–16:00): 5.5h") and counts only booked clock time inside it, lunch window excluded — overtime before or after the day never fills it. | done, owner to confirm |
| 11 Nov | Review fixes: a staff viewer's clash that Warnings does not list now reads "This clash isn't in the current Warnings period." (or "This clash was dismissed in Warnings.") with Close only. | done, owner to confirm |

## 11 Nov decisions (for 1.38)

| Date | Decision | Status |
|---|---|---|
| 11 Nov | **Launch safeguards for loading** (owner: "Yes do all that"), after an iPhone listed 6 projects for a session while the database and web had 7. (A) **In-app data check, both apps, read-only:** on open, on return to the foreground, every 10 minutes while open and from Settings → Data health **Check now** (admins), each list (projects, small works, users, operatives, managers, clients, bookings and manager site bookings in the loaded window, annual leave, tasks) compares the server `count()` of the listener's own query with what the app holds; a list that differs is re-read and its listener re-attached, then checked again; the last 20 results stay on the device; admins see "Data check: all lists match (checked 14:05)" or the lists that differ. No writes, no rules change, no new collection; throttled to once per 10 minutes, never offline. Rule: `dataParityCheck`, `dataParityCheckDue`, `DATA_PARITY_CHECKS` (§27). (B) **Two-app comparison in CI:** a shared fixture of raw documents and listener events (`data-parity-fixture.json`, mirrored to iOS) run through each app's own store and merge code on every PR, so a release that drops a record cannot merge. The specific iOS refresh bug is fixed separately (branch `ios-1.37.1-list-refresh`). | done web + rulebook (1.38.0, w138-data-parity); iOS (ios-1.38) · panel visibility **superseded** by the next row |
| 11 Nov | **Data check invisible in the launch app** (owner change: it must not look half-done). No panel, row or text in Settings or Data health for normal users or admins. The silent read-only check and self-heal (reload on mismatch) keep running; results stay in the device log only. The admin panel sits behind a new `platformConfig/app` switch `dataCheckPanel` (missing = off, the `ghostAccounts` pattern; `dataCheckPanelEnabled`, `dataCheckPanelVisible`). The CI two-app comparison is unaffected. | done web + rulebook (1.38.0); iOS (ios-1.38) |

## 1.38.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 11 Nov | The fixture found a web gap: a cache snapshot shorter than the list on screen replaced it (rows could vanish until the next server snapshot). Web now only adds and updates on a cache snapshot, like iOS; only a server snapshot removes a row. | done web, owner to confirm |
| 11 Nov | The check runs for everyone (the self-heal helps everyone); only admins can see the result, and only while `dataCheckPanel` is on. A list a viewer reads one document at a time (an operative's jobs) is not counted. The first check waits 20 seconds after the app opens so the listeners have loaded. | done, owner to confirm |
| 11 Nov | Web compares the projects and small works lists the store holds; the other lists are compared at the listener (the documents it holds before the screens' filters); users are the ids the live roster query returned. | done web, owner to confirm |
| 12 Nov | Review fixes: both apps count the listener's documents by stored id with case kept (iOS counted its filtered store lists and folded id case, so a placeholder row or nameless client looked like a lost record); a list with this device's unsaved changes, or whose listener has not heard from the server yet, is skipped that time; a list is reloaded only when a second look 5 seconds later still differs; no console / device-log output in production builds. | done web + iOS, owner to confirm |
| 12 Nov | The cache-snapshot rule (`retainLoadedRows`, kept to match iOS) means a row the server no longer holds can stay on screen until the next server snapshot (seconds online; until reconnect offline), including bookings from an older window after the bookings window moves. The data check waits for that server snapshot instead of counting those rows. | done web, owner to confirm |
| 12 Nov | Where the panel lives (when the switch is on): web Data health page, iOS Settings → Data health (iOS had put it in Manage Users). Nothing shows anywhere while the switch is off. | done web + iOS, owner to confirm |

## 1.37.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 10 Nov | A half-day pending request reads "AL? AM" / "AL? PM" (the owner named "AL?" for pending and "AL AM" / "AL PM" for halves). | done, owner to confirm |
| 10 Nov | An unbooked leave day on the grid can still be tapped to quick add (web) / open scheduling (iOS); the leave conflict check runs before any save, as today. | done, owner to confirm |
| 10 Nov | Web cells keep one tile per booking (two bookings on one day stay two tiles, each coloured by its own hours); iOS keeps one combined cell per day, as before. The leave band is drawn once per day, on the first tile. | done, owner to confirm |
| 10 Nov | A leave day under a multi-day request skips weekends and the region's bank holidays (the days the allowance counts, `leaveRecordDayKeys`); a single-day request on a Saturday or Sunday shows. | done (rule), owner to confirm |
| 10 Nov | The tile colour (Standard / Std + OT / OT only / Half day) is one rulebook function on both apps (`scheduleCellKind`, review #299). A booking that pays 0 hours shows as a Standard 0h tile (iOS used to show an empty dashed chip for it), so it is never hidden. Figures are unchanged. | done, owner to confirm |
| 10 Nov | AM leave and PM leave on the same day show as a full day ("AL"; "AL?" when both are pending); one approved and one pending shows both, "AL AM · AL? PM" (review #299). | done, owner to confirm |
| 10 Nov | Web legend adds one extra swatch, "AL? = leave requested", so pending leave is explained. | done web, owner to confirm |

## 1.36.0 judgement calls, 10 Nov (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 10 Nov | "Exactly the same name" = first name and last name each trimmed, without letter case, with runs of spaces inside a name read as one ("Mary  Ann" = "mary ann"). Accents and punctuation are compared as typed ("Zoë" ≠ "Zoe", "O'Neil" ≠ "ONeil"). An older document with only a single `name` is compared on the whole name. | done, owner to confirm |
| 10 Nov | Who counts: active, inactive and pending people and ghosts. Not counted: anonymised deleted profiles, and leftover invites whose email claim is gone (the people lists hide them too, `isIdentifiablePendingLeftover`). Several records of one person (same email, former invite id) are one entry. | done, owner to confirm |
| 10 Nov | The warning runs after the form's own checks pass (names, email, line manager, rate), so it is the last step before saving; it lists each matching person with their email, or "No app login" for a ghost ("No email" for anyone else without one, review 10 Nov), and whether they are inactive or pending. | done, owner to confirm |
| 10 Nov | Judgement call 4 — **owner decided 10 Nov: refuse.** When the iPhone cannot run the shared rules (`usersWithSameName` does not answer, the script is unavailable), Add user refuses to create the user — invite and ghost alike — with "Couldn't check this user — try again." and saves nothing; Add anyway never bypasses it. Consistent with the 7 Nov rule that a ghost is never created when the rules cannot load. (Before: no warning and the save went on.) Web always runs the rules in the page, so this is iOS only. | done iOS (ios-1.36, iOS #209) |

## 1.36.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 7 Nov | 1.36.0 is fixes only (owner: "do all"). Figures that change, only where they were wrong: (a) weekly report / timesheet pay for a person whose rate-history row is filed only under a second `operatives` row on their email now uses that rate; (b) Edit User "previous rates" lists rows under a former invite id, another letter case or a second row; a rate change no longer writes a duplicate seed row then; (c) timesheet invoice rate-change notes include those rows; a person with no email no longer picks up every no-email row's notes; (d) My tasks may list more tasks (under the users id, a second managers row, another letter case) — never fewer. | done web, owner to confirm |
| 7 Nov | "This week" and "today" on web week screens follow the organisation's zone. A browser in the organisation's zone sees no change; one abroad or near midnight opens on the organisation's week. A new toolbox-talk week commencing is stored as organisation-zone midnight of its Monday. | done web, owner to confirm |
| 7 Nov | Ghost conversion script: a person with a login here — a member from another company, or a users document storing `organizations/{id}` or a DocumentReference (review fix) — is never a candidate; re-run the dry run before `--apply` (the check list may be shorter). | done (script), owner to confirm |
| 7 Nov | **Pay change — decided 10 Nov: option (a)** (see 10 Nov decisions). Item (a) above changes a pay figure for anyone with two or more `operatives` rows on their email whose non-linked row has newer rate history (test: 200 → 260). | decided (a), done web (1.36.0, w136-fixes) |
| 7 Nov | Toolbox talk "W/C" shows the organisation's Monday in every browser zone (review fix: a London talk viewed from New York read Sunday); older stored values read as before for a browser in the organisation's zone. | done web |

## 1.35.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 7 Nov | "Due this week" under open tasks is the Home figure (today and the next six days, `homeOverviewMetrics.tasksDueThisWeek`), not the Monday–Sunday week the hours use, so it matches the Home tile. | done, owner to confirm |
| 7 Nov | Hours use `bookedWorkedHours`, not `managerCoverageHours.paidHours`: the latter caps a block that spans the standard day at the weekday paid day (06:00–18:00 read 8h, not 11.5h). | done, owner to confirm |
| 7 Nov | Manager schedule bookings of every place (office, working from home, site survey, jobs) count as hours booked. | done, owner to confirm |
| 7 Nov | **Offline wait (owner: "5s ok")**: iOS My Profile waits up to 5 seconds for bank holidays when offline, then shows figures with the cached bank holidays and recalculates once they load. | done, owner confirmed 7 Nov |

## 11 Nov decisions (for 1.41)

| Date | Decision | Status |
|---|---|---|
| 11 Nov | **Scheduling week, a person with several bookings on one day: option (a).** One tile per person-day on both apps reading the day total and the number of bookings ("26h · 2 bookings"), with standard and overtime underneath (clock overtime × rate as elsewhere). Rule: `scheduleDayCell`. Web now combines per person-day like iOS (owner: one scheme on both apps); a tile with several bookings opens a chooser so each booking stays editable. | done web + rulebook (1.41.0, w141-schedule-replace); iOS (ios-1.41) |
| 11 Nov | **On a leave day (brown AL band) drop the small "STD" / "OT" words** so the figures fit (owner yes). `scheduleDayCell` `onLeave`; "AM" / "PM" stay. | done web + rulebook (1.41.0); iOS (ios-1.41) |
| 11 Nov | **A booked person is never unknown.** iOS (#216) resolves rows through `resolveBookingPerson`; for an id that names nobody, iOS now matches web exactly — the booking is left off the grid — and records the drop in the device log. | done iOS (ios-1.41); web unchanged (already drops) |
| 11 Nov | **"Replace existing booking", build before launch.** A third choice on every orange double-booking row beside ✓ (book both) and ✕ (drop): Replace, offered only when the viewer `canDeleteBooking` every overlapping booking; the new booking and the old booking's delete + tombstone in ONE batch (`bookingReplaceOffer`, `bookingReplaceWrites`). Web: Schedule wizard, Book labour, Daily Overview sheet, Quick Add, booking edit (job week). iOS: Select Operatives / Scheduling wizard, Quick Add, Book labour. | done web + rulebook (1.41.0); iOS (ios-1.41) |

## 1.41.0 judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 11 Nov | **Replace is online only on iOS** (`booking.replace` in `OFFLINE_ACTIONS`, disabled offline with "Connect to the internet to change this"). A safe offline Replace needs a new kind of queued item replayed in a transaction (re-read the old booking and its tombstone, keep the new booking and tell the person when the old one could not be removed); building and proving that without a device build was too risky for this release. ✓ and ✕ on the row still work offline. Can follow as its own release. | done, owner to confirm |
| 11 Nov | A one-booking tile shows no count ("8h", not "8h · 1 booking") and keeps its slot text; the count appears from two bookings. | done, owner to confirm |
| 11 Nov | A day's colour with several bookings comes from the summed hours (a stored AM / PM or OVERTIME slot decides it only when it is the day's one booking), as iOS already did. | done, owner to confirm |
| 11 Nov | Replace is offered only when EVERY overlapping booking on the row may be deleted by the viewer; it removes all of them. A row overlapping a booking on a job the viewer does not manage shows ✓ and ✕ only. | done, owner to confirm |
| 11 Nov | Web My Schedule (self-booking and the read-only screen's edit) does not offer Replace (not in the owner's list); its orange rows keep ✓ / ✕. | done, owner to confirm |
| 11 Nov | Subcontractor firm rows on the week grid also combine per day (web and iOS) with the same chooser; before, iOS showed only the firm's first booking that day. | done, owner to confirm |
| 12 Nov | **Guardrail 3 — who drops out of view (review 1.41 #5):** on the iOS job week grid, a booking whose person id names nobody the phone knows (in practice: past bookings of people who were deleted) is no longer shown as an "Unknown" row — it is left off the grid, as web already did, and noted in the device log. The booking itself is not changed or deleted, and still counts everywhere else (weekly report, timesheets). While the roster is still loading the grid shows "Loading people…", never an empty grid. | done iOS (ios-1.41), owner to confirm |
| 12 Nov | Replace re-checks each booking it removes inside the save: if it changed on another device since the screen loaded it, nothing is saved ("Changed on another device — not replaced."); if it is already gone, "The existing booking was already removed on another device — not replaced." A replaced booking on a signed or exported timesheet shows the same warning as a delete first (`bookingDeleteSignedTimesheetWarning`), and its PAYE overtime line reopens as after a delete (review 1.41 #1–#3). | done web + iOS (1.41.0), owner to confirm |
| 12 Nov | Follow-up found in review 1.41: web's ordinary booking delete (Edit Booking, Daily Overview sheet) does not show the signed-timesheet warning (`bookingDeleteSignedTimesheetWarning`, rulebook §2); iOS does. Replace on web now does. | open (follow-up) |
## 11 Nov decisions (web pages UI pack — Daily overview, Timesheets, Manage users)

UI only, web only (`docs/design/web-pages-ui/web-pages-ui-spec.md`; branch `w-ui-restyle`). Answers to the Phase 1 "decision needed" list.

| Date | Decision | Status |
|---|---|---|
| 11 Nov | **U1** Daily overview rows get the Type chip (Standard / Std + OT / OT only) and the standard / overtime mini bar, from the existing rule (`scheduleCellKind` / `scheduleCellHours`) as a small labelled change in `buildDailyOverview`, no new calculation. | open (after 1.39 / #302 merges) |
| 11 Nov | **U2** Daily overview shift and times on two lines, built from the booking's structured fields, never by parsing the subtitle string. | open (after #302) |
| 11 Nov | **U3** Only figures already loaded on a page; no new fetches. User Timesheets tabs get no counts; the hub band repeats the User timesheets tile's own counts. | done web (w-ui-restyle) |
| 11 Nov | **U4** The Sign page summary uses exactly the figures the Sign page already uses (Hours, Price work, Expenses, Timesheet total) and re-displays the timesheet's own line rows read-only. | done web (w-ui-restyle) |
| 11 Nov | **U5** "Manager who agreed this" stays free text with its suggestions (no select). | done web (w-ui-restyle) |
| 11 Nov | **U6** Matching dark-mode tokens with AA contrast: light text on dark surfaces, no clashes. | done web (w-ui-restyle, `app/pages-ui.css`) |
| 11 Nov | **U7** Use the Home page `--dash-*` colours so the whole site matches. | done web (w-ui-restyle) |
| 11 Nov | **U8** Gradient icon tiles allowed on these pages. | done web (w-ui-restyle) |
| 11 Nov | **U9** Keep today's wording (where the reference HTML differs, the code's text stays). | done web (w-ui-restyle) |
| 11 Nov | **U10** Daily overview uses the 1.39 wording (#302, `w139-booking-breakdown`). | open (after #302) |
| 11 Nov | **U11** Restyle the pages §4 did not list (PAYE overtime lines, claims screens, manager review, Other / Site survey cards, Manage users notices, resend invite) with the same building blocks, no behaviour change. | done web for timesheets, overtime, claims, Manage users (w-ui-restyle); Daily overview parts open (after #302) |

## UI pack judgement calls (owner to confirm)

| Date | Choice | Status |
|---|---|---|
| 11 Nov | No new back links: a band shows a back control only where the page had one before (spec §1 "no new click targets" overrides §4.3's "back link to Timesheets" on My Timesheets). | done, owner to confirm |
| 11 Nov | Timesheet detail band figures follow what the page shows today: My Timesheets shows Hours subtotal, Overtime (when above 0) and Extras (when above 0, combined as today); review shows Hours · shifts, Overtime, Price work · N, Expenses · N. | done, owner to confirm |
| 11 Nov | Manage users rows gain an explicit open (chevron) button beside the existing key / resend buttons; it calls the same handler as the row. | done, owner to confirm |
| 11 Nov | The Sign Off (line manager) step keeps its own copy and has no summary table (the spec's summary is for the person's own sign). | done, owner to confirm |
| 11 Nov | The Add Price Work / Add Expense submit moved from the header to the foot of the dialog (same form submit and disabled rule); "Add end date" stays a checkbox that reveals the date. | done, owner to confirm |
| 11 Nov | Review fixes (U9, keep today's wording): no new chips or button text on My Timesheets, timesheet rows, the overtime person title or pending requests; payment runs read "• Run: X - Y" as before; Exported keeps its visible Search / Filter / Payment run labels. While a timesheet loads and on Sign / Sign Off, the band keeps "Timesheet" / "Review Timesheet" and the list back link, with the sheet's own Back / Cancel beside it. | done |
| 11 Nov | Sign Timesheet: the read-only rows are labelled "Bookings and leave" (price work and expenses are not listed as rows; their totals sit beside it, unchanged), and the table is hidden when there are none. The card keeps the old heading "You're approving". | done, owner to confirm |
| 11 Nov | Action cards (hub tiles, My Timesheets current period, overtime tiles) show a small "Open →" cue under the card; it is decoration on the same button, but it is new text. | done, owner to confirm (remove if U9 should cover it) |

## Open questions for the owner

| Date | Question |
|---|---|
| 7 Nov | ANSWERED 10 Nov (see 10 Nov decisions): option (a). Pay change in 1.36.0 — people with two or more `operatives` rows on one email have their rate history read across every row (rulebook §8). |
| 5 Nov | ANSWERED 5 Nov (see Files, data and privacy). Pay visibility edge cases after removing line managers: (a) does a person see their own rate on My Profile (rulebook §12 says yes, read-only)? (b) a line manager who is not an admin or Operatives manager signs a self-employed timesheet — do they see its £ amounts and the invoice, or hours only? Recommended: (a) yes; (b) hours only, £ hidden. |

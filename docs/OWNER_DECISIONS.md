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
| 4 Nov | Web: the projects and small works list spacing gets tidied. | open (web only) |
| 4 Nov | Blank "Assigned manager" rows made by older iOS builds are removed with an owner-run script (dry run first). | script merged (#260); owner to run |

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
| 5 Nov | **My Profile UI upgrade, iOS and web** (iOS: opened from the Home screen). General UI upgrade with personal metrics, the same on both apps and following the same rules. Metrics come from rulebook functions only (no new calculators); proposed set awaiting owner confirmation. | open (after #264) |
## Known rulebook bugs (fix in the next rulebook release)

| Date | Bug | Status |
|---|---|---|
| 4 Nov | **SECURITY (live 1.30.2):** a manager with the Operatives toggle can make an operative an admin through `permissions.adminAccess` (or `manager`, `operatives`, `isSuperAdmin`, `annualLeaveSelfBook`, `timesheetSelfSign`), and can create a user with `permissions.adminAccess: true`. Owner: fix before launch; no interim toggle change. | fixing (#264 1.31.1: second review F1, F2, F4 and third review B1, B2, S1, S3, S4 fixed with emulator tests; owner deploy pending) |
| 4 Nov | **F5 (unverified email edits a pending invite)** is closed in the **next rules release**, not in #264: first the apps stop touching pending placeholders in the same-email profile sync (or verify emails), then the rules require `email_verified` on the email self path. Accepted pre-launch risk until then. | superseded (by the row below: F5 fixed now in #264) |
| 4 Nov | **F5 fixed now in #264** (reverses the earlier "next rules release" row). No `email_verified` requirement, so web `saveUser` same-email sync keeps working. Accepting an invitation needs proof of the emailed invitation: the new `users/{authUid}` carries the secret `invitationId` (for that email and organisation, not used) and the invitation is marked used in the same batch (rules `inviteBeingAccepted` via `getAfter`); the email-claim take-over, users update and delete by email of a pending placeholder (`passwordSet` not true), its tax ids and the invited pay copy need an account created that way in the placeholder's organisation (`callerAcceptedPlaceholder`); the invitee's own mark-used needs the account or membership written with that invitation id. Web `completeInviteSetup` writes the account and marks the invitation used in one batch; iOS has no accept flow of its own (it sends invitees to the web link). The reviewer probe c3 is refused at every step. | done in #264 (owner deploy pending) |
| 4 Nov | A manager or operative can still switch off their own Annual Leave Management (rulebook: nobody changes their own toggles). Owner: close in the next rule release, after iOS sends changed-fields-only profile saves. | open |
| 4 Nov | 93 rules tests still get their refusal from the 1,000-expression limit rather than logic (74 after #264's second round: users create, overtime booking updates and organisation moves are logical now; 49 of 203 after the third round and F5: invite accept, email claims, invitation mark-used and organisation updates by strangers are logical now); apply the 1.31.1 ternary restructure to the rest of firestore.rules (`RULES_STRICT_BUDGET=1 npm run test:rules` lists them). | open (next rule release) |
| 4 Nov | Web `setUserActive` merge-sets the membership `{accountActive}`, creating a bare membership; and `userActiveWrites` writes `users/{uid}.isActive` even when that document's `organizationId` is another company. | open (next rule release; iOS fixed the first in #187) |
| 4 Nov | `preferFinishedAccount` (warningRows.ts:410) lets an inactive account through, so inactive users can show as unbooked in Warnings and Book labour. The rulebook says inactive users are skipped. | open |
| 4 Nov | Web clash check when booking (`lib/scheduling/bookingClashUtils.ts:151`) compares `operativeId` with letter case, so an existing iOS upper-case booking is missed. | open |
| 4 Nov | Web: a rate change's `operativeId`, the weekly-report/timesheet-export rate fallback and the "is this my own booking" check each pick one operatives row (`EditUserProfile.tsx`, `weeklyReportPayroll.ts`, `timesheetExport.ts`, `scheduleNavigation.ts`; sweep FU-5). | open |
| 4 Nov | Web week grids use the browser's week in 11 files; needs a shared "organisation week" rule (sweep FU-4; iOS Scheduling has the same problem). | open (rule release) |
| 4 Nov | Overtime: until 1.32's partial approval, a request containing one line under an older record cannot be approved by the line manager at all (whole approval refused, "Needs an admin"); admins can. | fixed (1.32.0 / PR #274: partial approval) · superseded by 6 Nov "A line manager can always approve" (1.33.0) |

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

## Open questions for the owner

| Date | Question |
|---|---|
| 5 Nov | ANSWERED 5 Nov (see Files, data and privacy). Pay visibility edge cases after removing line managers: (a) does a person see their own rate on My Profile (rulebook §12 says yes, read-only)? (b) a line manager who is not an admin or Operatives manager signs a self-employed timesheet — do they see its £ amounts and the invoice, or hours only? Recommended: (a) yes; (b) hours only, £ hidden. |

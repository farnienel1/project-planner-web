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
| 4 Nov | `minimumIosBuild` is raised before 1.32 switches on; older iPhone builds must update (pre-launch, testers only). Claude sends the owner the exact steps. | open (1.32) |
| 4 Nov | 1.32: the rulebook version (e.g. "Rules 1.32.0") is shown to **everyone** at the bottom of Settings on web and iOS. | open (1.32) |
| 4 Nov | Cross-referencing safeguards A–F ("all yes"): A screen map (web ↔ iOS ↔ rulebook functions per screen); B PR checklist enforced by CI; C an independent reviewer checks every PR against this register, the screen map and the other app before merge; D shared test scenarios for both apps; E a weekly drift check; F checkpoint test lists generated from this register. Accepted that changes take longer. | open (A, B, E being built; C applies from now; D after A; F at the next checkpoint) |

## Scheduling, bookings and working hours

| Date | Decision | Status |
|---|---|---|
| 4 Nov | **Who may delete a labour booking:** admins any booking; managers bookings on jobs they are assigned to (current rule A, `canDeleteBooking`), plus their own office/WFH/site-survey bookings. Operatives never. | done (rule since 1.10.0; iOS wording fixed #186) |
| 4 Nov | **Cancel is removed as a user action**: bookings are Book / Edit / Delete only. Old Cancelled bookings stay hidden; no data is changed. Web removes the "Cancel booking" button. | open (1.33, split) |
| 4 Nov | **PAYE overtime ✕ on an all-overtime day** (weekend, or entirely outside working hours): the operative's ✕ is a request to their line manager and all admins (notified); on approval the booking is **deleted** (not cancelled). Rules: the approving line manager may delete that one booking even if not the job's manager. Lines under an older record still need an admin (decision A). No line manager / Super Admin: applied directly after the warning. | open (1.33, split) |
| 4 Nov | **Offline delete on iOS** ("offline delete: all recommended"): deleting a labour or manager-schedule booking works offline. It queues with its tombstone and shows "Pending sync", undo from the sync list. A booking created and deleted offline sends nothing. If the booking was changed on another device after the offline delete, the replay is **refused** with "changed on another device — not deleted". If permission was lost, it is refused and the booking reappears with a message. Subcontractor bookings stay **online only**. Deleting a booking on a day that is on a signed timesheet **warns but allows** (the signed sheet never changes). Fixes the two existing iOS outbox bugs (refusal detection, lower-case schedule ids). Web stays online only. | open (1.33, split) |
| 3 Nov | Weekend set-window part booking is pro rata: counts-as hours on the day's own Saturday or Sunday settings. 07:30–11:00 in a 07:30–14:00 window counting 8h = 4.31h. Saturday outside-window example 9.5h confirmed. | done (1.20.4) |
| 3 Nov | Bookable jobs: live only, visible to the booker, and `canWriteBooking`. Job start and end dates are not checked. | done (1.21) |
| 3 Nov | Job visibility is by account and email only, never by name. | done (1.21) |
| 3 Nov | Book Labour "covered" uses the web clock-time rule (`standardDayCoverage`, lunch excluded); iOS adopts it via `managerCoverageHours.covered`. | done (1.22) |
| 4 Nov | A booking's own overtime multiplier (`otMultiplierOverride`) is edited in Edit Booking by admins and managers (never operatives), 1–3 in 0.25 steps. It applies to self-employed pay too, so raise `minimumIosBuild` before enabling. | done (1.29), see 1.32 |
| 4 Nov | 1.32: every custom-hours create screen gets the multiplier, pre-filled with the organisation rate for that day. The weekly report shows the multiplier per overtime row ("2h at ×1.5 = 3h") and marks rows changed from the organisation rate. Raise `minimumIosBuild` first. | open (1.32) |
| 4 Nov | 1.32 multiplier, owner chose **A**: the multiplier is stored on the booking (`otMultiplierOverride`) only when the person changes it from the pre-filled organisation rate. Bookings left at the organisation rate follow later rate changes, including scheduled ones, and only edited rows are marked on the weekly report. | open (1.32) |
| 4 Nov | Book labour lists exactly the warning's unbooked people (`unbookedLabourRowsOnDay`), weekends included when the setting is on. | done web (#262); iOS already |
| 4 Nov | Judgement call in #262: an operative with an app login but no Operatives-list row is booked under their users id from web Book labour (the rulebook counts it, `bookingIdsForAccount`). iOS still shows "No operative profile is linked" (iOS follow-up). | owner to confirm |

| 4 Nov | **Booking screens follow `canWriteBooking` (1.10.0 rule kept)** (owner: "yes"). Managers book their own Office / Working from home / Site survey from any screen (My Schedule, project and small works scheduling, Daily Overview, Warnings → Book labour), and book other people only onto jobs they manage. Admins book anyone anywhere. Operatives: jobs only, never book themselves. Every screen offers exactly what the rule allows, so a save is never refused after the fact (fixes Book labour offering Office etc. for a manager's reports). | open (1.32) |
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
| 4 Nov | **Ghost operatives** (owner design, "ghost: all recommended"): an operative with no app login, created by admins and managers with the Operatives toggle (admins notified on add and delete). Required: first name, last name, trade, and a day **or** hourly rate (self-employed, cost shown on the weekly report). Phone optional; no email, so no invite. A line manager is required, so their manager sees the unbooked warning. Admins or their line manager book leave for them (approved straight away). Bookable everywhere (Book labour, scheduling, Quick Add); appears in Warnings, Daily Overview and the weekly report. They never get a login, notifications, timesheets, overtime requests, price work or expenses, or My Schedule. Can be upgraded to a normal user by adding an email and inviting them, keeping all history. Existing no-login operatives rows become ghosts automatically, listed for the owner to check first. The new-operative screen on both apps explains what a ghost is. Cross-checked against the rulebook, firestore.rules, web, iOS, the screen map and an independent review before merge. | open (1.34, split) |
| 3 Nov | Every user has a level. Flagless users are legacy data: they go on the Managers list (1A), their clashes stay High (2A), and admins are shown them to fix. | done (1.23) |
| 4 Nov | Add User never offers the invitee as their own line manager. | done (1.27) |
| 4 Nov | Everyone needs a line manager, except an admin with both self-manage toggles on (Annual Leave Management and Timesheet self-sign); a PAYE admin needs the leave toggle only. The Super Admin counts as both on. | done (1.28) |
| 4 Nov | The Timesheet self-sign toggle is for admins only and never carries into a manager profile after demotion. Admins with Manage Users change the toggles; nobody changes their own. No notification. | done (1.28) |
| 4 Nov | A demoted admin keeps Annual Leave Management; the person changing the user type is responsible for it. | done (1.31.0) |
| 4 Nov | The Super Admin card shows both toggles on, greyed out, with a note. | done web (1.31.0); iOS open |
| 4 Nov | No rights carry over on a level change (for example manager → operative loses operatives management and line-manager rights). | done web (1.31.0); iOS open |
| 4 Nov | Demoting, deactivating or deleting a line manager is blocked, with a warning listing their reports, until each report has another line manager. | done web (1.31.0); iOS open |
| 4 Nov | Operatives managers (manager + Operatives toggle) add, edit and delete operatives only, with or without a login. Admins are notified on operative added and deleted. | done web (1.31.0); iOS open |
| 4 Nov | Operatives managers delete only future labour bookings of operatives without a login; past and today's they may only cancel. | done web (1.31.0); iOS open |
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
| 4 Nov | 1.32: a notice when an export skips the exporter's own sheet. | open (1.32) |

## PAYE overtime, price work and expenses

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Overtime follows the organisation policy and is shown as hours only, never £, with the multiplier shown. The cog edits start, finish and multiplier and writes back to the booking. | done (1.29) |
| 4 Nov | ✕ means "I didn't work those overtime hours": weekday bookings are clamped to the working day. A weekend multiplier-only day, or a weekday booking that is all overtime, is cancelled after a clear warning. A weekend set window is trimmed to the window. | done (1.29) |
| 4 Nov | Operative-level PAYE users' changes are requests, approved by their line manager or any admin. Push goes to line managers and all admins. "Send for approval" / "Generate overtime report". | done (1.29) |
| 4 Nov | PAYE payday (day of month; 29–31 means the last day of shorter months). A change applies from the next payrun; past payruns keep their dates. Current / past payruns / custom range. | done (1.29) |
| 4 Nov | 1.32: the PAYE payday is saved by the main Save, is mandatory at organisation setup, and a banner shows if it is missing. | open (1.32) |
| 4 Nov | 1.32 (option 2): ✓ ✕ ⚙ are allowed on future days within the current payrun; future payruns stay locked. | open (1.32) |
| 4 Nov | 1.32: own-overtime edits are requests when the person has a line manager, and direct when they have none or are the Super Admin. | open (1.32) |
| 4 Nov | 1.32: one shared "all records for this person" rule for overtime loading, sending and approving. ✓ ✕ ⚙ on each line, one Approve button, clear messages ("Approved 2 of 5…", "Nothing was approved…"). | open (1.32) |
| 4 Nov | Owner chose **A**: overtime filed under an older (operatives-row) record is approved by admins only; the line manager sees "Needs an admin". | open (1.32) |
| 4 Nov | Price work: approver is a required pick from admins and managers only. Expenses need at least one piece of evidence. Personal site audits are visible to their creator only. | done (1.30) |
| 4 Nov | 1.32: the price work and expenses review screen matches the overtime review (✓ ✕ per line, one Approve button), plus the same all-records-per-person check. | open (1.32) |

## Files, data and privacy

| Date | Decision | Status |
|---|---|---|
| 3 Nov | Data export: a ZIP with one CSV per area plus a JSON copy; admins only. | done |
| 4 Nov | File recovery and company restore windows are both 30 days; the privacy policy says so. Admins can still hard-delete files. Keep a `removedEvidence` list. Profile photos get versioned names. | done (1.27) |
| 4 Nov | The invited rate is copied to private pay on accept. Operatives managers see catalogue operatives' rates. | done (1.27) |
| 4 Nov | Material email: the sender must be able to see the job, and the job number must match. | done |

## iOS

| Date | Decision | Status |
|---|---|---|
| 4 Nov | Booking and scheduling design upgrade (owner spec, "UI: all recommended"): reuse the Home design kit; "on site" = finish − start; keep the shared lunch-warning text; rate chips ×1 / Org (real rate) / ×2 / ×3 plus More rates; the tab bar stays hidden on Scheduling; "Next 3/5 working days"; projects green, small works amber. | open (iOS #186) |
| 4 Nov | The design upgrade PR also fixes the PAYE break bug from Scheduling, shows Delete on labour bookings to admins only, and fixes the hours display. | open (iOS #186) |
| 4 Nov | 1.32: the overtime rate on managers' own site bookings is shown consistently on Scheduling, Daily Overview and My Schedule. | open (1.32) |

| 4 Nov | **Materials catalogue** (add, edit, delete catalogue items and prices) is **admins only** on both apps, through one rulebook rule. iOS `canManageMaterialCatalogue` currently has its own role check (found in the #188 sweep). Sending material orders is unchanged. | open (next rulebook release) |
| 4 Nov | Very old timesheets with sign-off dates but no signer name or signature image read **Sign Off Pending** (rulebook `isTimesheetFullySigned`), on both apps. No rulebook exception: new organisations only use the new rules. | done (iOS #188, web already) |
## Known rulebook bugs (fix in the next rulebook release)

| Date | Bug | Status |
|---|---|---|
| 4 Nov | **SECURITY (live 1.30.2):** a manager with the Operatives toggle can make an operative an admin through `permissions.adminAccess` (or `manager`, `operatives`, `isSuperAdmin`, `annualLeaveSelfBook`, `timesheetSelfSign`), and can create a user with `permissions.adminAccess: true`. Owner: fix before launch; no interim toggle change. | fixing (#264 1.31.1, then third review, then owner deploy) |
| 4 Nov | **F5 (unverified email edits a pending invite)** is closed in the **next rules release**, not in #264: first the apps stop touching pending placeholders in the same-email profile sync (or verify emails), then the rules require `email_verified` on the email self path. Accepted pre-launch risk until then. | open (next rules release) |
| 4 Nov | A manager or operative can still switch off their own Annual Leave Management (rulebook: nobody changes their own toggles). Owner: close in the next rule release, after iOS sends changed-fields-only profile saves. | open |
| 4 Nov | 93 rules tests still get their refusal from the 1,000-expression limit rather than logic; apply the 1.31.1 ternary restructure to the rest of firestore.rules. | open (next rule release) |
| 4 Nov | Web `setUserActive` merge-sets the membership `{accountActive}`, creating a bare membership; and `userActiveWrites` writes `users/{uid}.isActive` even when that document's `organizationId` is another company. | open (next rule release; iOS fixed the first in #187) |
| 4 Nov | `preferFinishedAccount` (warningRows.ts:410) lets an inactive account through, so inactive users can show as unbooked in Warnings and Book labour. The rulebook says inactive users are skipped. | open |
| 4 Nov | Web clash check when booking (`lib/scheduling/bookingClashUtils.ts:151`) compares `operativeId` with letter case, so an existing iOS upper-case booking is missed. | open |
| 4 Nov | Web: a rate change's `operativeId`, the weekly-report/timesheet-export rate fallback and the "is this my own booking" check each pick one operatives row (`EditUserProfile.tsx`, `weeklyReportPayroll.ts`, `timesheetExport.ts`, `scheduleNavigation.ts`; sweep FU-5). | open |
| 4 Nov | Web week grids use the browser's week in 11 files; needs a shared "organisation week" rule (sweep FU-4; iOS Scheduling has the same problem). | open (rule release) |
| 4 Nov | Overtime: until 1.32's partial approval, a request containing one line under an older record cannot be approved by the line manager at all (whole approval refused, "Needs an admin"); admins can. | open (1.32) |

## Open questions for the owner

| Date | Question |
|---|---|

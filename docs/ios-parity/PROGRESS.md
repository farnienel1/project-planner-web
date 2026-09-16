# iOS → Web parity: progress
Last updated: 2026-09-16 10:20 UTC · Current step: Phase 1 complete, waiting at Stop Gate 1 · Stopped at: Stop Gate 1 (no app code)

## Access check (Phase 0)
- **WEB_ROOT:** `/workspace` (this repo, `project-planner-web`)
- **IOS_ROOT:** placeholder `<<IOS_PROJECT_PATH>>`. Expected path from existing docs: `/Users/farnienel/Desktop/Project Planner/Project Planner/`
- **iOS on this machine:** **not reachable.** No `.xcodeproj`, `GoogleService-Info.plist`, or `.swift` files anywhere on the Cloud Agent VM. Environment repos list only `github.com/farnienel1/project-planner-web`.
- **Consequence:** Phase 1 documents start from `IOS_APP_BLUEPRINT.md` (built from the real iOS source on 16 Sep 2026: 210 Swift files, ~115,000 lines). Claims are cited as `File.swift:line` **from the blueprint**. They are marked ❓ UNVERIFIED against the live Swift tree until Farnie adds the iOS folder to the workspace.
- **Branch:** `cursor/ios-parity-rebuild-c40f` (Cloud Agent naming; intent is the `ios-parity-rebuild` workstream)

## Phases
- [x] 0 Access check
- [x] 1 Discovery (00 ☑ 01 ☑ 02 ☑ 03 ☑ 04 ☑ 05 ☑)
- [ ] 2 Foundations
- [ ] 3 Sections
- [ ] 4 Final audit

## Sections
| # | Section | Spec | Built | Agent-verified | Farnie-verified on iPhone | Notes |
|---|---|---|---|---|---|---|
| 0 | Shell, Login and Home (Phase 2) | ☐ | ☐ | ☐ | ☐ | Depends on Gate 1 decisions |
| 1 | Manage Users | ☐ | ☐ | ☐ | ☐ | |
| 2 | Add User | ☐ | ☐ | ☐ | ☐ | |
| 3 | Settings | ☐ | ☐ | ☐ | ☐ | |
| 4 | Job Types | ☐ | ☐ | ☐ | ☐ | |
| 5 | Qualifications | ☐ | ☐ | ☐ | ☐ | |
| 6 | Wholesalers | ☐ | ☐ | ☐ | ☐ | |
| 7 | Material Catalogue | ☐ | ☐ | ☐ | ☐ | |
| 8 | Sub Contractors | ☐ | ☐ | ☐ | ☐ | |
| 9 | Clients | ☐ | ☐ | ☐ | ☐ | |
| 10 | Managers | ☐ | ☐ | ☐ | ☐ | |
| 11 | Operatives | ☐ | ☐ | ☐ | ☐ | |
| 12 | Projects | ☐ | ☐ | ☐ | ☐ | |
| 13 | Small Works | ☐ | ☐ | ☐ | ☐ | |
| 14 | Scheduling and My Schedule | ☐ | ☐ | ☐ | ☐ | |
| 15 | Tasks | ☐ | ☐ | ☐ | ☐ | |
| 16 | Job tiles (View, Materials, H&S, Deadlines, Location, Active users) | ☐ | ☐ | ☐ | ☐ | Deadlines + Active users missing on web |
| 17 | Timesheets | ☐ | ☐ | ☐ | ☐ | |
| 18 | Annual Leave | ☐ | ☐ | ☐ | ☐ | |
| 19 | Site Audit | ☐ | ☐ | ☐ | ☐ | |
| 20 | Site Map | ☐ | ☐ | ☐ | ☐ | |
| 21 | Warnings | ☐ | ☐ | ☐ | ☐ | |
| 22 | Daily Overview | ☐ | ☐ | ☐ | ☐ | |
| 23 | Weekly Report | ☐ | ☐ | ☐ | ☐ | |
| 24 | Notifications, Help, Privacy, Profile | ☐ | ☐ | ☐ | ☐ | Inbox + privacy gate missing on web |

## Open questions
See `docs/ios-parity/STOP-GATE-1.md`. Highest priority: add the iOS project to this workspace so Phase 2 can cite live Swift.

## Decisions (date · decision · by)
- 2026-09-16 · Phase 1 produced from blueprint + web tree because IOS_ROOT is unreachable on the Cloud Agent VM · agent (pending Farnie)

## Approved exceptions
None yet.

## Web-only features (keep)
- Stripe org-setup / subscription checkout (`/setup`, `/api/stripe/*`)
- Guided organisation wizard (`/setup/*`)
- Customisable dashboard layouts (`dashboardLayouts/{uid}`, `/dashboard/edit`)
- `platformConfig`
- `users/{uid}/orgMemberships/{orgId}` (Change organisation)
- Skills catalogue UI (`/dashboard/skills`) — iOS marks skills deprecated
- Resend invite emails from Next.js API routes (instead of / in addition to the Cloud Function)
- Google Maps Geocoding API (`/api/geocode`) + Leaflet loaded from unpkg
- Team onboarding prompt
- Marketing landing page at `/`

## Firebase / console actions for Farnie
1. Add the iOS Xcode project folder to this Cursor workspace (see Stop Gate 1).
2. Confirm web app is registered in Firebase project `project-planner-f986c` and that `.env.local` uses that project (never commit keys).
3. Confirm Storage bucket: iOS uses `project-planner-f986c.firebasestorage.app`; `.env.example` shows `project-planner-f986c.appspot.com`.
4. Confirm `storage.rules` location (not in this repo, not in the iOS folder per blueprint).
5. Confirm whether the HTTP function `sendProjectPlannerEmail` (us-central1) remains the canonical email path for the web client.
6. Confirm App Check is still off (blueprint: unused).
7. Authorized domains for Auth must include the hosted web origin(s).
8. Decide map tiles + geocoding provider for production (OSM public tiles are not for production traffic).
9. Decide web push (optional; tokens would join `users/{uid}.pushTokens`).
10. Decide whether to tighten `holidayBookings` rules (currently any signed-in user, any org).

## Blueprint corrections
None verified against Swift (IOS_ROOT missing). Candidate web/blueprint mismatches that need Swift confirmation are listed in `01-data-model.md` and `05-web-gap-analysis.md`.

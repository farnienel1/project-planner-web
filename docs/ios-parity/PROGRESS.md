# iOS → Web parity: progress
Last updated: 2026-09-20 · Current step: Phase 3 job tiles + Switch organisation · Stopped at: Stop Gate (job tiles 16 partial + switch org)

## Access check (Phase 0)
- **WEB_ROOT:** `/workspace` (this repo, `project-planner-web`)
- **IOS_ROOT (this run):** `/home/ubuntu/ios-readonly/` — app folder from `Project Planner.zip` plus `Project Planner.xcodeproj` from the 19/06/2026 iCloud copy. **Not in git.**
- **Swift on disk:** **210 files, 114,699 lines.** Catalogue: `docs/ios-parity/00-ios-inventory-disk.md`.
- **Xcode project:** folder-synced (Xcode 26); iOS **17.0**; Swift 5.0; firebase-ios-sdk **12.15.0** (Auth, Core, Firestore, Storage, Messaging). `PRODUCT_BUNDLE_IDENTIFIER` `farnie.Project-Planner`.
- **GoogleService-Info.plist:** `PROJECT_ID` `project-planner-f986c`, `STORAGE_BUCKET` `project-planner-f986c.firebasestorage.app`, `BUNDLE_ID` `farnie.Project-Planner`.
- **Future Cloud Agent runs:** zip is not in the environment snapshot. Add the Xcode folder or an iOS GitHub repo to the environment.
- **Branch:** `cursor/ios-parity-phase-2-6b85` (from `main` after PR #7)

## Phases
- [x] 0 Access check
- [x] 1 Discovery (00 ☑ 01 ☑ 02 ☑ 03 ☑ 04 ☑ 05 ☑) + Gate 1 answers (Q1 xcodeproj received; Q2 how-to; Q3–Q10 noted)
- [x] 2 Foundations
- [ ] 3 Sections (started: Clients, Projects list+hub, Daily overview, job tiles, Switch organisation)
- [ ] 4 Final audit

## Sections
| # | Section | Spec | Built | Agent-verified | Farnie-verified on iPhone | Notes |
|---|---|---|---|---|---|---|
| 0 | Shell, Login and Home (Phase 2) | ☑ | ☑ | ☑ | ☐ | Zod + Heroicons; D1 editor hidden from Home; live bookings/managerSiteBookings/notifications |
| 1 | Manage Users | ☐ | ☐ | ☐ | ☐ | |
| 2 | Add User | ☐ | ☐ | ☐ | ☐ | Invite URL `/setup-password.html?token=` |
| 3 | Settings | ☐ | ☑ Switch org | ☐ | ☐ | Settings → Personal → Switch organisation |
| 4 | Job Types | ☐ | ☐ | ☐ | ☐ | |
| 5 | Qualifications | ☐ | ☐ | ☐ | ☐ | |
| 6 | Wholesalers | ☐ | ☐ | ☐ | ☐ | |
| 7 | Material Catalogue | ☐ | ☐ | ☐ | ☐ | |
| 8 | Sub Contractors | ☐ | ☐ | ☐ | ☐ | |
| 9 | Clients | ☑ | ☑ | ☐ | ☐ | Master–detail; UUID writes; address field; admin delete |
| 10 | Managers | ☑ | ☑ | ☐ | ☐ | Roster = manager users; catalogue writes `managers/` |
| 11 | Operatives | ☑ | ☑ | ☐ | ☐ | Roster = operativeMode users; catalogue writes `operatives/` |
| 12 | Projects | ☑ list/hub | ☑ list/hub + tiles | ☐ | ☐ | Job tiles: Materials, View, My Tasks, H&S, Site Audit, Location |
| 13 | Small Works | ☑ | ☑ list + tiles | ☐ | ☐ | Same six job tiles as Projects |
| 14 | Scheduling and My Schedule | ☐ | ☐ | ☐ | ☐ | Title-Case booking status |
| 15 | Tasks | ☑ job tile | ☑ job tile | ☐ | ☐ | Job My Tasks (not Home Tasks hub) |
| 16 | Job tiles (View, Materials, H&S, Deadlines, Location, Active users) | ☑ six tiles | ☑ six tiles | ☐ | ☐ | Deadlines + Active users still later |
| 17 | Timesheets | ☐ | ☐ | ☐ | ☐ | |
| 18 | Annual Leave | ☐ | ☐ | ☐ | ☐ | |
| 19 | Site Audit | ☑ per-job | ☑ per-job | ☐ | ☐ | Org hub still later |
| 20 | Site Map | ☐ | ☐ | ☐ | ☐ | Leaflet + Google; paid tiles |
| 21 | Warnings | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 22 | Daily Overview | ☑ | ☑ | ☐ | ☐ | People on job cards; hours estimated until s17 |
| 23 | Weekly Report | ☑ | ☑ | ☐ | ☐ | HTML generate; Monday-first week |
| 24 | Notifications, Help, Privacy, Profile | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |

## Open questions
D1, D2, D5–D10 still at recommendation (see `STOP-GATE-1.md`). Q1–Q10 are decided. **Q11:** test organisation for write tests (`STOP-GATE-2.md`).

## Decisions (date · decision · by)
- 2026-09-16 · Phase 1 produced from blueprint + web tree because IOS_ROOT was initially unreachable · agent
- 2026-09-16 · Q1: app-folder zip + `Project Planner.xcodeproj.zip` (19/06/2026 iCloud copy) · Farnie
- 2026-09-16 · Q2: keep `/setup-password.html?token=`; further help in `Q2-SETUP-URLS.md` · Farnie
- 2026-09-16 · Q3–Q10 noted (Title-Case status, Leaflet+Google, drop Skills, Zod, Heroicons, sections 14–16 & 21–24, `self_employed`, `manager: Custom`) · Farnie
- 2026-09-16 · Canonical public site is `https://www.projectplanner.us` (apex `https://projectplanner.us`). Firebase Hosting `project-planner-f986c.web.app/setup` is a stale marketing page. iOS `AppBranding.webAppBaseURL` must change in Xcode · agent (verified live) + Farnie
- 2026-09-16 · Q3: write booking status Title-Case (`Confirmed`, …) · Farnie
- 2026-09-16 · Q4: Leaflet + Google Geocoding; paid tiles; skip MapKit JS · Farnie
- 2026-09-16 · Q5: remove Skills from the web app (not keep-the-page) · Farnie
- 2026-09-16 · Q6: Zod in Phase 2 · Farnie
- 2026-09-16 · Q7: Heroicons (already installed); do not add lucide-react · agent (Farnie: pick one)
- 2026-09-16 · Q8: sections 14–16 and 21–24 stay in scope · Farnie
- 2026-09-16 · Q9: write `self_employed`; read both · Farnie
- 2026-09-16 · Phase 2 foundations: converters, permissions, shell, Home, auth merge/privacy, live bookings · agent
- 2026-09-20 · Phase 3 job tiles (Materials, View, My Tasks, H&S, Site Audit, Location) for projects and small works, plus Switch organisation · agent
- 2026-09-16 · Phase 3 started with Clients, Projects list/hub, Daily overview (not Manage Users first) · Farnie

## Approved exceptions
- Skills catalogue UI removed on web to match iOS deprecation (Q5). Firestore `users.skills` permission flag still written `false`. Existing `operatives.skills[]` is preserved on save, not wiped.

## Web-only features (keep)
- Stripe org-setup / subscription checkout (`/setup`, `/api/stripe/*`)
- Guided organisation wizard (`/setup/*`)
- Customisable dashboard layouts (`dashboardLayouts/{uid}`, `/dashboard/edit`)
- `platformConfig`
- `users/{uid}/orgMemberships/{orgId}` (Change organisation)
- Resend invite emails from Next.js API routes (instead of / in addition to the Cloud Function)
- Google Maps Geocoding API (`/api/geocode`) + Leaflet loaded from unpkg
- Team onboarding prompt
- Marketing landing page at `/`

## Firebase / console actions for Farnie
1. **Xcode (required):** follow `docs/ios-parity/Q2-SETUP-URLS.md` — change the two host strings (and the FirebaseBackend fallback) to `https://www.projectplanner.us`. This agent will not edit iOS.
2. **Netlify:** set `NEXT_PUBLIC_APP_URL` to `https://www.projectplanner.us` (or apex `https://projectplanner.us`).
3. **Optional until Xcode ships:** Firebase Hosting 301 `/setup` and `/setup-password.html` → the public site. Do not Hosting-deploy from this repo’s `firebase.json`.
4. Confirm web app is registered in Firebase project `project-planner-f986c` and that `.env.local` uses that project (never commit keys).
5. Confirm Storage bucket: iOS uses `project-planner-f986c.firebasestorage.app`; `.env.example` now documents that hostname (legacy `.appspot.com` may still work).
6. Confirm `storage.rules` location (not in this repo, not in the iOS zip).
7. Confirm whether the HTTP function `sendProjectPlannerEmail` (us-central1) remains the canonical email path for the web client.
8. Confirm App Check is still off (blueprint: unused).
9. Authorized domains for Auth must include `www.projectplanner.us` / `projectplanner.us` (and localhost). Firebase Hosting origin can stay until iOS URLs move.
10. Paid map tiles for production (Q4).
11. D1/D2/D5–D10 if you want those recommendations locked before Phase 2.

## Blueprint corrections
- `AppBranding.swift` is 36 lines on disk (blueprint 37).
- Hosted URL in the blueprint (`project-planner-f986c.web.app`) is **not** the production wizard. Production wizard is `https://projectplanner.us/setup`.
- Skills is gone on iOS **and** web (Q5). Older `docs/IOS_FIRESTORE_PARITY.md` still lists a Skills menu row.

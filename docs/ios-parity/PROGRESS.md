# iOS → Web parity: progress
Last updated: 2026-09-16 · Current step: Gate 1 answered (Q1–Q10); Phase 2 not started · Stopped at: Stop Gate 1 follow-up

## Access check (Phase 0)
- **WEB_ROOT:** `/workspace` (this repo, `project-planner-web`)
- **IOS_ROOT (this run):** `/home/ubuntu/ios-readonly/Project Planner` from attached `Project Planner.zip`. **Not in git.** App source folder only — **no `.xcodeproj`**.
- **Swift on disk:** **210 files, 114,699 lines.** Catalogue: `docs/ios-parity/00-ios-inventory-disk.md`.
- **GoogleService-Info.plist:** `PROJECT_ID` `project-planner-f986c`, `STORAGE_BUCKET` `project-planner-f986c.firebasestorage.app`, `BUNDLE_ID` `farnie.Project-Planner`.
- **Future Cloud Agent runs:** zip is not in the environment snapshot. Add the Xcode folder or an iOS GitHub repo to the environment.
- **Branch:** `cursor/ios-parity-rebuild-c40f`

## Phases
- [x] 0 Access check
- [x] 1 Discovery (00 ☑ 01 ☑ 02 ☑ 03 ☑ 04 ☑ 05 ☑) + Gate 1 answers
- [ ] 2 Foundations
- [ ] 3 Sections
- [ ] 4 Final audit

## Sections
| # | Section | Spec | Built | Agent-verified | Farnie-verified on iPhone | Notes |
|---|---|---|---|---|---|---|
| 0 | Shell, Login and Home (Phase 2) | ☐ | ☐ | ☐ | ☐ | Zod + Heroicons; D1 editor still open |
| 1 | Manage Users | ☐ | ☐ | ☐ | ☐ | |
| 2 | Add User | ☐ | ☐ | ☐ | ☐ | Invite URL `/setup-password.html?token=` |
| 3 | Settings | ☐ | ☐ | ☐ | ☐ | |
| 4 | Job Types | ☐ | ☐ | ☐ | ☐ | |
| 5 | Qualifications | ☐ | ☐ | ☐ | ☐ | |
| 6 | Wholesalers | ☐ | ☐ | ☐ | ☐ | |
| 7 | Material Catalogue | ☐ | ☐ | ☐ | ☐ | |
| 8 | Sub Contractors | ☐ | ☐ | ☐ | ☐ | |
| 9 | Clients | ☐ | ☐ | ☐ | ☐ | |
| 10 | Managers | ☐ | ☐ | ☐ | ☐ | |
| 11 | Operatives | ☐ | ☐ | ☐ | ☐ | No skills UI |
| 12 | Projects | ☐ | ☐ | ☐ | ☐ | Write `manager: "Custom"` |
| 13 | Small Works | ☐ | ☐ | ☐ | ☐ | |
| 14 | Scheduling and My Schedule | ☐ | ☐ | ☐ | ☐ | Title-Case booking status |
| 15 | Tasks | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 16 | Job tiles (View, Materials, H&S, Deadlines, Location, Active users) | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 17 | Timesheets | ☐ | ☐ | ☐ | ☐ | |
| 18 | Annual Leave | ☐ | ☐ | ☐ | ☐ | |
| 19 | Site Audit | ☐ | ☐ | ☐ | ☐ | |
| 20 | Site Map | ☐ | ☐ | ☐ | ☐ | Leaflet + Google; paid tiles |
| 21 | Warnings | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 22 | Daily Overview | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 23 | Weekly Report | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |
| 24 | Notifications, Help, Privacy, Profile | ☐ | ☐ | ☐ | ☐ | in scope (Q8) |

## Open questions
D1, D2, D5–D10 still at recommendation (see `STOP-GATE-1.md`). Q1–Q10 are decided.

## Decisions (date · decision · by)
- 2026-09-16 · Phase 1 produced from blueprint + web tree because IOS_ROOT was initially unreachable · agent
- 2026-09-16 · Q1: later phases read Swift from attached zip / future iOS repo; do not commit iOS · Farnie
- 2026-09-16 · Q2: keep `/setup-password.html?token=`; org setup web-only (pay + wizard); invitees set password on web then iOS login · Farnie
- 2026-09-16 · Canonical public site is `https://www.projectplanner.us` (apex `https://projectplanner.us`). Firebase Hosting `project-planner-f986c.web.app/setup` is a stale marketing page. iOS `AppBranding.webAppBaseURL` must change in Xcode · agent (verified live) + Farnie
- 2026-09-16 · Q3: write booking status Title-Case (`Confirmed`, …) · Farnie
- 2026-09-16 · Q4: Leaflet + Google Geocoding; paid tiles; skip MapKit JS · Farnie
- 2026-09-16 · Q5: remove Skills from the web app (not keep-the-page) · Farnie
- 2026-09-16 · Q6: Zod in Phase 2 · Farnie
- 2026-09-16 · Q7: Heroicons (already installed); do not add lucide-react · agent (Farnie: pick one)
- 2026-09-16 · Q8: sections 14–16 and 21–24 stay in scope · Farnie
- 2026-09-16 · Q9: write `self_employed`; read both · Farnie
- 2026-09-16 · Q10: new jobs `manager: "Custom"` · Farnie

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
1. **Xcode (required):** set `AppBranding.webAppBaseURL` and invite `setupPasswordBaseURL` to `https://www.projectplanner.us`. This agent will not edit iOS.
2. **Netlify:** set `NEXT_PUBLIC_APP_URL` to `https://www.projectplanner.us` (or apex `https://projectplanner.us`).
3. **Optional until Xcode ships:** Firebase Hosting 301 `/setup` and `/setup-password.html` → the public site. Do not Hosting-deploy from this repo’s `firebase.json`.
4. Confirm web app is registered in Firebase project `project-planner-f986c` and that `.env.local` uses that project (never commit keys).
5. Confirm Storage bucket: iOS uses `project-planner-f986c.firebasestorage.app`; `.env.example` shows `project-planner-f986c.appspot.com`.
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

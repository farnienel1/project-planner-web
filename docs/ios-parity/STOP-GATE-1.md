# ⏸ STOP GATE: Phase 1 (discovery) — answered 16 Sep 2026

**Done:**
- Read `IOS_PARITY_REBUILD.md` and `IOS_APP_BLUEPRINT.md` in full (blueprint in chunks; rebuild entire file).
- Phase 0 access check: web stack identified; iOS sources later supplied as `Project Planner.zip`.
- Saved both source docs under `docs/ios-parity/`.
- Wrote discovery docs `00`–`05` and `PROGRESS.md`.
- **Gate 1 follow-up (this revision):** recorded Q1–Q10; disk inventory of 210 Swift files; setup-URL investigation; `/setup-password.html?token=` rewrite; **Skills removed from the web app** (nav, page, setup step). iOS was not edited.

**Files created/changed (Phase 1 docs):**
- `docs/ios-parity/IOS_PARITY_REBUILD.md` (copied)
- `docs/ios-parity/IOS_APP_BLUEPRINT.md` (copied)
- `docs/ios-parity/PROGRESS.md`
- `docs/ios-parity/00-ios-inventory.md`
- `docs/ios-parity/00-ios-inventory-disk.md` (210-file `wc -l` table)
- `docs/ios-parity/01-data-model.md`
- `docs/ios-parity/02-navigation-map.md`
- `docs/ios-parity/03-design-system.md`
- `docs/ios-parity/04-business-logic.md`
- `docs/ios-parity/05-web-gap-analysis.md`
- `docs/ios-parity/STOP-GATE-1.md` (this file)
- `docs/ios-parity/sections/` and `screenshots/` directories (empty, ready)

**Evidence coverage:** **210 of 210** Swift files catalogued from the attached zip (`00-ios-inventory-disk.md`). Extract is read-only at `/home/ubuntu/ios-readonly/Project Planner` and is **not in git**. No `.xcodeproj` in the zip.

**Parity table:** (discovery + Gate 1 follow-up)

| iOS element | Web implementation | Status | Note |
|---|---|---|---|
| Firestore project `project-planner-f986c` | `.firebaserc` + env | ⚠️ | Confirm runtime env |
| Hand-written dictionary writes | `lib/firebase/*Payload.ts` + stores | ⚠️ | Enum/ID mismatches; Q3/Q9/Q10 decided for Phase 2 |
| Live listeners | none | ❌ | |
| Main Menu catalogue | `dashboardNavigation.ts` | ⚠️ | Skills **removed** (Q5) |
| LoginBrand | `app/login/page.tsx` | ⚠️ | Light split vs dark navy |
| iOS Home | `/dashboard` + `/dashboard/edit` | ⚠️ | Web-only layout editor (D1 still open) |
| Invite password URL | rewrite `/setup-password.html` → `/setup-password`; accepts `token` or `invitation` | ✅ Q2 | Live Netlify 404s until this deploy; Firebase Hosting still serves a **stale** HTML page |
| Org setup URL from iOS | iOS opens Firebase Hosting `/setup` | ❌ | Must be `https://www.projectplanner.us/setup` — **iOS change required** |
| Skills UI | deleted; `/dashboard/skills` redirects Home | ✅ Q5 | Flag still written `false`; operative `skills[]` preserved on save |
| Deadlines tile | — | ❌ | in scope (Q8) |
| Active users tile | — | ❌ | in scope (Q8) |
| Notifications inbox | prefs only | ❌ | in scope (Q8) |
| Privacy gate | — | ❌ | in scope (Q8) |

**Deviations and why:** Gate 1 follow-up removed Skills to match iOS (deprecated). Invite links now target `/setup-password.html?token=` so iOS emails keep working once they hit this Next app. Known **existing** web write bugs Phase 2 must fix: lowercase booking statuses, `selfEmployed`, `manager: 'Project Manager'`, writing project `notes`, no `onSnapshot`.

---

## Q1–Q10 answers (Farnie, 16 Sep 2026)

| Q | Answer |
|---|---|
| **Q1** How should later phases read Swift? | Attached **Project Planner.zip** (app folder, 210 Swift files). Extract read-only; do not commit. Prefer adding the Xcode folder or an iOS GitHub repo to the Cloud Agent environment on future runs (zip is not in the environment snapshot). **No `.xcodeproj` in the zip.** |
| **Q2** Keep `/setup-password.html?token=`? | **Yes.** Next rewrite `/setup-password.html` → `/setup-password`. Page accepts `token` **or** `invitation`. Org setup stays **web-only** (pay + wizard). Invited users set password on the web, then log into iOS. Web invite emails now emit `/setup-password.html?token=`. |
| **Q3** Booking status `Confirmed` vs `confirmed`? | Write **iOS Title-Case** (`Confirmed` / `Tentative` / `Cancelled` / `Completed`). |
| **Q4** Map + geocoding? | **Leaflet + Google Geocoding**; paid raster tiles in production; **skip MapKit JS**. |
| **Q5** Skills in the sidebar? | **Remove Skills from the web app** (not keep-the-page). Matches iOS deprecation. |
| **Q6** Zod in Phase 2? | **Yes.** |
| **Q7** Heroicons vs lucide-react? | **Heroicons** (`@heroicons/react` already installed). Do not add Lucide. |
| **Q8** Sections 14–16 and 21–24 in scope? | **Yes.** |
| **Q9** `self_employed` vs `selfEmployed`? | **Write `self_employed`; read both** during a transition. |
| **Q10** New jobs `manager` field? | Write **`Custom`**, not `Project Manager`. |

### Setup URL investigation (Q2)

iOS login “Set up your organisation on the web” calls `AppBranding.openOrganisationSetup()` → **`https://project-planner-f986c.web.app/setup`**.

| URL | What it actually is (checked 16 Sep 2026) |
|---|---|
| `https://project-planner-f986c.web.app/setup` | Firebase Hosting **200**. Stale **marketing landing** (`<title>Project Planner - Construction Project Management</title>`, last-modified **7 May 2026**). Not the Stripe wizard. |
| `https://www.projectplanner.us/setup` | Netlify **301** → `https://projectplanner.us/setup`. |
| `https://projectplanner.us/setup` | Netlify + Next **200**. **This is the real org-setup wizard.** |
| `https://project-planner-f986c.web.app/setup-password.html?token=` | Firebase Hosting **200**. Stale static password page (May 2026). iOS invite emails still point here (`ResendEmailService.setupPasswordBaseURL`, `FirebaseBackend.swift` ~L5096). |
| `https://www.projectplanner.us/setup-password.html` | **404 today** (rewrite not deployed yet). After this PR: Next serves `/setup-password`. |

**This agent cannot edit iOS.** Farnie must change in Xcode:

1. `AppBranding.webAppBaseURL` → `https://www.projectplanner.us` (so login opens `/setup` on the real site).
2. `ResendEmailService.setupPasswordBaseURL` (and the `FirebaseBackend.swift` invite HTML) → the same origin, keeping path `/setup-password.html?token=`.

Optional web-side mitigation (Firebase Console → Hosting redirects), **after this PR is live on Netlify**:

- `/setup` → `https://www.projectplanner.us/setup` (301)
- `/setup-password.html` → `https://www.projectplanner.us/setup-password.html` (301)

Do **not** redeploy Firebase Hosting from this repo’s `firebase.json` (it only publishes Firestore rules; a Hosting deploy would wipe the existing static site).

Also set Netlify `NEXT_PUBLIC_APP_URL` to `https://www.projectplanner.us` (or `https://projectplanner.us` to skip the www→apex hop). Invite links from the web app use that env var.

---

## Adjusted Phase 3 build order

Dependencies found in Phase 1 (logic modules before UI). Default rebuild §9 order is still right once foundations exist. Adjusted:

| Order | Work | Why |
|---|---|---|
| Phase 2 | Tokens, shell, permissions, WorkAccess, converters (**Zod**), auth+privacy gate, **iOS Home**, Heroicons | Everything else hangs off this |
| Phase 2 logic | `lib/permissions.ts`, `lib/access/workAccess.ts`, Home metrics / Up Next, payroll time policy (for sorting) | Blueprint §8 Phase 2 items 5–9 |
| 1–2 | Manage Users, Add User | Identity before roster screens |
| 3 | Settings (org hub) | Job types / hours / labels / invoicing defaults |
| 4–8 | Job Types, Qualifications, Wholesalers, Catalogue, Sub Contractors | Reference data (**not Skills**) |
| 9–11 | Clients, Managers, Operatives | People; email-match roster |
| 12–13 | Projects, Small Works | Jobs (`manager: "Custom"`) |
| 14 | Scheduling / My Schedule | needs jobs + people + payroll hours engine |
| 15–16 | Tasks, then job tiles (View, Materials, **Deadlines**, H&S, Location, Active users) | Deadlines feed WorkAccess |
| 17 | Timesheets | payroll engine + invoicing settings |
| 18 | Annual leave | bank holidays + entitlement |
| 19–20 | Site Audit, Site Map | Leaflet + Google Geocoding; paid tiles |
| 21–23 | Warnings, Daily overview, Weekly report | warnings engine + report builder |
| 24 | Notifications, Help, Privacy, Profile | deep links into the rest |

**Q8 confirmed:** rows 14–16 and 21–24 stay in scope.

---

## Proposed route map

Keep the existing **`/dashboard` prefix**. Full table: `02-navigation-map.md` §5.

Must-add: `/dashboard/projects/[id]/deadlines`, `/active-users` (and small-works twins), `/dashboard/notifications`, `/dashboard/privacy`. Must-fix: `/dashboard/schedule` currently redirects to daily overview — My Schedule stays at `/dashboard/my-schedule`. Must-keep: `/login`, `/setup`, `/setup-password` **plus** `/setup-password.html` rewrite. Skills route redirects away.

---

## Proposed dependencies

| Package | Decision |
|---|---|
| **zod** | **Add in Phase 2** (Q6) |
| **@heroicons/react** | **Use this** (already installed) (Q7). Do not add `lucide-react`. |
| Leaflet | Already loaded from unpkg 1.9.4. Optionally add `leaflet` + types so we do not depend on unpkg. Production **paid tiles** (Q4 / D3). |
| Excel writer | Weekly report `.xlsx` — propose in section 23 3A, not now |
| MapKit JS | **Skip** (Q4) |

---

## Blueprint §8 decisions

**Answered via Q4:** D3 (paid tiles) and D4 (Google geocoding, no MapKit JS).

**Still open (Farnie did not override these recommendations):**

**D1. Web-only dashboard.** Keep `/dashboard/edit` + `dashboardLayouts` beside the iOS Home, hide it, or delete the editor once iOS Home ships?  
**Recommendation:** **Hide** the editor from the default Home; keep the collection so existing layouts are not destroyed.

**D2. Warning-dismissal sync.** iOS stores dismissals in UserDefaults; web has `acceptedBookingClashes`. Syncing needs Firestore **and** an iOS change.  
**Recommendation:** **Do not sync** in v1. Document that dismissals are per-platform. Revisit later.

**D5. Web push.** FCM web tokens would join `users.pushTokens` and start receiving the same server pushes.  
**Recommendation:** **Not in Phase 2.** Local iOS reminders stay iOS-only until you ask.

**D6. Offline.** iOS queues writes.  
**Recommendation:** Offline **banner only** on the web (no outbox). Optional Firestore persistent cache later.

**D7. Email path.** iOS HTTP function is unauthenticated. Web uses Resend from Next API routes.  
**Recommendation:** Keep server-side Resend for invites **or** call the Function from Next (never from the browser) with the same JSON body. Do not put Resend keys in the client.

**D8. `holidayBookings` rules** allow any signed-in user, any org (“Temporary”).  
**Recommendation:** Tighten to org members when you are ready; out of scope for Phase 2 unless you approve a rules change.

**D9. Invitations publicly readable** (names + emails).  
**Recommendation:** Leave for now (setup page needs it); later verify tokens in a Function.

**D10. Desktop extras** (⌘K, projects table/grid toggle, New-project shortcuts).  
**Recommendation:** **Do not build** until asked.

---

## Questions (original prompt — now answered)

```text
Q1. IOS_ROOT is not in this Cloud Agent environment (only github.com/farnienel1/project-planner-web).
    How should later phases read Swift? Recommendation: add the Xcode folder to the workspace (or publish/push the iOS app to a GitHub repo and attach it to the Cloud Agent environment).

Q2. Invite emails (iOS) link to /setup-password.html?token= but the web app only has App Router /setup-password.
    Add a rewrite/static html that preserves the iOS URL? Recommendation: yes, keep both.

Q3. Booking status raw values: iOS Confirmed/Tentative/Cancelled/Completed vs web confirmed/pending/cancelled.
    Which should web writes use? Recommendation: the iOS Title-Case values (or records disappear on iPhone).

Q4. Map + geocoding provider for production (Apple MapKit JS vs current Leaflet + Google Geocoding vs other).
    Recommendation: Leaflet + Google Geocoding (already wired); paid OSM-style tiles; skip MapKit JS unless you want identical Apple maps.

Q5. Should Skills stay in the web sidebar? iOS deprecated it and always writes skills: false.
    Recommendation: keep the page (web-only) but remove it from the default Main Menu clone.
    → Farnie: remove Skills from the web app entirely (like iOS).

Q6. Zod in Phase 2? Recommendation: yes.

Q7. Icon library: use existing @heroicons/react, or add lucide-react to match the blueprint table?
    Recommendation: lucide-react if you want the blueprint names; otherwise Heroicons to avoid a new dependency.
    → Farnie: pick one. Agent picked Heroicons (already installed).

Q8. Confirm sections 14–16 and 21–24 (Scheduling, Tasks, job tiles, Warnings, Daily overview, Weekly report, Notifications/Help/Privacy) stay in scope.
    Recommendation: yes — they are real iOS screens.

Q9. employmentType: iOS self_employed vs web selfEmployed. Recommendation: write self_employed; read both during a transition.

Q10. New jobs: write manager: "Custom" (iOS) not "Project Manager" (web today)? Recommendation: Custom.
```

**Suggestions (not built):**
- Command palette and keyboard shortcuts (desktop extras).
- Authenticate `sendProjectPlannerEmail`.
- Move invitation lookup off public reads.
- Firestore persistent cache.
- Tighten `holidayBookings` rules.
- Dedicated iOS GitHub repo so future Cloud Agent runs see Swift without re-uploading a zip.
- Firebase Hosting 301s from `/setup` and `/setup-password.html` to `www.projectplanner.us` (until iOS URLs change).

**Next step:** Phase 2 (foundations: tokens, shell, Zod converters, auth+privacy gate, iOS Home) is unblocked on Q1–Q10. Confirm D1/D2/D5–D10 if you want those recommendations locked. Do not start section UIs yet.

# ⏸ STOP GATE: Phase 1 (discovery)

**Done:**
- Read `IOS_PARITY_REBUILD.md` and `IOS_APP_BLUEPRINT.md` in full (blueprint in chunks; rebuild entire file).
- Phase 0 access check: web stack identified; **IOS_ROOT is not on this Cloud Agent VM**.
- Saved both source docs under `docs/ios-parity/`.
- Wrote discovery docs `00`–`05` and `PROGRESS.md`.
- No application code changed.

**Files created/changed:**
- `docs/ios-parity/IOS_PARITY_REBUILD.md` (copied)
- `docs/ios-parity/IOS_APP_BLUEPRINT.md` (copied)
- `docs/ios-parity/PROGRESS.md`
- `docs/ios-parity/00-ios-inventory.md`
- `docs/ios-parity/01-data-model.md`
- `docs/ios-parity/02-navigation-map.md`
- `docs/ios-parity/03-design-system.md`
- `docs/ios-parity/04-business-logic.md`
- `docs/ios-parity/05-web-gap-analysis.md`
- `docs/ios-parity/STOP-GATE-1.md` (this file)
- `docs/ios-parity/sections/` and `screenshots/` directories (empty, ready)

**Evidence coverage:** **0 of 210** Swift files opened on disk (IOS_ROOT missing). Blueprint cites ~155 named Swift files and claims 210 / ~115k lines. All `File.swift:line` citations in Phase 1 docs are **from the blueprint**, ❓ UNVERIFIED against the live tree.

**Parity table:** (discovery only — no web implementation this phase)

| iOS element | Web implementation | Status | Note |
|---|---|---|---|
| Firestore project `project-planner-f986c` | `.firebaserc` + env | ⚠️ | Confirm runtime env |
| Hand-written dictionary writes | `lib/firebase/*Payload.ts` + stores | ⚠️ | Enum/ID mismatches |
| Live listeners | none | ❌ | |
| Main Menu catalogue | `dashboardNavigation.ts` | ⚠️ | Extra Skills; missing some gates |
| LoginBrand | `app/login/page.tsx` | ⚠️ | Light split vs dark navy |
| iOS Home | `/dashboard` + `/dashboard/edit` | ⚠️ | Web-only layout editor |
| Deadlines tile | — | ❌ | |
| Active users tile | — | ❌ | |
| Notifications inbox | prefs only | ❌ | |
| Privacy gate | — | ❌ | |

**Deviations and why:** None introduced — docs only. Known **existing** web deviations that Phase 2 must not copy: lowercase booking statuses, `selfEmployed`, `manager: 'Project Manager'`, writing project `notes`, no `onSnapshot`, Resend instead of `sendProjectPlannerEmail`, `/setup-password` vs `.html`.

**Blocked / needs Farnie:**
1. **Add the iOS project to this workspace** so later phases can open Swift. Cloud Agent environment only contains `github.com/farnienel1/project-planner-web`. Steps: *File → Add Folder to Workspace…* → `/Users/farnienel/Desktop/Project Planner` (or the app folder that contains `ContentView.swift`); save the workspace; if Desktop is iCloud, download fully. A GitHub iOS repo would also work if you want Cloud Agents to see it.
2. Confirm Firebase web app registration + `.env.local` (`PROJECT_ID`, storage bucket hostname).
3. Locate `storage.rules` (not in web repo, not in iOS folder per blueprint).
4. Auth authorized domains for the hosted origin(s).
5. iOS screenshots into `docs/ios-parity/screenshots/<section>/` when we reach 3A.

---

## Adjusted Phase 3 build order

Dependencies found in Phase 1 (logic modules before UI). Default rebuild §9 order is still right once foundations exist. Adjusted:

| Order | Work | Why |
|---|---|---|
| Phase 2 | Tokens, shell, permissions, WorkAccess, converters, auth+privacy gate, **iOS Home** | Everything else hangs off this |
| Phase 2 logic | `lib/permissions.ts`, `lib/access/workAccess.ts`, Home metrics / Up Next, payroll time policy (for sorting) | Blueprint §8 Phase 2 items 5–9 |
| 1–2 | Manage Users, Add User | Identity before roster screens |
| 3 | Settings (org hub) | Job types / hours / labels / invoicing defaults |
| 4–8 | Job Types, Qualifications, Wholesalers, Catalogue, Sub Contractors | Reference data |
| 9–11 | Clients, Managers, Operatives | People; email-match roster |
| 12–13 | Projects, Small Works | Jobs |
| 14 | Scheduling / My Schedule | needs jobs + people + payroll hours engine |
| 15–16 | Tasks, then job tiles (View, Materials, **Deadlines**, H&S, Location, Active users) | Deadlines feed WorkAccess |
| 17 | Timesheets | payroll engine + invoicing settings |
| 18 | Annual leave | bank holidays + entitlement |
| 19–20 | Site Audit, Site Map | geocoder decision |
| 21–23 | Warnings, Daily overview, Weekly report | warnings engine + report builder |
| 24 | Notifications, Help, Privacy, Profile | deep links into the rest |

Confirm: rows 14–16 and 21–24 are **in scope** (they exist in iOS) unless you say otherwise.

---

## Proposed route map

Keep the existing **`/dashboard` prefix**. Full table: `02-navigation-map.md` §5.

Must-add: `/dashboard/projects/[id]/deadlines`, `/active-users` (and small-works twins), `/dashboard/notifications`, `/dashboard/privacy`. Must-fix: `/dashboard/schedule` currently redirects to daily overview — My Schedule stays at `/dashboard/my-schedule`. Must-keep: `/login`, `/setup`, `/setup-password` **plus** a `/setup-password.html` rewrite for iOS invite emails.

---

## Proposed dependencies (none installed)

| Package | Why | Ask |
|---|---|---|
| **zod** | Rebuild §5: converters + block invalid writes. Not installed. | **Add** in Phase 2 |
| **lucide-react** | Blueprint icon names. `@heroicons/react` is already installed but unused. | Prefer **use Heroicons we already have**, or add Lucide if you want the suggested names. Do not add both. |
| Leaflet | Already loaded from unpkg 1.9.4; not an npm dep | Optionally add `leaflet` + types so we do not depend on unpkg CDN |
| Excel writer | Weekly report `.xlsx` (`WeeklyReportExportBuilder`) | Propose a library in section 23 3A — **not now** |
| MapKit JS | Blueprint alternative for identical Apple look | Needs a MapKit JS token — see Q4 |

No other packages required for Phase 2.

---

## Blueprint §8 decisions (please answer)

**D1. Web-only dashboard.** Keep `/dashboard/edit` + `dashboardLayouts` beside the iOS Home, hide it, or delete the editor once iOS Home ships?  
**Recommendation:** **Hide** the editor from the default Home; keep the collection so existing layouts are not destroyed.

**D2. Warning-dismissal sync.** iOS stores dismissals in UserDefaults; web has `acceptedBookingClashes`. Syncing needs Firestore **and** an iOS change.  
**Recommendation:** **Do not sync** in v1. Document that dismissals are per-platform. Revisit later.

**D3. Map tiles.** OSM public tiles are not for production.  
**Recommendation:** Keep Leaflet; switch raster tiles to a named provider you pay for (or MapTiler/Stadia). Do not keep hammering `tile.openstreetmap.org` in production.

**D4. Geocoding.** iOS = Apple geocoder + cache. Web already has Google Geocoding via `/api/geocode` + Nominatim fallback.  
**Recommendation:** **Keep Google** for the web (key already in env example). Do not add MapKit JS unless you want pixel-identical Apple maps.

**D5. Web push.** FCM web tokens would join `users.pushTokens` and start receiving the same server pushes.  
**Recommendation:** **Not in Phase 2.** Local iOS reminders (cut-off, quals, deadlines) stay iOS-only until you ask.

**D6. Offline.** iOS queues writes.  
**Recommendation:** Offline **banner only** on the web (no outbox). Optional Firestore persistent cache later.

**D7. Email path.** iOS HTTP function is unauthenticated. Web uses Resend from Next API routes.  
**Recommendation:** Keep server-side Resend for invites **or** call the Function from Next (never from the browser) with the same JSON body. Do not put Resend keys in the client. Consider authenticating the Function later (needs iOS change).

**D8. `holidayBookings` rules** allow any signed-in user, any org (“Temporary”).  
**Recommendation:** Tighten to org members when you are ready; out of scope for Phase 2 unless you approve a rules change.

**D9. Invitations publicly readable** (names + emails).  
**Recommendation:** Leave for now (setup page needs it); later verify tokens in a Function.

**D10. Desktop extras** (⌘K, projects table/grid toggle, New-project shortcuts).  
**Recommendation:** **Do not build** until asked.

---

## Questions

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

Q6. Zod in Phase 2? Recommendation: yes.

Q7. Icon library: use existing @heroicons/react, or add lucide-react to match the blueprint table?
    Recommendation: lucide-react if you want the blueprint names; otherwise Heroicons to avoid a new dependency.

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
- Dedicated iOS GitHub repo so Cloud Agents can inventory the 210 files.

**Next step:** Wait for Farnie’s go-ahead on Gate 1 (especially Q1–Q10 and D1–D10). Phase 2 (foundations, no section UIs yet beyond shell + Home) starts only after that. If IOS_ROOT is added, the first follow-up should re-run the Swift file count and patch `00-ios-inventory.md` to 210/210 before writing converters.

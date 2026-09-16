# ⏸ STOP GATE: Phase 2 (Foundations)

**Done:**
- Zod converters/validators for users, bookings, manager site bookings, projects/small works, tasks, holidays, clients, operatives, managers, notifications. Parse skips invalid docs; writes use iOS keys (Title-Case booking status, `self_employed`, `manager: "Custom"`, uppercase UUIDs, no project `notes`).
- `lib/permissions.ts` + `lib/access/workAccess.ts` with unit tests (operative-first; `canViewProjects` always true; `canViewWeeklyReports` is the flag).
- Auth: LoginBrand + iOS reset-password copy, placeholder-user merge on first sign-in, `policyAccepted` gate, `passwordSet` repair, throttled `lastSeenAt`, session splash.
- Desktop AppShell = Main Menu sidebar + top bar (+ New, refresh, bell, avatar) + offline/role-preview banners + mobile bottom bar. Privacy in account nav. D1: Home is iOS Home, not the dashboard editor.
- iOS Home: greeting, overview hero (admin metric customisation), Warnings/Tasks tiles, quick actions customise/add/remove, Up Next (live payroll policy), Maintenance card, task-limit banner. `/dashboard/edit` kept as web-only, not linked from Home.
- Live `onSnapshot` for `bookings`, `managerSiteBookings`, notifications inbox. Dev-only `/dashboard/data-health` (read sample, never writes).
- 22 unit tests passing. `tsc --noEmit` clean. `next build` pass. Browser: LoginBrand at 1440/1280/1024/390; reset-password wording; signed-out `/dashboard` → `/login`. Signed-in Home not exercised (no test account).

**Files created/changed:**
- New: `lib/ios-parity/*`, `lib/permissions.ts`, `lib/access/workAccess.ts`, `lib/home/*`, `lib/payroll/policyCatalog.ts`, `lib/firebase/mergePlaceholderUser.ts`, `lib/firebase/subscribeOrgCollection.ts`, `lib/stores/notificationStore.ts`, `components/auth/*`, `components/home/HomeScreen.tsx`, `components/shell/AppShell.tsx`, `components/ios/*`, `app/dashboard/notifications/page.tsx`, `app/dashboard/privacy/page.tsx`, `app/dashboard/data-health/page.tsx`, `.eslintrc.json`, `docs/ios-parity/STOP-GATE-2.md`
- Wired: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/login/page.tsx`, `app/reset-password/page.tsx`, `lib/stores/authStore.ts`, `lib/stores/bookingStore.ts`, `lib/stores/managerScheduleStore.ts`, `lib/firebase/parseUser.ts`, `lib/navigation/dashboardNavigation.ts`, tokens in `tailwind.config.js` / `app/globals.css`

**Evidence coverage:** Swift read this phase (not re-read all 210): `AuthenticationView.swift`, `PasswordResetView.swift`, `Views/PrivacyPolicyView.swift` / `PolicyAcceptanceView.swift` (via existing policy copy), `Views/NotificationsView.swift`, `Models/NotificationModel.swift`, `FirebaseBackend.swift` `mergePlaceholderUserDocOntoAuthUidIfNeeded` ~L3319 and `parseAppUserDocument` ~L3349, `Core/UserStore.swift` lastSeen + passwordSet, `Views/HomeView.swift` / `HomeQuickActionRegistry.swift` / `HomeUpNextSupport.swift` / `HomeOverviewCustomization.swift`, `Core/PayrollTimePolicyCatalog.swift`, `Navigation/MainMenuCatalog.swift`, `Views/OfflineStatusBanner.swift`, `ContentView.swift`. Plus Phase 1 docs `01`–`05`.

**Parity table:**

| iOS element (File.swift:line) | Web implementation (file) | Status | Note |
|---|---|---|---|
| LoginBrand (`AuthenticationView.swift`) | `/login` | ⚠️ | Phone (`lg` and below): iOS dark LoginBrand. Desktop: website sign-in with marketing chrome. Public landing is `/`. |
| PasswordResetView.swift | `app/reset-password/page.tsx` | ✅ | Same wording |
| Placeholder merge (`FirebaseBackend.swift`:3319) | `lib/firebase/mergePlaceholderUser.ts` | ✅ | Copy onto Auth UID; `passwordSet: true` |
| Policy gate (`policyAccepted == false`) | `PolicyGate` in dashboard layout | ✅ | Writes `policyAccepted` + `policyAcceptedAt` |
| lastSeenAt throttle 120s (`UserStore.swift`:53) | `authStore.recordLastSeenIfDue` | ✅ | Foreground / visibility |
| Main Menu catalogue | `AppShell` + `dashboardNavigation.ts` | ⚠️ | Extra desktop rows: Daily overview, Weekly report, Warnings, Tasks, My Schedule |
| Home (`HomeView.swift`) | `components/home/HomeScreen.tsx` | ✅ | Editor hidden (D1 recommendation) |
| Live bookings / managerSiteBookings / notifications | stores + `subscribeOrgCollection.ts` | ✅ | Org doc + materials still one-off (later sections) |
| Booking status Title-Case | `serializeBooking` / `parseBooking` | ✅ | Aliases `confirmed`/`pending` on read |
| Zod (Q6) | `lib/ios-parity/schemas.ts` | ✅ | Write validation throws |
| Heroicons (Q7) | shell / Home / login | ✅ | No lucide |
| Data health page | `/dashboard/data-health` | ✅ | Dev-only; never writes |
| `/dashboard/edit` | still exists | ⚠️ | Web-only; not on Home (D1) |

**Deviations and why:**
- Sidebar keeps extra operational routes iOS Home-only surfaces, because desktop needs a persistent nav (Phase 1 desktop note). Labels still match iOS.
- Nav row glyphs currently share `FolderIcon`; chip tint matches the catalogue. Per-item Heroicons can land with section polish.
- Shared primitives are the subset Home/shell need (card, chip, pill, empty state, modal shell), not every Blueprint §4.5 control.
- Remaining collections (materials, site audits, timesheets, …) get full converters when those sections are rebuilt.
- `next lint` is gone in Next 16; script now runs `eslint` with `eslint-config-next`.

**Blocked / needs Farnie:**
1. Which **test organisation / account** should agents use for write tests? (required before Phase 3 writes)
2. Confirm runtime Firebase web app + Storage bucket `.firebasestorage.app` vs `.appspot.com` on Netlify.
3. Confirm `.env.local` / Netlify env matches `project-planner-f986c`.
4. D1–D2, D5–D10 still recommendations unless you lock them.

**Questions:**
```text
Q11. Which organisation (and user emails) should Cloud Agents use for write tests?
    Recommendation: a disposable sandbox org, never production jobs.
```

**Suggestions (not built):**
- Per-item sidebar icons and subtitles under each Main Menu row.
- Live organisation document listener (settings/labels) — currently one-off at login.
- Drag-and-drop Home quick-action reorder (iOS hint says “Drag”; web uses customise + add/remove).

**Next step:** Phase 3 section 1 — Manage Users (spec `docs/ios-parity/sections/01-manage-users.md`, then build). Wait for a test org before any write verification on device.

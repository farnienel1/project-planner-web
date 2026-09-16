# 05 — Web gap analysis

> Spec: rebuild Phase 1 `05-web-gap-analysis.md`. iOS column = blueprint + attached zip. Web column = this repo as of 16 Sep 2026. Gate 1 Q1–Q10 answered (see `STOP-GATE-1.md`).

Legend: ✅ exists and is directionally the same · ⚠️ exists but diverges · ❌ missing · 🟦 web-only (keep until Farnie decides)

## 1. Platform / foundations

| Area | Web | vs iOS | Reuse or rewrite |
|---|---|---|---|
| Stack | Next 16 App Router, TS, Tailwind, Zustand, Firebase JS 10 | n/a | **Keep stack** (rebuild ground rule 7) |
| Firebase project | `.firebaserc` `project-planner-f986c`; env vars | same id | Verify `.env.local` in Phase 2 |
| Storage bucket env | example `…appspot.com` | `…firebasestorage.app` | Fix env; don’t hardcode |
| Auth methods | email/password | same | Reuse `authStore`; add placeholder merge + policy gate |
| Live listeners | **none** (`getDocs` only) | org, bookings, managerSiteBookings, materials, notifications live | Rewrite store subscriptions |
| Converters | hand-rolled payloads | hand-rolled dictionaries | Rewrite with validators; several enums/keys wrong (see 01) |
| Zod | not installed | n/a | **Add in Phase 2 (Q6)** |
| Design tokens | Tailwind default blue | `#185FA5` system | New tokens in Phase 2 |
| Icons | inline SVG; unused Heroicons | SF Symbols | **Use Heroicons (Q7); do not add Lucide** |
| Tests | none | Swift tests unknown | Add with logic ports |
| `storage.rules` | missing | missing from iOS folder too | Farnie locate |
| Cloud Function email | unused | `sendProjectPlannerEmail` | Decide Resend vs Function |
| App Check | off | off | OK |

## 2. Shell, auth, Home

| iOS | Web | Status | Notes |
|---|---|---|---|
| Splash logo 120px | spinner only | ❌ | |
| Dark LoginBrand screen | Light split marketing login (`app/login/page.tsx`) | ⚠️ | Drifted from “keep identical” |
| Reset password sheet copy | `/reset-password` | ⚠️ | Compare wording in 3A |
| Placeholder user merge | `completeInviteSetup.ts` | ⚠️ | Must match ~L3319 |
| Privacy-policy gate | none | ❌ | |
| Custom bottom bar + More | Desktop sidebar only; no &lt;768 bottom bar | ⚠️ | Sidebar content ≠ Main Menu |
| Offline banner | `AppTopNotice`? not iOS copy | ⚠️ | No outbox (ask) |
| Role preview | none | ❌ | |
| Booking toast | none | ❌ | |
| Home: overview hero (3 metrics, gear) | Customisable dashboard tiles `/dashboard/edit` | 🟦 / ⚠️ | iOS Home is not this |
| Quick actions registry | nav-derived quick actions | ⚠️ | Different ids; no iOS customise/hint keys |
| Up Next | not the iOS booking list | ❌/⚠️ | |
| Maintenance card | none | ❌ | |
| Task-limit banner | none | ❌ | |
| Bell inbox | no `/notifications`; prefs in settings only | ❌ inbox | |

## 3. Section-by-section

| Section | Exists | Matches iOS | Deviates | Missing | Reuse? |
|---|---|---|---|---|---|
| **Manage Users** | `/dashboard/settings/users`, `ManageUsersScreen`, `EditUserProfile` | Role/status idea | Nav hidden from managers-with-operatives; employmentType `selfEmployed`; extra `permissions` map | Some confirm copy, Make Super Admin ❓, holiday report | Rewrite profile payload; reuse page shell |
| **Add User** | `/settings/users/new` | Invitation + placeholder pattern | Employment enum; email via Resend not Function; link `/setup-password` vs `.html`; manager 3-step ❓ | Exact permission toggle copy | Reuse wizard structure |
| **Settings** | `SettingsScreen` + org panels | Many panels exist | No nested routes; Appearance ❓; Privacy row dead; developer tools correctly absent | Privacy page, iOS appearance/accent | Reuse panels; restyle to SettingsHubChrome |
| **Job Types** | `/job-types` | `settings/jobTypes` | overwrite vs merge ❓ | Exact empty copy | Reuse store |
| **Qualifications** | `/qualifications`, `/my-qualifications` | templates + roster fields | access policy likely looser | 30-day badge, cert 10MB PDF/JPEG rules | Reuse catalogue; port policy |
| **Wholesalers** | `/wholesalers` | CRUD | history permission flag ❓ | Exact cards/history filters | Reuse store |
| **Material catalogue** | `/materials` | collection | CSV / duplicate ❓ | CSV 3-step flow | Extend store |
| **Sub contractors** | `/sub-contractors` | CRUD | `canManageSubcontractors` ignores flag | “Names only · no logins” copy | Reuse |
| **Clients** | `/clients` | fields | master–detail ❓; embedded client on jobs | Exact empty/delete copy | Reuse `projectStore` clients |
| **Managers** | `/managers` | roster + user list mixed ❓ | iOS list is **accounts with manager flag**, create form writes **roster** | Pending/active/inactive segments copy | Careful rewrite |
| **Operatives** | `/operatives` | roster + accounts | two-layer matching by email ❓ complete | Finish setup, filter sheet copy | Rewrite list to match segments |
| **Projects** | list/new/hub + children | collections, many tiles | `manager: 'Project Manager'`; writes `notes`; no live data; operatives hidden from nav; status maybe stored in TS (`status?` on type) | Deadlines tile, Active users tile | Reuse routes; rewrite payload + hub layout |
| **Small Works** | parallel routes | `smallWorks` + `jobType` | same payload bugs | Pin colour on map | Same as projects |
| **Scheduling / My Schedule** | project schedule + `/my-schedule` | bookings collections | `/dashboard/schedule` redirects to daily overview; booking **status lowercase**; `addDoc` vs uppercase UUID `setDoc`; one-off fetch | Clash ack copy; calendar export completeness | Rewrite IDs/enums/listeners; reuse calendar UI as reference |
| **Tasks** | `/tasks` + project tasks | fields partial | missing checklist/attachments/site-audit attach ❓ | Holiday approval cards, qualification reminders | Extend `taskStore` |
| **Job tiles** | view, materials, H&S, location, site-audit, schedule | | H&S in `settings/` vs nested collection ❓ | **Deadlines**, **Active users** | Add two routes |
| **Timesheets** | `/timesheets` | settings docs idea | access = all operatives, not PAYE policy; payroll engine not Swift | Sign-off, invoice PDF parity | Rewrite engine first |
| **Annual leave** | `/annual-leave` + operatives | `holidayBookings` | rules wide open (same as iOS); Nager via ❓ | Exact calendar decorations | Reuse + port `AnnualLeavePolicy` |
| **Site audit** | hub + new + per job | `siteAudits` | photo pipeline ❓ | PDF builder parity | Extend |
| **Site map** | Leaflet + geocode API | live jobs + pins | Google geocoder vs Apple; OSM via Leaflet | Pin info card day nav | Keep Leaflet; confirm provider |
| **Warnings** | `/warnings` | clashes / unbooked / materials | `acceptedBookingClashes` vs UserDefaults; gate not admin-only | Manual-scan-only behaviour, dismiss copy | Rewrite computation from Swift |
| **Daily overview** | `/daily-overview` | org bookings | | Unbooked labour + AL column layout | Reuse as starting point |
| **Weekly report** | `/weekly-report` | | Generate xlsx/pdf ❓ vs iOS builder | Exact branded header | Port builder |
| **Notifications** | prefs only | inbox collection in rules | | Inbox UI, deep links, unread badge | New |
| **Help** | `/help` | | copy ❓ | Category/step structure | Replace copy from Swift |
| **Privacy / Profile** | profile in settings | | Privacy dead | Gate + `/privacy` | New |
| **Skills** | removed | deprecated on iOS | page/nav/setup step deleted; `/dashboard/skills` → `/dashboard` | — | **removed (Q5)** |

## 4. Data compatibility landmines (web writes that can make iOS skip rows)

These are the “records disappear on iOS” class (rebuild §5):

| Write | Web today | iOS parser expects | Risk |
|---|---|---|---|
| Booking `status` | `'confirmed'` default (`bookingStore`, `TimeSlot` enum in `types/index.ts`) | `'Confirmed'` | **Skip booking.** **Q3:** Phase 2 writes Title-Case. |
| Booking id | `addDoc` auto-id (likely lowercase) | uppercase UUID + `id` field | mismatch / skip |
| `employmentType` | `selfEmployed` | `self_employed` | silent default. **Q9:** write `self_employed`; read both. |
| Material `requestType` | `quote` / `order` | `Quote` / `Order` | fallback / skip |
| Project `manager` | `'Project Manager'` | `'Custom'` on new/edit | wrong legacy field. **Q10:** write `Custom`. |
| Project `notes` | written | not saved by iOS | wiped on iOS save |
| Int fields | JS numbers | `as? Int` | 7.5 breaks Int |
| No snapshot listeners | stale web UI | live iOS | UX not data loss |

`bookingClashUtils.ts` already special-cases both `'confirmed'` and `'Confirmed'` — evidence the web knows it is inconsistent.

## 5. Web-only features (keep)

Do **not** delete these in Phase 2:

1. Stripe subscription + `/setup` wizard (iOS login **should** open `https://www.projectplanner.us/setup`; today it opens stale Firebase Hosting).
2. `/setup/verify-email`, `/success`, `/cancel`.
3. `dashboardLayouts` + `/dashboard/edit` (D1 still open: hide vs keep once iOS Home ships).
4. `platformConfig`.
5. `users/{uid}/orgMemberships`.
6. Resend API invite emails (until Function is used).
7. `/api/geocode` + Google key (**Q4** keep Google).
8. Leaflet loaded from unpkg (works; **Q4** paid tiles in production).
9. Team onboarding prompt.
10. Marketing `/` landing.
11. `acceptedBookingClashes` (web warning dismissals) — **parallel** to iOS UserDefaults; do not assume they sync.
12. `/setup-password.html?token=` rewrite for iOS invite emails (**Q2**).

## 6. What to reuse vs rewrite in Phase 2+

**Reuse (structure, not behaviour):** App Router file layout, dashboard route table, Zustand store **names** mapped onto iOS stores, settings panels’ field lists, Leaflet map container, signature pad component, invite token page, org setup (web-only).

**Rewrite before features:** `lib/permissions.ts` (replace `menuPermissions.ts`), `WorkAccess`, all Firestore converters (`projectPayload`, `userPayload`, booking create), auth boot sequence, design tokens, app shell (sidebar = Main Menu), Home.

**Do not reuse as source of truth:** `types/index.ts` `BookingStatus` / `TimeSlot` (incomplete), `canAccessTimesheets`, project `manager` default, any store that `addDoc`s without uppercase ids.

## 7. Screenshots

`docs/ios-parity/screenshots/<section>/` is empty. Ask Farnie for iOS screenshots per section at 3A time.

## Blueprint corrections (web vs blueprint)

1. Existing `docs/IOS_FIRESTORE_PARITY.md` still lists a **Skills** menu row and `/dashboard/skills`. Gate 1 Q5: Skills is removed on web as on iOS. Flag always written `false`.
2. That older doc used `/dashboard/...` paths; Blueprint §2.3 used unprefixed paths. This gap analysis standardises on **keeping `/dashboard`**.
3. Invite URL `.html` vs App Router — **Q2:** keep both (`token` and `invitation` query params).
4. Blueprint hosted URL `https://project-planner-f986c.web.app` is Firebase Hosting, last deployed ~7 May 2026. Production wizard is `https://projectplanner.us/setup` (`www` 301s there). iOS `AppBranding` still points at Firebase.

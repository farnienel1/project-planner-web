# Project Planner: iOS App Blueprint

> **Add-on to `IOS_PARITY_REBUILD.md`.** This blueprint was built from the real iOS source on 16 September 2026: the `Project Planner` app folder, with 210 Swift files and about 115,000 lines. It covers:
> - how the iOS app is structured and how it flows
> - what it stores in Firebase
> - how it looks
> - how every page must be **upsized for desktop web use**
>
> **Paths** are relative to the iOS **app source folder**: the folder that contains `ContentView.swift`, `FirebaseBackend.swift`, `Core/`, `Models/`, `Navigation/` and `Views/`. It sits inside `IOS_ROOT`. Line numbers (`~L1234`) are approximate. If code has moved, search for the symbol.

## How to use this file (agent)

1. **Start Phase 1 here.** Don't rediscover what this file already covers: spot-check the cited files to verify it, then extend it wherever it says "read in 3A".
2. **Still read the Swift source for each section before building it (Phase 3A).** This file tells you which files to read and what to look for.
3. **The Swift code wins any disagreement** with this file. Log the correction in `PROGRESS.md`.
4. **§3 (desktop-first layout) is a hard requirement from Farnie.** It applies to every page.

---

## 1. The app at a glance

| Item | Value | Source |
|---|---|---|
| Firebase project | `project-planner-f986c` | `GoogleService-Info.plist`, `.firebaserc` |
| Storage bucket | `project-planner-f986c.firebasestorage.app` | `GoogleService-Info.plist` |
| iOS bundle ID | `farnie.Project-Planner` | `GoogleService-Info.plist` |
| Hosted web app (already referenced by iOS) | `https://project-planner-f986c.web.app` | `AppBranding.swift`, `ResendEmailService.swift` |
| Firestore database | `(default)` | `firestore.rules` |
| Firebase services in use | Auth (email and password only), Firestore, Storage, Cloud Messaging (push), and one HTTP Cloud Function for email | `Project_PlannerApp.swift`, `FirebaseBackend.swift`, `ResendEmailService.swift` |
| Not used | App Check, Analytics, Google or Apple sign-in | no usages in the code |
| UI | SwiftUI with a custom shell (no system `TabView`); most secondary areas open as sheets from Home | `ContentView.swift`, `Views/HomeView.swift` |
| State | 12 `ObservableObject` stores injected at the root | `Project_PlannerApp.swift` |
| Firestore mapping | Hand-written dictionaries (no `Codable` / `data(as:)`) | `FirebaseBackend.swift` |
| Locale | Device locale and time zone (UK); Monday-first weeks; `£` default; `en_GB` for payroll and material emails | `Core/MondayFirstCalendarSupport.swift`, `Core/PayrollTimePolicyCatalog.swift` |
| Theme | Light by default. Appearance can be Light, Dark or Match system, and accent can be Blue, Green, Yellow or Pink. Both are stored on the device only. | `Models/AppModels.swift` (`ThemePreference`, `AppColorScheme`), `Core/AppSettingsStore.swift` |

### 1.1 Stores → web state

The iOS root stores are:

- `FirebaseBackend`
- `SmartCacheService`
- `ProjectStore`
- `OperativeStore`
- `BookingStore`
- `ManagerScheduleStore`
- `UserStore`
- `ProjectTaskStore`
- `HolidayStore`
- `SubcontractorStore`
- `AppSettingsStore`
- `NotificationService`

**Web equivalents:**

- **Stores:** create one Zustand store per iOS store, with the same name (`useProjectStore`, `useUserStore`, …) and the same public state and action names where practical.
- **Data layer:** split `FirebaseBackend.swift` into service modules along its `// MARK:` sections (auth, organisation, projects, small works, clients, tasks, storage, operatives, managers, qualifications, users, invitations, bookings, manager site bookings, holidays, materials, site audits, wholesalers, subcontractors, catalogue, email, timesheets, H&S, deadlines). Keep the same function names (`saveProject`, `loadProjects`, `saveBooking`, …).

### 1.2 Boot sequence (mirror it)

1. **Splash.** Show a white screen with the app logo (120px, radius 26, soft shadow) and a spinner until the auth state resolves (`AppBranding.swift` `AppLaunchSplashView`, `ProjectPlannerRootView.swift`).
2. **Signed out:** show the login screen (`AuthenticationView.swift`, §6.0).
3. **Signed in:** load `users/{uid}` (`Core/UserStore.swift` `loadCurrentUser`).
   - If `policyAccepted == false`, show the privacy-policy gate (`Views/PolicyAcceptanceView.swift`). Accepting writes `policyAccepted: true` and `policyAcceptedAt`.
4. **Main shell** (`ContentView.swift`), with the offline banner on top (`Views/OfflineStatusBanner.swift`).
5. **Org data bootstrap**, once the org doc loads (`ProjectPlannerRootView.swift` `PlannerStoreWiring.bootstrapOrgDataIfNeeded`), in this order:
   1. Projects and small works, operatives (plus managers and qualifications) and bookings. Bookings are live.
   2. Manager site bookings (live).
   3. Tasks.
   4. Deferred: holiday bookings, then subcontractors.
   5. Notifications load only when the inbox opens; the unread badge is warmed later.
6. **When the app comes back into focus:**
   - Record `lastSeenAt` (throttled).
   - Reload the profile, because an admin may have changed the user's permissions.
   - Refresh bookings and the manager schedule.

**Web:** use the same order and show skeletons while loading. Never hold up the first Home paint for warnings.

### 1.3 Identity model: organisations, accounts and roster records

- **`users/{authUid}` is the account.**
  - `organizationId` is the **active** organisation, stored as a string.
  - Permission flags are stored **flat at the top level** of the user document (§5.2).
- **`organizations/{orgId}` holds the organisation's membership.**
  - `members` is a map of `{ uid: "admin" | "manager" | "member" }`.
  - `creatorUserId` is the owner, and the only user allowed to be super admin.
- **Users can belong to more than one organisation.**
  - *Settings → Switch organisation* lists the orgs where `members.{uid}` exists or `creatorUserId == uid`.
  - Switching updates `users/{uid}.organizationId` and `role`, and the org's `members` map (`Core/FirebaseBackend+OrganizationMembership.swift`).
- **Trial and lock fields on the org doc:** `isTrial`, `subscriptionStatus`, `billingStatus`, `trialAccessBlocked`, `accessBlocked`, `trialAccessBlockedMessage`, `accessBlockedMessage`. A user can't open a blocked org. A user who belongs to more than one trial org can only use the first one (`Core/OrganizationMembershipSupport.swift`).
- **Roster records are separate from accounts, and are matched to them by email.**
  - Roster records live in `organizations/{orgId}/operatives` and `/managers`, with UUID IDs.
  - An account is matched to its roster record **by email** (lowercased and trimmed), **not by uid**.
  - Visibility, tasks, schedules, timesheets and Up Next all rely on this match (`Core/WorkAccess.swift`, `Views/HomeUpNextSupport.swift`).
- **Invited users start with a placeholder account.**
  - The placeholder is a `users/{random UUID}` doc with `passwordSet: false`.
  - On first sign-in, the app merges it onto `users/{authUid}` and sets `passwordSet: true` (`FirebaseBackend.swift` `mergePlaceholderUserDocOntoAuthUidIfNeeded` ~L3319).
  - The web sign-in must do the same.

### 1.4 Permission model (port exactly)

**Permission flags** (`UserPermissions`, `Models/AppModels.swift` ~L147) and their default when missing from the doc:

| Flag | Default |
|---|---|
| `adminAccess` | false |
| `manager` | false |
| `operatives` | false |
| `skills` | false. Deprecated, and always written as false. |
| `qualifications` | false |
| `materials` | false |
| `projects` | false |
| `smallWorks` | false |
| `operativeMode` | false |
| `annualLeaveSelfBook` | false |
| `weeklyReports` | false |
| `dailyOverview` | **true** |
| `subContractors` | false |
| `siteAudit` | **true** |
| `wholesalersOrderHistory` | **true** |

**Other user fields:**

- `role`: `basic`, `admin`, `manager`, `operative` or `viewer`
- `isSuperAdmin`
- `annualLeaveEnabled` (default true)
- `employmentType`: `paye` or `self_employed`

**Operative-first rule:** a non-admin user whose `operativeMode` is on, or whose `role == "operative"`, is in operative mode. Admins are never in operative mode.

**Helper functions.** Port these into `lib/permissions.ts` with the same names. Source: `Core/UserStore.swift` ~L445–900.

| Function | Rule |
|---|---|
| `hasAdminAccess` | Not operativeMode, **and** any of: isSuperAdmin, adminAccess, `role == admin` |
| `isOperativeMode` | Not admin, **and** either operativeMode or `role == operative` |
| `canManageUsers` | Not operative, and admin |
| `canViewOperatives` | Not operative, **and** either admin or (manager with operatives) |
| `canViewManagers`, `canEditManagers` | Not operative, and admin |
| `canManageMaterialCatalogue`, `canAccessWholesalers` | Not operative, **and** admin or manager |
| `canViewWholesalerOrderHistory` | Not operative, **and** either admin or (manager with wholesalersOrderHistory) |
| `canManageSubcontractors` | Not operative, **and** either admin or (manager with subContractors). True while the profile is still loading. |
| `canManageWorkCatalogue(projects \| smallWorks)` | Not operative, **and** either admin or (manager with the projects or smallWorks flag respectively) |
| `canViewProjects` | Always true. Which jobs the user sees is filtered by §1.5. |
| `canViewSiteAudit` | Operatives: their siteAudit flag. Everyone else: true. |
| `canViewMaterials` | Operatives: their materials flag. Everyone else: true. |
| `canViewWeeklyReports`, `canViewDailyOverview` | Not operative, **and** the weeklyReports or dailyOverview flag respectively |
| `canAccessQualificationsHub`, `canManageOrganisationQualifications` | See `Core/QualificationsAccessPolicy.swift` |
| `isAnnualLeaveFeatureEnabled` | The user's `annualLeaveEnabled` (default true) |
| `canAccessTimesheetsSurface` | Any of: `canAccessMyTimesheets`, `canAccessOperativeTimesheets`, `shouldShowTimesheetsDisabledMessage` (`Core/TimesheetPayrollPolicy.swift`) |
| `canAccessOperativeAnnualLeaveDirectory` | Not operative, **and** either admin or (manager with operatives) |
| `canEditTargetUserPermissions(target)` | Never for the org creator. Admins: yes. Managers with operatives: only when the target is an operative. |
| `canDeleteUser(target)` | Never the creator. Super admin: anyone except themselves. Admin: only non-admin targets. |

**Shared navigation labels.** `navigationLabel(key, fallback)` reads `organizations/{orgId}.settings.uiLabels.navigationLabels`. The keys are:

- `dashboard_home`
- `dashboard_projects`
- `dashboard_small_works`
- `dashboard_operatives`
- `dashboard_managers`
- `dashboard_schedule`
- `dashboard_settings`
- `site_audit`

**The web already shares these labels.** Use them for sidebar, menu and quick-action titles exactly as iOS does. Legacy values "Schedule" and "my schedule" are displayed as "My Schedule".

**Role preview.** Admins can preview the app as Super Admin, Admin, Manager or Operative (`RoleTestingPreset`).
- While previewing, an orange banner shows "Role preview: {role}", the text "Navigation matches this role. Firebase still uses your real account — some actions may fail if your real permissions differ.", and a **Reset** button.
- Only the navigation changes: data access still uses the real account.

### 1.5 Which jobs a user can see (port exactly: `Core/WorkAccess.swift` `visibleWorks`)

- **Operatives** see only jobs that meet at least one of these:
  - their roster operative has a booking on the job that isn't cancelled
  - they're assigned a task on the job
  - they're assigned a deadline on the job (`settings/deadlineAssignments`)

  Jobs whose `hiddenOperativeUserIds` contains their uid are always excluded.
- **Admins** see every job.
- **Managers:**
  1. Remove jobs whose `hiddenManagerUserIds` contains their uid.
  2. If the manager can manage that catalogue (their projects or smallWorks flag is on), they see all remaining jobs.
  3. Otherwise they see only jobs where at least one of these is true:
     - they're an assigned manager, meaning their roster manager (matched by email) is in `managerIds` or `managerId`
     - they have a manager site booking on the job
     - their roster operative has a booking on the job that isn't cancelled

### 1.6 Cross-platform contracts the web must keep working

| Contract | Detail | Source |
|---|---|---|
| Organisation setup page | The iOS login button "Set up your organisation on the web" opens `https://project-planner-f986c.web.app/setup` | `AppBranding.swift` |
| Invite acceptance page | Invite emails link to `/setup-password.html?token={invitationId}`. This existing web page must create the Auth account and set the password. | `FirebaseBackend.swift` `sendInvitationEmail` ~L5071 |
| Email sending | POST to `https://us-central1-project-planner-f986c.cloudfunctions.net/sendProjectPlannerEmail` (JSON body below). **Never put an email API key in the web client.** | `ResendEmailService.swift` ~L238 |
| Login design | The iOS login was built to match the web's `LoginScreen.tsx` / `login.html`. Keep the two identical. | `AuthenticationView.swift` header comment |
| Shared labels | `settings.uiLabels.navigationLabels` | `Models/AppModels.swift` ~L958 |
| Push tokens | FCM tokens are added to `users/{uid}.pushTokens`, with `pushTokenUpdatedAt`. Web push is optional: ask Farnie first. | `FirebaseBackend.swift` ~L4490 |
| Notifications | Docs in `organizations/{orgId}/notifications` drive the inbox and deep links (§2.4) | `Models/NotificationModel.swift` |
| Web-only collections | `dashboardLayouts/{uid}`, `acceptedBookingClashes` and `platformConfig` exist in the rules but aren't used by iOS. **Keep them working; never delete them.** | `firestore.rules` |

The email function's JSON body:

```json
{
  "to": "string",
  "subject": "string",
  "html": "string",
  "cc": "string (optional)",
  "replyTo": "string (optional)",
  "fromName": "string (optional)",
  "attachments": [
    { "filename": "string", "content": "base64 string", "type": "application/pdf", "content_type": "application/pdf" }
  ]
}
```

`attachments` is optional.

---

## 2. Navigation and app shell

### 2.1 iOS shell (`ContentView.swift`)

- **No system tab bar.** Instead there's a custom bottom bar: rounded (radius 18) translucent rows with a soft shadow along the top edge.
- **Primary row:**
  - **Home**, which is fixed.
  - Up to three movable tabs. The defaults are Projects, Small Works and Manage Operatives.
  - **More**, which opens `Views/MainMenuMoreSheet.swift`.
- **Movable secondary tabs** (default order): Annual Leave, Managers, Wholesalers, Sub Contractors, Settings, Help. Operatives only get Annual Leave and Settings.
- **"Edit main menu bar":**
  - Icons jiggle and can be dragged to reorder.
  - The order is saved per user on the device, under `bottomBarMovableTabOrder.{uid}`.
- **Detail screens hide the bottom bar.**
- **Booking toast:** booking events show a green toast that slides in from the top for 3 seconds (`calendar.badge.plus` icon).
- **Tab numbers and when each tab is visible:**

| Tag | Tab | Screen | Visible when |
|---|---|---|---|
| 0 | Home | `HomeView` | Always |
| 1 | Projects | `ProjectsView` | Always (job list filtered per §1.5) |
| 2 | Small Works | `SmallWorksView` | Always |
| 3 | Manage Operatives | `OperativesView` | `canViewOperatives` |
| 4 | Managers | `ManagersView` | `hasAdminAccess` |
| 5 | Settings | `SettingsView` | Always |
| 6 | Help | `HelpView` | Not operative |
| 7 | Wholesalers | `WholesalersView` | `canAccessWholesalers` |
| 8 | Annual Leave | `HolidayView` | `isAnnualLeaveFeatureEnabled` |
| 9 | Sub Contractors | `SubcontractorsView` | `canManageSubcontractors` |

### 2.2 Main Menu and More (`Navigation/MainMenuCatalog.swift`, `Views/QuickMenuSheet.swift`, `Views/MainMenuMoreSheet.swift`)

A single catalogue drives both the Main Menu (opened from Home) and the More sheet. The Main Menu is laid out as follows:

1. **Header:** "Main Menu" (22pt) and a blue **Done** capsule.
2. **Quick create card:**
   - Blue gradient background, with the text "Quick create" and "Start something new".
   - Pill buttons:
     - **Project**, shown if the user can manage projects
     - **Small work**, shown if the user can manage small works
     - **User**, shown if the user can manage users
     - **Task**, always shown
3. **Grouped white cards**, one per section:

| Section | Row id → title (subtitle or badge) | Shown when | Action |
|---|---|---|---|
| (top card) | `edit_tab_bar` → "Edit main menu bar" ("Icons jiggle — drag onto a slot in the bar below to reorder.") | Not operative | Reorder bar |
| Navigate | `clients` → "Clients" ("{n} on file") | Not operative | Clients |
| Navigate | `projects` → "Projects" ("{n} in progress") | Always | Tab 1 |
| Navigate | `small_works` → "Small works" ("{n} open") | Always | Tab 2 |
| Navigate | `operatives` → "Operatives" ("{n} team members") | `canViewOperatives` | Tab 3 |
| Navigate | `managers` → "Managers" ("{n} active") | `canViewManagers` | Tab 4 |
| Navigate | `holiday` → "Annual Leave" | Annual leave enabled | Tab 8 |
| Navigate | `site_map` → "Site map" | Admin | Site map |
| Navigate | `site_audit` → "Site audit" | `canViewSiteAudit` | Site audit |
| Navigate | `invoicing` → "Timesheets" ("My timesheets and operative sign-off") | `canAccessTimesheetsSurface` | Timesheets |
| Tools | `qualifications` → "Qualifications" (badge "{n} expiring": expiry within 30 days) | `canAccessQualificationsHub` | Qualifications |
| Tools | `my_qualifications` → "My qualifications" | Operative | My qualifications |
| Tools | `job_types` → "Job types" | Admin | Job types |
| Tools | `wholesalers` → "Wholesalers" | `canAccessWholesalers` | Wholesalers |
| Tools | `material_catalogue` → "Material catalogue" ("Organisation materials library") | `canManageMaterialCatalogue` | Catalogue |
| Tools | `subcontractors` → "Sub contractors" | `canManageSubcontractors` | Tab 9 |
| Team | `add_user` → "Add user" | `canManageUsers` | Add user |
| Team | `manage_users` → "Manage users" (shown as "Manage operatives" to managers with operatives access) | `canManageUsers`, or manager with operatives | Manage users |
| App & account | `settings` → "Settings" | Always | Tab 5 |
| App & account | `help` → "Help & support" | Not operative | Tab 6 |
| App & account | `reset_password` → "Reset password" | Always | Sends a reset email to the user's own address |
| App & account | `sign_out` → "Sign out" (in its own red area) | Always | Sign out |

Each row has an icon inside a tinted rounded square; copy the colours from the catalogue (the chip tints are in §4.1). The footer shows the app version.

### 2.3 Areas opened from Home (`MainMenuSurfaceRoute`) → web routes

iOS opens these as sheets on top of Home. On the web they become **routes**, shown as full pages on desktop.

| iOS route id | iOS screen | Web route |
|---|---|---|
| `clients` | `ClientsView` (full-screen cover) | `/clients` |
| `createProject` | `CreateProjectView` | `/projects/new` (desktop: modal over `/projects`) |
| `createSmallWorks` | `CreateSmallWorksView` | `/small-works/new` |
| `qualifications` | `QualificationsManagementView` | `/qualifications` |
| `myQualifications` | `OperativeQualificationsReadOnlyView` ("My Qualifications") | `/qualifications/mine` |
| `jobTypes` | `JobTypesManagementView` | `/job-types` |
| `wholesalers` | `WholesalersView` | `/wholesalers` |
| `materialCatalogue` | `MaterialCatalogueRootView` | `/material-catalogue` |
| `addUser` | `AddUserView(mode: .admin)` | `/users/new` (desktop: wizard modal) |
| `manageUsers` | `ManageUsersView` | `/users` |
| `tasksDetail` | `TasksDetailView` | `/tasks` |
| `generalAppSettings` | `GeneralAppSettingsView` | `/settings/general` |
| `orgSitesMap` | `OrgSitesMapView` | `/site-map` |
| `siteAudit` | `SiteAuditHubView` | `/site-audit` |
| `invoicing` | `InvoicingView` (title "Timesheets") | `/timesheets` (deep link: `?user={uid}&weekStart={epoch}`) |
| `mySchedule` | `MyScheduleView` | `/schedule` |
| `dailyOverview` | `DailyOverviewView` | `/daily-overview` |
| `warnings` | `WarningsDetailView` | `/warnings` |
| Quick action "Weekly report" | `WeeklyReportView` (via `WeeklyReportOpenShell`) | `/weekly-report` |
| Bell button | `NotificationsView` | `/notifications` (desktop: also a slide-over panel) |
| Avatar button | `HomeProfileCardSheet` ("My Profile") | Avatar popover, then `/settings/profile` |

**Other routes:**

- **Existing web routes to keep:** `/login`, `/setup`, `/setup-password.html`.
- **Main routes:**
  - `/`: Home
  - `/projects/[id]` and `/small-works/[id]`, each with these child routes: `scheduling`, `visibility`, `tasks`, `materials`, `health-safety`, `deadlines`, `site-audit`, `location`, `active-users`
  - `/operatives`
  - `/managers`
  - `/annual-leave`
  - `/subcontractors`
  - `/settings/*` (§6.17)
  - `/help`
  - `/privacy`

Where the web already has an equivalent route, reuse it. Confirm the final route map at Stop Gate 1.

### 2.4 Notification deep links (`Navigation/NotificationDeepLink.swift`)

| `type` | Opens |
|---|---|
| `booking_created` | Operatives: My Schedule. Everyone else: Daily overview. |
| `operative_created`, `manager_created`, `line_manager_peer_update` | Manage users |
| `client_created` | Clients |
| `project_created` | That project's detail page (via `relatedId`). With no `relatedId`: the Projects list. |
| `small_works_created` | That small works job's detail page (via `relatedId`). With no `relatedId`, iOS opens New small works. |
| `booking_clash`, `warning_removed`, `qualification_expiry`, `material_order_cut_off` | Warnings |
| `task_completed`, `task_created`, `deadline_assigned`, `deadline_reminder`, `deadline_due` | Tasks |
| `holiday_request_submitted` | Annual leave, on the Pending requests tab |
| `holiday_request_approved`, `holiday_request_declined` | Annual leave |
| `timesheet_pending_manager_signoff`, `timesheet_signed_by_manager` | Timesheet review for `deepLinkUserId` and `deepLinkWeekStart` |

---

## 3. Desktop-first web layout (required)

The iOS app is designed for a phone about 390pt wide. The web app will mostly be used on laptops and large monitors, so **every page must be upsized and laid out for big screens.** Keep the same content, order, wording, colours and flows. At phone widths, the web app should still look like the iOS app.

### 3.1 Breakpoints and shell

| Width | Shell |
|---|---|
| ≥ 1280px (`xl`) | Fixed left sidebar (272px) and top bar (64px). Content max-width 1440px, 40px side padding. |
| 1024–1279px (`lg`) | Sidebar 248px, collapsible to a 76px icon rail. 32px side padding. |
| 768–1023px (`md`) | Icon rail, or a sidebar that opens as a drawer. 24px side padding. |
| < 768px | The iOS layout: bottom bar (Home, 3 tabs, More), 18px side padding, sheets as bottom sheets. |

**Sidebar = the Main Menu (§2.2).**
- It has the same sections, order, icons, tint chips, labels (including `navigationLabels`), subtitles, badges and permission rules.
- **Home** comes first.
- **Active item:** background is the primary colour at 18% opacity, text in the primary colour. This matches the selected iOS tab.
- **"Edit main menu bar" becomes "Customise sidebar":** drag to reorder the movable items. Save the order per user in `localStorage` under the iOS key `bottomBarMovableTabOrder.{uid}`.
- **Pinned at the bottom:** "Sign out" and the version line.

**Top bar:**
- **Left:** the page title (use the iOS navigation title), with a breadcrumb on nested pages.
- **Right:**
  - a **+ New** menu (Project, Small work, User, Task), with the same conditions as the iOS Quick create card (Task is always shown)
  - refresh, with a spinner while it runs
  - notifications bell, with an unread dot in `#E34A4A`
  - profile avatar: initials on a primary-coloured circle

**Banners:** the offline banner and the role-preview banner run across the top of the content area.

### 3.2 Upsizing rules (apply everywhere)

iOS sizes are phone points. At **≥1024px**, use the desktop values below. Below 768px, keep the iOS values.

| iOS (pt) | Desktop (px) | Used for |
|---|---|---|
| 9–10 | 12 | Pills, captions |
| 11 | 13 | Uppercase section labels, meta text |
| 12–13 | 14–15 | Secondary text, row subtitles |
| 14–15 | 16 | Body text, list titles |
| 16–17 | 18 | Card titles |
| 18 (metric values) | 28–32 | Stat numbers |
| 20–22 (screen titles) | 28–32 | Page titles (weight 500–600, letter-spacing −0.3px) |
| 24–30 (hero and login titles) | 36–40 | Hero titles |
| Spacing 8 / 10 / 12 / 14 / 18 | 12 / 16 / 16–20 / 20 / 24–32 | Gaps and padding |
| Card padding 14–18 | 20–24 | Cards |
| Icons 15–20 | 18–24 | Icons |
| Icon chips 30–40 | 40–48 | Tinted icon squares |
| Avatars and round buttons 36–44 | 40–48 | Avatars, circular buttons |
| Corner radius 10–18 | Same values; hero cards 20 | Corners |
| 0.5pt hairline | 1px `border` token | Borders |
| 44pt minimum tap target | 40px minimum click target, plus hover and focus states | Controls |

**Width limits:**
- Keep text blocks to about 80 characters per line.
- Don't stretch a single form or card across 1440px. Use grids and columns instead.

### 3.3 Layout patterns on desktop

| iOS pattern | Desktop layout |
|---|---|
| Vertical list of cards (Projects, Small works, Wholesalers, Sub contractors, Clients) | Responsive card grid: 2 columns at `lg`, 3 at `2xl` (≥1536px). Same card content. Stats, search and filter chips go in a header area above the grid. |
| People lists (Manage users, Operatives, Managers) | Table-style list. Columns come from the row content: avatar and name, role badges, trade, rate, status, last seen. Each row has a "⋯" menu with the same actions. The segments (Active/Inactive/Pending, or Admins/Managers/Operatives) become tabs above the table. |
| List that opens a detail screen (Clients, Wholesalers, Sub contractors, Catalogue, Qualifications) | **At ≥1280px:** master–detail split, with a 400px list on the left and the detail on the right. The URL tracks the selection. **Below 1280px:** separate pages. |
| Hub-style detail screen (Project or Small works detail) | Hero card across the full width. Below it, two columns: **Manage** tiles on the left (8/12 width; 4 tiles per row at `xl`, 3 at `lg`) and the **Details** card on the right (4/12 width, sticky). Each tile opens a nested route. On those sub-pages, show the same tiles as a horizontal tab strip for quick switching. |
| Sheet (create/edit forms, pickers) | Centred modal: 640px for simple forms, 760–880px for wizards such as Add user and New project. Keep the iOS header (Cancel left, title centre, Save/Done right) and add a sticky footer with the main button. Put short fields side by side in 2 columns (first name / surname, start / end date, town / postcode). |
| Large flows (Timesheets, Weekly report, Daily overview, Site audit, H&S, My Schedule) | Full pages that use the extra width: calendars and week grids show all 7 days side by side, and summaries sit in a right-hand column. |
| Swipe actions and context menus | A "⋯" menu on each row plus a right-click menu, with the same actions, order and colours. Destructive actions are red and use the same confirmation text. |
| Pull to refresh | Refresh button in the top bar or page header |
| Segmented controls | Same control, 36–40px tall |
| Bottom action bars | Sticky footer inside the page or modal |
| Toasts | Stack in the top right. The booking toast is green at 95% opacity, as on iOS. |

**Mouse and keyboard:**
- **Hover:** every clickable card and row gets a hover state (border darkens to `searchBorder`, light shadow) and `cursor: pointer`.
- **Focus:** show a visible focus ring (2px, primary colour).
- **Keys:** Esc closes modals, Enter submits forms, and arrow keys work in pickers.
- **No phone-only gestures:** skip the jiggle animation and swipe hints on desktop. Use the equivalents in the table above.

**Optional desktop extras.** Ask Farnie before building any of these:
- a ⌘K command palette that searches the Main Menu rows
- a table/grid view toggle on Projects
- keyboard shortcuts for "New project" and similar actions

### 3.4 Home page on desktop (`Views/HomeView.swift`)

```text
+----------------------------------------------------------------------------+
| Tuesday 16 Sep                                    [refresh] [bell*] [FN]   |
| Hi, Farnie                                                                 |
+-----------------------------------------------------+----------------------+
| TODAY'S OVERVIEW                     [gear] On track | [!] Warnings        |
| 12 active projects                                  |     All clear        |
| [ 2  Tasks Due Today ] [ 5  Tasks Due This Week ]   | [v] Tasks            |
| [ 0  Warnings ]            (blue gradient card)     |     3 pending        |
+-----------------------------------------------------+----------------------+
| Quick actions                              Main Menu   Customise           |
| [tile] [tile] [tile] [tile] [tile] [tile]   <- 6 per row >=1280px, 4 at lg |
+-----------------------------------------------------+----------------------+
| Up next                                    See all  | [wrench] Maintenance |
| Wednesday 17th September                            |  Soon                |
| | Site name                                      >  |  Coming in a future  |
| | 07:30 . J1234 . Booked by name                    |  update              |
+-----------------------------------------------------+----------------------+
```

**Header**
- Date line: full weekday, day and short month (e.g. "Tuesday 16 Sep"), 13px, muted.
- Greeting: "Hi, {firstName}", 30px, weight 500. If there's no first name, use the part of the email before the @.
- Buttons on the right:
  - **Refresh** (checks the connection, then recomputes): a 44px circle, white fill, 1px `#E6E8ED` border.
  - **Notifications:** a 44px circle with the same style, plus a red unread dot.
  - **Profile:** white initials on a `#185FA5` circle, 38pt on iOS and 44px on desktop.

**Today's overview card** (left 8/12 of the row)
- **Card style:** gradient from `#185FA5` (top left) to `#378ADD` (bottom right), radius 20, padding 24.
- **Heading:** "Today's overview", displayed in uppercase (13px, white at 90% opacity). Below it, "{n} active project" or "{n} active projects" (18px). The count includes live projects plus live small works.
- **Status chip:** "Heads up" or "On track".
- **Metric pills:** white at 14% opacity, radius 12, value 28–32px, label 13px. Which metrics appear depends on the user:
  - **Operatives:** Tasks Due Today, Tasks Due This Week, My Tasks Overdue.
  - **Admins:** they choose up to 3 metrics with the gear button, which opens "Dashboard metrics". The eight options are:
    - Tasks Due Today (My Tasks)
    - Tasks Due This Week (My Tasks)
    - Warnings
    - People on Site (Operatives + Managers)
    - Managers on Site
    - Operatives on AL
    - Managers on AL
    - Open Tasks (All Users)

    The default is the first three. The choice is saved per user in `localStorage` under `homeOverviewMetrics.v1.{uid}`.
  - **Everyone else:** Tasks Due Today, Tasks Due This Week, Open Tasks (My Tasks).

**Status tiles** (right 4/12 on desktop, side by side on mobile)
- **Warnings** (admins only): shows "All clear" or "{n} active", and opens Warnings.
- **Tasks:** shows "{n} pending" and opens Tasks. For non-operatives the count also includes holiday approvals waiting on them; for operatives it also includes qualification reminders.

**Quick actions**
- **Header row:** "Quick actions", then "Main Menu" (opens the menu) and "Customise" / "Done".
- **Grid:** 6 columns at ≥1280px, 4 at `lg`, 3 below `lg` (as on iOS).
- **Tiles:** at least 128px tall, 48px icon chip (tint at 22% opacity), 16px medium label, 2 lines maximum.
- **Customise mode:**
  - Drag to reorder, using pointer or keyboard.
  - A "×" button removes a tile.
  - A "+" button opens the "Add quick action" picker.
  - The first time, show the hint "Drag the icons to your desired layout." (key `homeQuickActionCustomizeHint.{uid}`).
- **Saving:** save the tile order per user in `localStorage` under `homeQuickActionOrder.{uid}`. Tile definitions and default order are in §6.18.

**Up next** (left 8/12)
- **Header:** "Up next" (20px semibold) and a "See all" link that opens My Schedule.
- **Day headings** use ordinals, e.g. "Wednesday 17th September".
- **Rows** show only the user's own upcoming bookings:
  - their operative bookings, excluding cancelled or completed ones, drawn with a blue `#185FA5` accent bar
  - their manager site bookings, drawn with a purple `#534AB7` accent bar
- **Row layout:** 5px accent bar, title (the site name) 17px semibold, subtitle "{time} · {job number} · {booked by}" 14px muted, and a chevron. Clicking a row opens My Schedule.
- **How much to show:** at least 2 different days, up to 48 rows.
- **Empty state:** "No upcoming bookings on your schedule."

**Maintenance card** (right 4/12)
- Shown only to users who can view projects and aren't operatives.
- Wrench icon on an amber chip, the title "Maintenance", a "Soon" pill, and the text "Coming in a future update".

**Task-limit banner** (admins only, top of the page)
- Shown when any project has 500 or more tasks.
- Title: "Warning: Task limit reached".
- One line per affected project: "{jobNumber}: Delete first 50 completed tasks to clear some space". Show at most 3, then "And {n} more project(s)...".

---

## 4. Design system: the "feel" of the app

The app has a light, calm, card-based look:

- **Canvas and cards:** an off-white canvas with white cards. Cards have hairline borders, 14–18pt corners and almost no shadow.
- **Type:** mostly medium-weight system type at small sizes.
- **Colour:** used sparingly, through **tinted icon chips** (a pastel square behind a darker icon) and **capsule status pills**.
- **Emphasis:** one strong element per screen, usually a **blue gradient hero card**.
- **Exceptions:** the login screen is dark navy with cyan, and a few modules (H&S, Weekly report, Materials, Annual leave) have their own palettes.

Build the web tokens from the values below. Don't eyeball them.

### 4.1 Core palette (`Views/ProjectSmallWorksRevampTokens.swift` → `ProjectWorksRevampColors`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F7F8FA` | `#0B1017` | App and page background (also the nav bar background) |
| `card` | `#FFFFFF` | `#151C26` | Cards |
| `ink` | `#0B1020` | `#F2F5F9` | Primary text |
| `muted` | `#6B7280` | `#9AA7B8` | Secondary text |
| `border` | `#EEF0F3` | `#252F3D` | Card hairlines, dividers |
| `searchBorder` | `#E5E7EB` | `#2A3544` | Search fields, unselected chips |
| `blue` (primary) | `#185FA5` | `#6B95FF` | Primary actions, links, selected chip fill |
| `blueLight` | `#378ADD` | `#8BB4FF` | Gradient end colour |
| `activeGreen` | `#0F6E56` | `#2ED18D` | Active status |
| `upcomingAmber` | `#854F0B` | `#F2AE45` | Upcoming status |
| `jobTypePillBg` / `jobTypePillInk` | `#EEEDFE` / `#3C3489` | `#241F45` / `#C8C0FF` | Job type pill |
| `requiredPillBg` / `requiredPillFg` | `#FCEBEB` / `#A32D2D` | `#3A1E1B` / `#FF6F63` | "REQUIRED" pills, destructive actions |
| `placeholderInk` | `#C5C9D2` | `#6B7686` | Placeholders, version line |
| `pinRoseBg` / `pinRoseFg` | `#FBEAF0` / `#993556` | `#3A1E28` / `#F0A0B8` | Map pin chips |
| `endDateBg` / `endDateFg` | `#FAECE7` / `#993C1D` | `#3A2418` / `#F0B090` | End-date chips |

**Other shared colours:**

| Colour | Value |
|---|---|
| Hero gradient | `#185FA5` → `#378ADD`, top-left to bottom-right |
| Chevrons and row icons | `#C4C9D1` / `#C5C9D2` |
| Circle-button border | `#E6E8ED` |
| Unread dot | `#E34A4A` |

**Icon chip tints** (light mode) and their matching icon colours:

| Chip | Background | Icon colour |
|---|---|---|
| Blue | `#E6F1FB` | `#185FA5` |
| Green | `#E1F5EE` | `#0F6E56` |
| Amber | `#FAEEDA` | `#854F0B` |
| Purple | `#EEEDFE` | `#534AB7` |
| Rose | `#FBEAF0` | `#993556` |
| Coral | `#FAECE7` | `#993C1D` |
| Red | `#FCEBEB` | `#A32D2D` |
| Grey | `#F2F3F5` | `#6B7280` |
| H&S | `#E3FAF2` | `#129E78` |
| Deadlines | `#E6F2FA` | `#185FA5` |

**Project status pills** (`Views/ProjectsView.swift` ~L427):

| Status | Pill background | Text colour | Marker |
|---|---|---|---|
| Active | `#E1F5EE` | `#0F6E56` | 5px dot |
| Upcoming | `#FFF6E1` | `#854F0B` | 5px dot |
| Completed | `#F2F3F5` | `#6B7280` | Check icon |
| Inactive | `#F2F3F5` | `#6B7280` | 5px dot |

All status pills are capsules with 10pt medium text.

**User-chosen accent** (`AppColorScheme`, per device; tints selections and controls):

| Accent | Value |
|---|---|
| Blue (default) | `#0D67ED` |
| Green | `#33B24C` |
| Yellow | `#FFCC00` |
| Pink | `#FF66B2` |

**Appearance setting** (`ThemePreference`): Light (default), Dark or Match system. Store it per browser in `localStorage`.

### 4.2 Module palettes (use them only inside their module)

**Login** (`AuthenticationView.swift` `LoginBrand`):

| Element | Value |
|---|---|
| Background gradient (top to bottom) | `#060E1A` → `#0B1828` → `#071422` |
| Accent | cyan `#22E5FF` |
| Button gradient (left to right) | `#1A6BF5` → `#0E4FD8` → `#0A3EC4` |
| Field fill | white at 5% opacity (8% when focused) |
| Field border | white at 10% opacity; when focused, cyan at 50% with a glow |
| Background texture | 40px grid lines in cyan at 4% opacity |
| Background glows | two blurred glows: cyan at 12% and blue at 15% |

**Health & Safety** (`Views/HSTheme.swift` `HS`; light values, dark values are in the file):

| Group | Values |
|---|---|
| Backgrounds | bg `#F4F6FA`, card `#FFFFFF`, line `#E6EBF2` |
| Text | ink `#0E1726`, slate `#667488` |
| Brand | blue `#2F6BFF`, blueDeep `#1E4FD8`, navy `#12233C`, teal `#0FAE9E` |
| Status | green `#12A46A`, amber `#E08A1E`, red `#E2493F`, violet `#6D5AE6` |
| Hero gradients | heroBlue `#3F86FF` → `#2F6BFF` → `#1E4FD8`; heroTeal; heroNavy |
| Metrics | card radius 20, padding 16, screen padding 18 |
| Shadows | two layers (14px blur / 6px offset, and 2px / 1px) |
| Type scale | screen title 20 bold, hero 24 bold, stat 28 heavy |

**Materials** (`Views/MaterialsOrderingTheme.swift`):

| Token | Value |
|---|---|
| Primary | `#1A6EC2`; gradient to `#2F90E6` |
| Primary tint | `#E3F2FE` |
| Page background | `#F6F8FB` |
| Border | `#E2E8F0` |
| Ink / muted | `#141C2F` / `#67758A` |
| Success | `#259252` |
| Danger | `#C13C3C` |
| Warning | `#BA7827` |

**Annual leave** (`Views/HolidayChrome.swift`):

| Token | Value |
|---|---|
| Accent | `#185FA5` |
| Taken (full-day booked) | `#228B51` |
| Pending request | `#E33838` |
| Pending metric | `#FA9E17` |
| Approved half day | `#F2851F` |

**Weekly report** (`Views/WeeklyReportView.swift` `WeeklyReportColors`):

| Token | Value |
|---|---|
| Navy | `#0B1220` |
| Cyan | `#0EA5E9` |
| Blue | `#2563EB` |
| Orange | `#F97317` |
| Muted | `#64748B` |
| Light / mid | `#F0F7FF` / `#E2EBF6` |
| Red background / text | `#FEF2F2` / `#991B1B` |
| Green background / text | `#F0FDF3` / `#166634` |

**User profile screens** (`Views/ManageUserProfileChrome.swift` `ManageUserProfilePalette`):

| Token | Value |
|---|---|
| Page background | `#F2F2F7` |
| Header gradient | `#0B1020` → `#1A2447` |
| Hero gradient | `#185FA5` → `#378ADD` |
| Avatar gradient | `#7F77DD` → `#534AB7` |
| Segmented control / search background | `#E9E9EC` |
| List blue | `#2563EB` |

**Site audit:** `Views/SiteAudit/SiteAuditDesignSystem.swift` uses the core palette plus its own pills, cards and hero.

### 4.3 Typography, shape and elevation

- **Font:** system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`). The app bundles no custom fonts. Never embed SF Pro.
- **Weights:** mostly `medium` (500); `semibold` (600) for card titles and headers; `black` only for the login wordmark.
- **iOS sizes in use:**

| Size (pt) | Used for |
|---|---|
| 9–10 | Pills, stat labels |
| 11 | Section labels (uppercase, letter-spacing 0.3–0.4), meta text |
| 12–13 | Secondary text |
| 14–16 | Row titles |
| 17 | Section headings such as "Up next" |
| 18 | Metric values |
| 22 | Screen titles (letter-spacing −0.3) |
| 30 | Login wordmark "PROJECT" / "PLANNER" |

  Upsize these for desktop per §3.2.
- **Corner radius:**
  - chips and pills: 4–12
  - list cards and rows: 14–16
  - hero cards and bottom-bar rows: 18
  - H&S cards: 20
  - capsules: fully rounded
- **Borders:** 0.5pt in the `border` token becomes a 1px border on the web.
- **Elevation:** almost none. Cards rely on borders. Shadows appear only on:
  - the bottom bar: a soft upward shadow
  - toasts: 20% black, 6px blur
  - the login button: a blue glow
  - H&S cards

### 4.4 Icons (SF Symbols → web)

Apple's licence doesn't allow SF Symbols on the web, so map each one to the closest icon in the library the web already uses. The suggested Lucide names are below; check each exists in the installed version.

| SF Symbol | Used for | Suggested icon |
|---|---|---|
| `house.fill` | Home | `House` |
| `folder.fill` | Projects, Job types | `Folder` |
| `hammer.fill` | Small works | `Hammer` |
| `person.3.fill` | Operatives, Active users | `UsersRound` |
| `person.badge.key.fill`, `person.badge.shield.checkmark.fill` | Managers | `UserCog` / `ShieldCheck` |
| `person.2.fill` | Manage users, Clients (quick action) | `Users` |
| `person.badge.plus(.fill)` | Add user | `UserPlus` |
| `person.2.badge.gearshape.fill` | Sub contractors | `Handshake` |
| `briefcase.fill` | Clients (menu) | `Briefcase` |
| `sun.max.fill` | Annual leave | `Sun` |
| `map.fill` | Site map | `Map` |
| `doc.text.viewfinder` | Site audit | `ScanText` |
| `doc.text.fill` | Timesheets | `FileText` |
| `graduationcap.fill` | Qualifications | `GraduationCap` |
| `square.grid.2x2.fill` | Job types (menu) | `LayoutGrid` |
| `shippingbox(.fill)` | Material catalogue, Materials | `Package` |
| `building.2(.fill)` | Wholesalers, client row | `Building2` |
| `gearshape.fill` | Settings | `Settings` |
| `questionmark.circle.fill` | Help | `CircleHelp` |
| `key.fill` | Reset password | `KeyRound` |
| `rectangle.portrait.and.arrow.right` | Sign out | `LogOut` |
| `arrow.clockwise` | Refresh | `RotateCw` |
| `bell.fill` | Notifications | `Bell` |
| `exclamationmark.triangle.fill` | Warnings | `TriangleAlert` |
| `checklist` | Tasks | `ListChecks` |
| `plus.rectangle.on.rectangle` | Tasks (quick action), new task | `CopyPlus` |
| `calendar` | My Schedule, Scheduling | `Calendar` |
| `calendar.badge.clock` | Daily overview, Deadlines | `CalendarClock` |
| `calendar.badge.plus` | Booking toast | `CalendarPlus` |
| `chart.bar.doc.horizontal` | Weekly report | `FileChartColumn` |
| `plus.square.fill` | Create project | `SquarePlus` |
| `folder.badge.plus` | Quick create: Project | `FolderPlus` |
| `slider.horizontal.3` | General app settings | `SlidersHorizontal` |
| `sparkles` | Quick create card | `Sparkles` |
| `wrench.and.screwdriver.fill` | Maintenance teaser | `Wrench` |
| `eye` / `eye.slash` | Visibility, password toggle | `Eye` / `EyeOff` |
| `cross.case.fill` | H&S | `BriefcaseMedical` |
| `clipboard.fill` | Site audit tile | `Clipboard` |
| `mappin.and.ellipse` | Location, address rows | `MapPin` |
| `magnifyingglass` | Search | `Search` |
| `line.3.horizontal.decrease.circle` | Filter menu | `ListFilter` |
| `globe` | "Set up your organisation on the web" | `Globe` |
| `ellipsis` / `chevron.left` / `chevron.right` | Row menu and navigation | `Ellipsis` / `ChevronLeft` / `ChevronRight` |
| `theatermasks.fill` | Role preview banner | `Drama` |
| `clock.fill` | My Timesheets | `Clock` |
| `bolt.fill` | Price work | `Zap` |
| `sterlingsign.circle.fill` | Expenses | `PoundSterling` |
| `flag.fill` | End date | `Flag` |

For any symbol not in this table, add a row as you meet it.

### 4.5 Component inventory (iOS → React)

**Build these once in `components/ios/` or `components/shared/`, using the same names:**

| iOS component | File | Build as |
|---|---|---|
| `WorksListStatsRow` | `ProjectSmallWorksRevampTokens.swift` | Three stat cells: Active (green), Upcoming (amber), Completed (muted); 18pt value, 10pt label |
| `WorksListSearchRow` | same | Search input (12pt) with a filter-menu button |
| `WorksRevampFilterChip` | same | Capsule chip. Selected: blue fill with white text. Otherwise: card fill with a `searchBorder` border. |
| `appChromeCardContainer` | same | White card, radius 14, 1px border |
| `ProjectDetailRowView` / `SmallWorksDetailRowView` | `ProjectsView.swift`, `SmallWorksView.swift` | Work card (see below) |
| `SettingsHubChrome` (section title, card, footer, divider, save button) | `SettingsHubChrome.swift` | Settings primitives. The save button is full width, blue, radius 14, 15pt semibold, and reads "Saving…" while saving. |
| `ManageUser*` rows, chips and cards | `ManageUserProfileChrome.swift` | Profile, permission and account-action rows |
| `PermissionToggle` | `AddUserView.swift` ~L1215 | Toggle row with title and description |
| `StaffTradeTypeFormSection` | `StaffTradeTypeFormSection.swift` | Trade picker from the preset list, with "Other" plus free text |
| `LineManagersMultiSelectSheet` | same name | Multi-select people picker |
| `MapPinPickerView` | same name | "Set pin on map" picker |
| `BookingHoursTimelineBar`, `ScheduleHoursTimelineBar`, `WorkingHoursTimelineBar` | `BookingHoursEditSheet.swift`, `Core/ScheduleHoursTimelineBar.swift`, `OrganisationWorkingHoursView.swift` | Horizontal day timeline showing the standard window, break and overtime |
| `BookingClashWarningCard`, `ScheduleOverlapWarningPanel`, `OperativeClashReviewPanel` | clash views | Clash cards with a hatched overlay |
| Signature pads (`TimesheetSignaturePad`, `HSStrokeSignaturePad`, `HSSignaturePad`) | Invoicing, H&S | Canvas signature pad, saved as a base64 PNG (see §5) |
| `OfflineStatusBanner`, `OfflineSyncQueueSheet` | `OfflineStatusBanner.swift` | Connectivity banner. The web doesn't need the iOS offline outbox; ask before adding one. |
| `InAppRemoteDocumentViewer` | same name | In-app PDF and image viewer |
| `AnnualLeaveUsageHeroView`, calendar day decorations | annual leave files | Allowance hero and calendar cells |
| `WarningsHeroCard`, `WarningsFilterChipsRow`, `WarningPriorityBadge`, `WarningRemoveButton` | `WarningsRevampViews.swift` | Warnings UI |

**Module component sets (build them inside their module):**
- `HS*`: `HSComponents.swift`, 19 components
- `SiteAudit*`: `SiteAuditDesignSystem.swift`
- `DL*` (Deadlines): `DLComponents.swift`
- `Materials*`: `MaterialsProjectListUI.swift`

**Canonical work card** (Projects and Small works lists; copy this exactly, then upsize per §3.2):
- White card, radius 16, 1px `border`, padding 14.
- **Top row:**
  - Left: job number (16pt medium, letter-spacing −0.2), followed by the job-type pill.
    - Pill: 9pt medium, `jobTypePillInk` on `jobTypePillBg`, radius 4.
    - Pill text: `customJobType` in upper case, otherwise the `jobType` raw value.
  - Below the job number: site name (13pt medium).
  - Right: the status pill.
- **Four icon rows** (13pt icon in `#C5C9D2`, 11pt muted text):
  - `building.2`: client name
  - `mappin.and.ellipse`: site address
  - `person`: manager name
  - `calendar`: "d MMM yyyy – d MMM yyyy"
- **Progress:**
  - Label "Progress" (10pt muted) with the percentage (11pt) on the right.
  - 5px track in the `border` colour.
  - Fill: blue → blueLight gradient, or `#C5C9D2` when the job is completed.
  - Value: time elapsed between start and end. It's 100% when the job is completed or past its end date.

---

## 5. Firestore and Storage, exactly as iOS writes them

### 5.1 Conventions (the web must follow them)

- **Document IDs.** Organisation entities use `UUID().uuidString`, which is **uppercase**, e.g. `3F2A…`.
  - JS `crypto.randomUUID()` returns lowercase, so call `.toUpperCase()` on it.
  - `users` docs use the Auth UID. Invite placeholders use a random uppercase UUID.
  - `userEmails` docs use the lowercased email.
- **Denormalised `id` field.** Many entity documents also contain an `id` field that equals the doc ID. Operatives, managers, tasks and notifications don't. Check each save function.
- **Hand-written dictionaries (no Codable).** Missing fields fall back to defaults when read. Even so, **write every field iOS writes, with the same type.**
- **Dates.**
  - Store them as Firestore `Timestamp`s.
  - Fields that represent a day are the device's **local midnight** (Europe/London).
  - "Day keys" are `yyyy-MM-dd` strings, for example `payrollTimePolicyEffectiveFrom`.
  - Times of day are `"HH:mm"` strings, for example `workStartTime`.
- **Numbers.**
  - Integer fields (`Int`): months (1–12), `unpaidBreakMinutes`, material `quantity`, payment days, `version`.
  - Floating-point fields (`Double`): rates, allowance days, multipliers, hours, latitude/longitude, amounts.
  - Always write integers to `Int` fields. iOS reads them with `as? Int`, which fails if the stored value has a fraction.
- **Empty optional values.** iOS handles these differently per entity, so copy the entity's own style:
  - **Empty string `""`:** most text fields on projects, clients, operatives, managers and bookings (e.g. `description: ""`, `notes: ""`). Tasks only do this for `details`; other empty task fields are left out.
  - **Field deleted** (`deleteField()`): `users` docs, and some booking fields.
  - **`null`:** timesheet drafts and deadline maps.
  - **`0`:** unset operative rates are stored as `0` (`hourlyRate: 0`, `dayRate: 0`).
- **Overwrite vs merge.** iOS **replaces the whole document** (`setData` without merge) for:
  - projects, small works, clients, operatives, managers, tasks, notifications
  - materials, catalogue items, send records, site audits
  - sub contractors, sub contractor bookings
  - the `settings/jobTypes` doc

  So any extra field the web adds to these documents **will be erased** the next time iOS saves them. Don't store web-only data on them.

  iOS **merges** for users, bookings, manager site bookings, holiday bookings, organisation settings, timesheet state, H&S state, deadlines and trade types.
- **Live listeners on iOS:** the organisation doc, `bookings`, `managerSiteBookings`, `materials` (per project) and `notifications` (the inbox). Everything else loads once and refreshes on demand. The web should use `onSnapshot` at least for these five.
- **Organisation scope.** Everything except `users`, `invitations` and `platformConfig` lives under `organizations/{orgId}/…`. The web gets `orgId` from `users/{uid}.organizationId`.

### 5.2 Top-level collections

**`users/{uid}`** is the account (merge writes; `FirebaseBackend.swift` `saveUser` ~L4005, parser `parseAppUserDocument` ~L3349).

| Group | Fields |
|---|---|
| Identity | `email`, lowercased for invited users (string); `organizationId` (string, the active org); `role` (string); `firstName`; `surname`; `mobileNumber`, deleted when empty; `isActive` (bool); `passwordSet` (bool); `isSuperAdmin` (bool); `createdAt`; `updatedAt`; `lastSeenAt` |
| Permission flags (flat, top level) | `adminAccess`, `manager`, `operatives`, `skills` (always false), `qualifications`, `materials`, `projects`, `smallWorks`, `operativeMode`, `annualLeaveSelfBook`, `weeklyReports`, `dailyOverview`, `subContractors`, `siteAudit`, `wholesalersOrderHistory` (all bool) |
| Policy | `policyAccepted` (bool); `policyAcceptedAt` (Timestamp, or deleted) |
| Employment | `employmentType` (`paye` or `self_employed`); `employmentTypeTransitionFrom` and `employmentTypeEffectiveAt`, set only while a switch is scheduled |
| Line managers | `assignedManagerUserId` (the first one); `assignedManagerUserIds` (array of uids); `hasNoLineManager` (bool) |
| Pay | `dayRate` **or** `hourlyRate` (Double, never both); `vatNumber`; `utrNumber`; `timesheetsEnabled` (bool) |
| Trade | `tradeTypePreset` (a `StaffTradeType` raw value, or `Other`); `tradeTypeCustom` |
| Annual leave | `annualLeaveEnabled` (bool); `annualLeaveDaysPerYear` (Double, 0.5 steps); `annualLeaveYearStartMonth`, `annualLeaveYearEndMonth` (Int 1–12); `annualLeaveCarriesOver` (bool) |
| Other | `profilePhotoURL`; `pushTokens` (array, arrayUnion); `pushTokenUpdatedAt`; `notificationPreferences` (map, below) |

`notificationPreferences` contains:

- `bookingConflicts`, `projectDeadlines`, `operativeAvailability`, `dailyReports`, `materialOrderCutOff` (bool)
- `materialCutOffHour`, `materialCutOffMinute` (Int)
- `materialCutOffOnSaturday`, `materialCutOffOnSunday` (bool)

**Rules when saving a user:**

- **If `operativeMode` is on:** `role` is written as `operative`, `isSuperAdmin` false, and `adminAccess`, `manager`, `operatives` and `qualifications` false.
- **If operative mode is off:** `materials` is written as true.
- **When reading an operative:** `projects` and `smallWorks` are treated as true.
- **Enum values:**
  - `role`: `basic`, `admin`, `manager`, `operative` or `viewer` (a missing value is read as `viewer`)
  - `StaffTradeType` raw values: `Electrician`, `Plumber`, `AC Engineer`, `Ventilation`, `Gas Engineer`, `Carpenter`, `Roofer`, `Bricklayer`, `Groundworker`, `Finance`, `Contract Manager`, `Project Manager`, `Site Manager`, `Supervisor`, `Installer`, `Commissioning Engineer`, `Programmer`, `Scaffolder`, `Brick & Block`, `Dryliner`, `Painter & Decorator`, `Demolition Operative`, `Steel Fixer`, `Plant Operator`, `Other`

**`invitations/{UPPERCASE-UUID}`**: publicly readable, so the web setup page can verify tokens.

- `email`, `organizationId`, `invitedBy`, `firstName`, `surname`
- `permissions`: a map of the flags above
- `employmentType`
- `isUsed` (bool), `createdAt`
- Optional: `mobileNumber`, `assignedManagerUserId(s)`, `hasNoLineManager`, `dayRate`, `tradeTypePreset`, `tradeTypeCustom`, `annualLeaveDaysPerYear`, `annualLeaveYearStartMonth`, `annualLeaveYearEndMonth`, `annualLeaveCarriesOver`, `annualLeaveEnabled`, `timesheetsEnabled`, `vatNumber`, `utrNumber`

**`platformConfig/{docId}`**: web and platform configuration. iOS doesn't use it.

### 5.3 `organizations/{orgId}` (the organisation document)

Changes are **merged** (`FirebaseBackend.swift` ~L804–1012, ~L3528–3873).

**Top-level fields:**

| Group | Fields |
|---|---|
| Identity | `id`, `name`, `creatorUserId`, `adminUserId`, `members` (map of uid to role), `createdAt`, `updatedAt` |
| Office | `officeAddressLine1`, `officeCity`, `officePostcode`, `countryCode` (default `GB`), `defaultLatitude`, `defaultLongitude` |
| Branding | `companyLogoURL`, `documentAbbreviation` (1–3 uppercase letters/digits) |
| Payroll | `payrollTimePolicy` (map), `payrollTimePolicyPrior` (map), `payrollTimePolicyEffectiveFrom` (day key), `payrollTimePolicyScheduled` (map with `effectiveFrom` day key) |
| Settings maps | `warningDetection` (map), `invoicing` (map), `annualLeaveDefaults` (map) |
| Legacy copies | `bankHolidayRegionId`, `currencyCode` (also written into `settings`) |
| Trial and lock | see §1.3 |

**`settings` map:**

| Field | Contents |
|---|---|
| `uiLabels.navigationLabels` | Map of key to label (§1.4) |
| `myScheduleOptions` | `showOffice`, `showWorkingFromHome`, `showSiteSurvey` (bool); `customItems` (string array); `customItemEnabled` (map of item to bool) |
| `bankHolidayRegionId` | string |
| `currencyCode` | ISO code, default GBP |
| Other | `allowSelfRegistration`, `requireEmailVerification`, `defaultUserRole`, `workingHours`, `holidayCalendar` |

**`payrollTimePolicy`** (defaults in brackets; `Models/AppModels.swift` ~L1041):

| Field | Default |
|---|---|
| `standardDayStart` | `"07:30"` |
| `standardDayEnd` | `"16:00"` |
| `unpaidBreakMinutes` (Int) | 30 |
| `breakPaid` | false |
| `standardPaidHours` | 8 |
| `breakWindowStart` | `"12:00"` |
| `breakWindowEnd` | `"12:30"` |
| `weekdayOutsideStandardMultiplier` | 1.5 |
| `sundaySameAsSaturday` | false |
| `saturday` | Map; see below |
| `sunday` | Map; see below |

The `saturday` and `sunday` maps have these fields:

- `allHoursAtMultiplierMode`
- `allHoursMultiplier`
- `useCustomStandardDayWindow`
- `customStandardStart` and `customStandardEnd` (null when unset)
- `countsAsHours`
- `outsideStandardWindowMultiplier`

Defaults: Saturday has a custom window of 07:30–13:00 that counts as 8h, with ×2 outside it. Sunday pays all hours at ×2.

**`invoicing`** (`OrganizationInvoicingSettings`):

| Field | Values (default) |
|---|---|
| `paymentRunMode` | `date_ranges` or `recurring_timeframe` |
| `paymentDateMode` | `specific_dates` or `recurring_date` |
| `paymentRunDateRanges` | Array of `{startDay, endDay}`, maximum 2 (default `[{1, 2}]`) |
| `paymentDates` | Int array, maximum 2 (default `[18]`) |
| `noteToUsers` | string |
| `recurringPaymentRunSummary` | string |
| `recurringRunStartDay`, `recurringRunEndDay`, `recurringPaymentDay` | `monday` … `sunday` |

**`annualLeaveDefaults`:** `daysPerYear` (25), `startMonth` (1), `endMonth` (12), `carriesOver` (false).

**`warningDetection`:** see `Models/OrgWarningDetectionSettings.swift`.

### 5.4 Organisation sub-collections

All paths below are under `organizations/{orgId}/`.

**Jobs**

**`projects/{id}` and `smallWorks/{id}`** use the same shape (overwrite; `saveProject` ~L1435, `saveSmallWorks` ~L1802):

| Field | Details |
|---|---|
| `id` | Doc ID |
| `jobNumber` | Shown in the UI as "Project reference" |
| `siteName` | |
| `addressLine1`, `addressLine2` (`""` if empty), `townCity`, `postcode` | Address |
| `siteAddress` | The address lines joined with ", " (legacy) |
| `client` | **Embedded map** `{id, name, email, phone}` |
| `startDate`, `endDate` | Timestamps |
| `jobType` | `CAT A`, `CAT B`, `Small Works` or `Maintenance`. Small works docs use `Small Works`. |
| `customJobType` | Display job type from `settings/jobTypes` |
| `manager` | Legacy enum: `N/A`, `Adam`, `Billey`, `Charley`, `Farnie`, `Fin`, `Greg`, `Morgan`, `Ross`, `Custom`. **New and edited jobs write `Custom`.** |
| `managerId` | First manager's roster UUID |
| `managerIds` | Array of roster manager UUIDs |
| `isLive` | bool |
| `description` | `""` if empty |
| `hiddenManagerUserIds`, `hiddenOperativeUserIds` | uid arrays |
| `usesMapPinForLocation`, `latitude`, `longitude` | Map pin |
| `organizationId`, `createdAt`, `updatedAt` | |

- **Status is not stored.** It's worked out when displayed: `Inactive` if not `isLive`; `Upcoming` if today is before the start date; `Completed` if today is after the end date; otherwise `Active`.
- **`notes` is not saved** by iOS.
- The rules also allow a `healthSafety` sub-collection under each job, but iOS stores H&S in `settings` (below).

**`tasks/{id}`** (overwrite; ~L2237; `Models/ProjectTask.swift`):

| Field | Details |
|---|---|
| `projectId`, `title`, `details` (`""` if empty), `createdBy` | There's no top-level `id` field. Empty optional fields are left out. |
| `assignedOperativeId`, `assignedManagerId` | Legacy single assignees |
| `assignedOperativeIds`, `assignedManagerIds` | Roster UUID arrays |
| `dueDate` | Every new task needs one |
| `priority` | `Low`, `Normal`, `High`, `Urgent` |
| `status` | `To Do`, `In Progress`, `Completed` |
| `attachedFileURL`, `attachedFileName`, `attachedImageURLs`, `attachedSiteAuditId`, `attachedSiteAuditTitle` | Attachments |
| `completedBy`, `completedAt`, `completionImages`, `completionFiles`, `completionNotes` | Completion |
| `items` (`[{id, title, description}]`), `completedItemIds` | Checklist |
| `organizationId`, `createdAt`, `updatedAt` | |

A project can have at most **500 tasks** (`Core/ProjectTaskStore.swift`).

**People**

**`clients/{id}`** (overwrite): `id`, `name`, `contactPerson`, `email`, `phone`, `address` (empty values stored as `""`), `organizationId`, `createdAt`, `updatedAt`.

**`operatives/{id}`** is the roster record (overwrite; ~L2658):

| Field | Details |
|---|---|
| `firstName`, `lastName`, `name` (legacy full name), `email`, `phone`, `startDate` | |
| `skills` | Array; deprecated |
| `qualifications` | `[{id, name, hasEndDate, endDate?, createdAt, updatedAt}]` |
| `qualificationExpiryDates` | Map of qualification UUID to Timestamp |
| `qualificationCertificateURLs` | Map of qualification UUID to URL |
| `isActive` | bool |
| `hourlyRate`, `dayRate` | `0` when unset |
| `currencySymbol` | `"£"` |
| `notes`, `tradeTypePreset`, `tradeTypeCustom` | |
| `organizationId`, `createdAt`, `updatedAt` | |

**`managers/{id}`** is the roster record (overwrite): `firstName`, `lastName`, `email`, `mobileNumber`, `department`, `isActive`, `notes`, `tradeTypePreset`, `tradeTypeCustom`, `organizationId`, `createdAt`, `updatedAt`.

**`qualifications/{id}`** is the organisation's qualification template list (batch write): `name`, `hasEndDate`, `endDate`, `createdAt`, `updatedAt`. **`skills/{id}`** is deprecated.

**`userEmails/{emailLower}`** = `{ userId }`. It enforces one user per email per organisation.

**`operativeDayRateHistory/{id}`** = `{ userId?, operativeId?, dayRate, effectiveAt, createdAt }`. It supports effective-dated rate changes.

**`operativeProfiles/{uid}`** = `{ userId, assignedManagerUserId, dayRate, updatedAt }`. It's a fallback when a manager can't write the user doc.

**Scheduling**

**`bookings/{id}`** is an operative on a job (merge; live; ~L5169):

| Field | Details |
|---|---|
| `id`, `operativeId` (roster UUID), `projectId` (project or small-works UUID) | |
| `date` | Local midnight |
| `timeSlot` | `AM`, `PM`, `FULL DAY`, `Evening`, `Overtime`, `CUSTOM_HOURS` |
| `workStartTime`, `workEndTime` | `"HH:mm"`, custom hours only; otherwise the fields are deleted |
| `isBreakRemoved` | bool |
| `otMultiplierOverride` | Deleted when not set |
| `bookingGroupId` | Groups multi-person bookings |
| `bookedBy` | The booker's full name, or email |
| `notes` | `""` if empty |
| `status` | `Confirmed`, `Tentative`, `Cancelled`, `Completed` |
| `createdAt`, `updatedAt` | |

**`managerSiteBookings/{id}`** is where a manager or admin is working (merge; live):

| Field | Details |
|---|---|
| `id`, `userId` (uid), `date`, `organizationId` | |
| `timeSlot` | `AM`, `PM`, `FULL_DAY` (**with an underscore**, unlike operative bookings), `CUSTOM_HOURS` |
| `locationType` | `project`, `small_work`, `office`, `working_from_home`, `site_survey`, `custom` |
| `locationId`, `customLocationName` | |
| `workStartTime`, `workEndTime`, `isBreakRemoved`, `bookingGroupId` | |
| `createdAt`, `updatedAt` | |

**`subcontractorBookings/{id}`** (overwrite):

- `id`, `subcontractorId`, `projectId`, `date`
- `timeSlot` (operative values), `workStartTime`, `workEndTime`, `isBreakRemoved`
- `bookedBy` (`"Project Planner"`), `status`, `bookedContactIds` (array)
- `createdAt`, `updatedAt`

**`holidayBookings/{id}`** (merge):

| Field | Details |
|---|---|
| `id`, `organizationId` | |
| `userId`, `operativeId` | At least one of the two |
| `startDate`, `endDate` | |
| `status` | `pending`, `approved`, `rejected` |
| `timeSlot` | `FULL DAY`, `AM`, `PM` |
| `approvedByUserId`, `approvedAt` | |
| `cancellationRequestedAt`, `cancellationRequestedByUserId` | |
| `createdAt`, `updatedAt` | |

**Materials**

**`materials/{id}`** is a project material line (overwrite; live per project; ~L6580):

| Field | Details |
|---|---|
| `id`, `projectId` | |
| `material` | Name |
| `quantity` | **Int** |
| `unit` | `Number`, `Box`, `Length`, `Drum`, `Pallet` |
| `addedBy` (name), `addedByUserId` (uid), `addedAt` | **Required for ownership rules** |
| `editedBy`, `editedByUserId`, `editedAt` | |
| `date` | The materials day |
| `status` | `draft`, `sentForQuote`, `ordered` |
| `catalogueItemId`, `brand`, `productCode`, `size`, `length` | Optional |
| `lengthUnit` | `M` or `MM` (optional) |
| `category`, `websiteURL`, `notes`, `lastSentAt` | Optional |
| `lastSentRequestType` | `Quote` or `Order` (optional) |
| `sizeOrLength` | Legacy copy of `length`: iOS writes both. Older docs may only have `sizeOrLength`, or a numeric `packSize`; read those as a fallback. |

**`materialCatalogue/{id}`** (overwrite; managers and admins only):

- `id`, `name`, `brand`, `productCode`
- `defaultUnit`, `size`, `length`, `lengthUnit`, `category`
- `sizeOrLength`: a legacy copy of `length`, written alongside it
- `createdAt`, `createdByUserId`, `createdByName`

**`materialSendRecords/{id}`**:

- `id`, `projectId`, `requestType`, `sentAt`, `materialsDate`, `sentBy`
- `recipients`: `[{name, email, wholesalerName}]`
- `lines`: `[{materialId, name, quantity, unit, brand, productCode, lengthDisplay}]`

**Suppliers**

**`wholesalers/{id}`**:

- `id`, `name`, `address`, `trade`, `accountNumber`, `primaryContactId`
- `contacts`: `[{id, name, email, isPrimary, createdAt}]`
- `createdAt`, `updatedAt`

**`subcontractors/{id}`**:

- `id`, `name`, `subcontractorType` (the trade), `website`, `address`
- `contacts`: `[{id, name, email, contactNumber, position, tradeType, createdAt}]`
  - `position` is one of: `Finance`, `Contract Manager`, `Project Manager`, `Site Manager`, `Supervisor`, `Installer`
  - Contacts are listed as "operatives" in the UI: names only, no logins.
- `createdAt`, `updatedAt`

**Site audits**

**`siteAudits/{id}`** (overwrite; ~L7075):

- `id`, `organizationId`, `projectId`, `projectJobNumber`, `projectName`
- `type`: `General`, `Variations`, `Snags`
- `title`, `customTitle`, `authorName`, `date`, `createdAt`, `createdByUserId`
- `visibleToOperatives` (bool)
- `items`: `[{id, title, location, assignee, comments, annotations, imageURL, imageCapturedAt, createdAt}]`

**Notifications**

**`notifications/{id}`** (overwrite; live inbox):

There's no `id` field; the doc ID is the uppercase UUID.

- `organizationId`
- `type`: see §2.4
- `title`, `message`
- `userId`: the target user; `null` means everyone with the required permission
- `relatedId`: UUID string or `null`
- `isRead`, `createdAt`
- `requiresPermission`: e.g. `"canViewOperatives"`, or `null`
- `deepLinkUserId`, `deepLinkWeekStart`: `null` when unset

**Empty values are written as `null`, not left out.** Saving can keep an existing `isRead: true`.

**The `settings` sub-collection**

It holds several kinds of document besides preferences:

| Doc ID | Contents |
|---|---|
| `jobTypes` | `{ jobTypes: [String], organizationId, updatedAt }` (overwrite) |
| `tradeTypeInventory` | `{ trades: [String], updatedAt }` (merge) |
| `deadlineAssignments` | `{ projects: { PROJECTID: [uid] }, updatedAt }` (merge) |
| `deadlines_{projects\|smallWorks}_{PROJECTID}` | `{ items: [deadline], updatedAt, projectId }`. The deadline map is `deadlineMap` ~L8434: `status` is `notStarted`, `inProgress`, `blocked` or `complete`, and it includes `history[]` change entries. |
| `healthSafety_{projects\|smallWorks}_{PROJECTID}` | `{ talks[], issues[], signatures[], ramsDocuments[], otherDocuments[], updatedAt }` (merge; maps at ~L8088–8160) |
| `timesheet_{uid}_{weekStartEpochSeconds}` | Timesheet state (merge; ~L8005). See the notes below. |

**Timesheet state documents:**

- **ID:** `{weekStartEpochSeconds}` is `Int(startOfDay(weekStart).timeIntervalSince1970)` using the **London local** midnight.
- **Fields:**
  - `userId`, `weekStart` (Timestamp), `updatedAt`
  - `managerNote`
  - `operativeSignedAt`, `operativeSignedByName`, `operativeSignatureImageBase64`
  - `managerSignedAt`, `managerSignedByName`, `managerSignedByUserId`, `managerSignatureImageBase64`
  - `exportedAt`
  - `expenseEntries`: `[{id, title, details, jobNumber, date, amount, receiptName, managerDecision, managerRevisedAmount}]`
  - `priceWorkEntries`: `[{id, title, details, jobNumber, agreedManagerName, startDate, endDate, amount, managerDecision, managerRevisedAmount}]`
  - `payrollLineReviews`: `{ key: {decision, revisedAmount} }`
  - `managerDecision` values: `pending`, `approved`, `declined`, `edited`
- **Empty values:** empty dates and amounts are written as `null`, and empty strings as `""` (`Views/InvoicingView.swift` ~L541).
- **Listing a user's history:** iOS queries `settings` where `userId == uid` and sorts in memory, so no index is needed.

**Web-only (allowed by the rules, not used by iOS):** `acceptedBookingClashes/{id}`, `dashboardLayouts/{uid}`.

### 5.5 Storage paths (`FirebaseBackend.swift` ~L2335–2600)

In the paths below, `{ts}` is Unix seconds, and spaces in file names are replaced with `_`.

| What | Path | Format |
|---|---|---|
| Task file | `organizations/{orgId}/tasks/{taskId}/files/{uid}_{ts}_{fileName}` | as uploaded |
| Task image | `organizations/{orgId}/tasks/{taskId}/images/{uid}_{ts}_{name}.jpg` | JPEG, quality 0.8 |
| H&S file | `organizations/{orgId}/healthSafety/{projectId}/{category}/{uid}_{ts}_{fileName}` | as uploaded |
| Site audit photo | `organizations/{orgId}/siteAudits/{auditId}/images/{uid}_{ts}_{name}.jpg` | Longest side at most 1280px, JPEG 0.72 |
| Profile photo | `organizations/{orgId}/userProfiles/{uid}/profile.jpg` | JPEG 0.82 |
| Company logo | `organizations/{orgId}/branding/company_logo/{uid}_{ts}.jpg` | JPEG 0.75 |
| Qualification certificate | `organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{uid}_{ts}_{name}` | as uploaded |
| Timesheet export PDF | `organizations/{orgId}/timesheetExports/{stamp}_{name}` | PDF |

`storage.rules` isn't in the iOS folder. Look for it in the web repo or the Firebase console, and never loosen it.

### 5.6 External services

| Service | Used by | Endpoint or details |
|---|---|---|
| Bank holidays | Annual leave | `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`, filtered to the org's UK region (`Core/BankHolidayService.swift`, `Core/BankHolidayRegionDirectory.swift`) |
| Map tiles | Site map | OpenStreetMap tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, drawn over Apple Maps. On the web, Leaflet or MapLibre with OSM-style tiles gives the same look. Respect the OSM tile usage policy; use a tile provider for production. |
| Geocoding | Site map, project location | Apple geocoder with a cache (`Core/GeocodingCacheService.swift`). The web needs an equivalent geocoder; ask Farnie which one. |
| Calendar export | My Schedule | Google, Outlook and Apple calendar deep links and `.ics` files (`Views/ScheduleCalendarExport.swift`) |
| Email | Several flows | The Cloud Function in §1.6 |

---

## 6. Section-by-section map

Each section below gives the iOS files, who can open the section, the screens and flow, the data it uses, rules to keep, desktop layout notes, and what to read closely in Phase 3A. **Always read the listed files in full before building a section.**

### 6.0 Login and first run

- **Files:** `AuthenticationView.swift`, `PasswordResetView.swift`, `Views/PolicyAcceptanceView.swift`, `Views/PrivacyPolicyView.swift`, `AppBranding.swift`
- **Login screen:**
  - **Background:** dark gradient with a subtle grid texture and two blurred glows (§4.2).
  - **Logo:** 88px tile (radius 22, cyan border at 25%, cyan glow) with the app logo (64px) inside.
  - **Wordmark:** "PROJECT" (white) over "PLANNER" (cyan), both 30pt black weight with letter-spacing −0.5.
  - **Tagline:** "Built for construction teams" (12pt, uppercase, letter-spacing 1.5).
- **Form:**
  - **Labels:** "EMAIL" and "PASSWORD" (12pt semibold, uppercase, letter-spacing 0.8).
  - **Fields:** 52px tall, radius 14.
    - Email placeholder: "your@email.com".
    - Password placeholder: "Enter your password". The password field has an eye / eye-slash toggle.
  - **Errors:** shown in a red box above the button (text `#FF6B6B`, background red at 10%).
  - **Links and buttons:**
    - "Forgot password?" on the right, in cyan. It opens the "Reset Password" sheet.
    - **Sign In** button: 56px tall, radius 16, blue gradient with glow. It shows a spinner while signing in, and is disabled until both email and password are filled in.
  - **Divider:** a line with the text "New to Project Planner?".
  - **Outlined button:** globe icon and "Set up your organisation on the web", which opens `/setup`.
  - **Footer:** "v{version} · Project Planner".
- **Reset Password sheet:**
  - Title "Reset Password".
  - Text: "Enter your email and we’ll send a link from Firebase to reset your password. Check spam if you don’t see it."
  - Email field and a "Send Reset Link" button.
  - Afterwards: "Check your email" and "If an account exists for {email}, you’ll receive a password reset link shortly.", with a **Done** button.
- **After sign-in:** merge any placeholder user doc (§1.3), load the profile, then show the policy gate if `policyAccepted` is false.
- **Desktop:** centre the form column (max 440px) on the full-bleed dark background. The web's existing `LoginScreen.tsx` / `login.html` should already match; make sure it does.

### 6.1 Clients

- **Files:** `Views/ClientsView.swift` (`ClientsView`, `ClientCardView`, `ClientDetailsView`), `Views/CreateClientView.swift`, `Views/EditClientView.swift`
- **Access:** not operatives. Opened from the Main Menu, the "Clients" quick action, and the `client_created` notification.
- **List screen** ("Clients"):
  - **Toolbar:** "Done" on the left, "New Client" on the right.
  - **Empty state:**
    - A 60pt grey `person.2.fill` icon.
    - "No Clients Added Yet".
    - "Add clients to your organisation. Clients are the companies or individuals you work for."
    - A "Create Client" button.
  - **Client cards:**
    - Name (bold).
    - Email, with a blue envelope icon.
    - Phone on the right, with a green phone icon.
    - Address, with an orange location icon, 2 lines maximum.
    - White background, radius 12, light shadow.
  - Clicking a card opens the detail screen.
- **Detail screen** ("Client Details"):
  - **Toolbar:** "Done" and "Edit".
  - **Info card:** the name in large title style, then email, phone and address.
  - **"Projects ({n})":** lists the client's jobs, filtered by the visibility rules in §1.5.
- **New Client form:**
  - Section "Client Information" with fields: Client Name, Email, Phone, Address.
  - A "Create Client" button, and "Cancel".
  - On success, an alert titled "Client Created".
- **Edit Client form:**
  - The same fields, with "Save Changes" and a red "Delete Client" button.
  - The delete confirmation is titled "Delete Client" with the message "Are you sure you want to delete {name}? This action cannot be undone."
  - **Only admins can delete** (rules).
- **Data:** `clients` (§5.4). Jobs keep their own **embedded copy** of the client (`client` map), so changing a client doesn't update existing jobs unless iOS does that too. Check `Core/ProjectStore.swift` in 3A.
- **Desktop:** master–detail layout. The client list is on the left and the detail on the right, with the client's jobs shown as a grid of work cards.

### 6.2 Projects

- **Files:**
  - `Views/ProjectsView.swift` (list and `ProjectDetailRowView`)
  - `Views/ProjectDetailView.swift` (6,347 lines: the job hub, tasks, filters, completion)
  - `Views/CreateProjectView.swift`, `Views/EditProjectView.swift`
  - `Views/CreateWorkVisibilitySection.swift`, `Views/MapPinPickerView.swift`
  - `Views/ProjectSmallWorksRevampTokens.swift`
  - `Core/ProjectStore.swift`, `Core/WorkAccess.swift`
- **List screen:**
  - **Title:** always "Projects". Menu, tab and quick-action labels use `navigationLabel("dashboard_projects")`, but the page title doesn't.
  - **Toolbar:**
    - Left: a back button (36px white circle with a chevron).
    - Right: a blue 36px "+" circle labelled "New project", shown only if `canManageWorkCatalogue(.projects)`.
  - **Page content, top to bottom:**
    1. **Stats row:** Active, Upcoming and Completed counts.
    2. **Search:** placeholder "Search projects, addresses…". It matches job number, site name, address and client name.
    3. **Filter menu and chips:** "All · n", "Active · n", "Upcoming · n", "Completed · n".
    4. **Work cards** (§4.5). Clicking a card opens the detail screen.
  - **Empty states:**
    - When nothing matches the search: "No projects match your search."
    - When there are no projects: "No projects found", then either "Get started by adding your first project", or, if a status filter is hiding jobs, "The current filter hides older or completed jobs. Choose “All” or “Completed” above to see everything." with a "Show all projects" button.
- **Detail hub** (`ProjectDetailView`):
  - **Toolbar:**
    - Back: a 36px white circle with a chevron.
    - "⋯": only if the user can edit. It opens Edit Project.
  - **Hero card:** job number, job type pill and status pill.
  - **"Manage":** a 3-column tile grid. Each tile has an icon chip, a label and an optional badge:
    - **Scheduling** (badge: items needing attention)
    - **View** (visibility; only if the user can configure it)
    - **My Tasks** (badge: open tasks)
    - **Materials**
    - **H&S**
    - **Deadlines**
    - **Site Audit**
    - **Location**
    - **Active users** (only if the user can see active operatives)

    **Operatives see only:** My Tasks, Materials (if their materials flag is on), H&S, Deadlines, Site Audit (if their siteAudit flag is on) and Location.
  - **"Details":** a summary card with icon rows (client, address, manager(s), timeline "dd MMM yy – dd MMM yy", description), plus an "Edit Project Details" button and Notes.
  - **Tile screens:** see §6.24.
- **New project** ("New project"; the Small Works version is the same with "small works" wording):
  - **Header:** "Create a new project" / "Fill in the essentials, add the rest later", with a "Required fields" note and "REQUIRED" pills.
  - **Required fields:**
    - Project reference
    - Site name
    - Address: the "ADDRESS" block, which can be switched to "MAP PIN SET" via "Set pin on map". When a pin is set, the address fields are hidden and a two-line hint shows: "Address fields hidden" / "Tap to show address line 1–2, town / city, and postcode".
      - The address lines are: Address line 1, "Address line 2 · Optional", Town / City, Postcode.
  - **Dates:** Start date (green chip) and End date (flag icon, coral chip), with "Duration: {summary}".
  - **Client:** a picker, with a "Create client…" option.
  - **"Job type · Optional":** chosen from `settings/jobTypes`, with a "Manage…" link.
  - **Manager:**
    - Add managers one at a time from a menu. Each added manager appears as a chip with a remove button.
    - The menu also has "Create…" and "Create manager…". It shows "All managers added" when there are no more to add.
  - **Visibility:** `CreateWorkVisibilitySection`.
  - **Notes/scope:** placeholder "Add notes, scope, key contacts or anything else the team should know about this project…".
  - **Buttons:** "Create project"; "Cancel" at the top.
  - **Saved values:** `manager: "Custom"`, `managerIds` = the selected roster managers, `isLive: true`.
  - **Afterwards:** a `project_created` notification is created. Check `NotificationService` in 3A.
- **Edit project** (`EditProjectView`; the screen title is `screenTitle`):
  - Subtitle: "Update details, dates and team".
  - Fields: Project reference, Project name.
  - **Location mode:** a segmented control switches between address and map pin ("No pin set yet" → "Set pin on map"). The "Set address" sheet is a quick address form.
  - Start and end dates, with "Project duration: {m} months, {d} days".
  - Client, Job type ("Manage job types…"), Manager chips, Notes.
  - Buttons: "Save" and "Cancel".
- **Rules to keep:**
  - The project list excludes small works.
  - Status is calculated, not stored.
  - Progress is based on time elapsed.
  - Deleting a project is admin-only.
  - A project can have at most 500 tasks.
- **Desktop:**
  - **List:** stats, search and chips in a header area, then a 2–3 column card grid.
  - **Detail:** the hub layout from §3.3.
  - **Create and edit:** an 800px modal with 2-column rows (reference + site name; town + postcode; start + end date).
- **Read in 3A:** all of `ProjectDetailView.swift`, section by section (scheduling ~L700+, tasks ~L2400+, visibility ~L2517, task creation ~L3369, editing ~L4354, completion ~L4652, completed detail ~L5496).

### 6.3 Small works

- **Files:** `Views/SmallWorksView.swift`, `Views/CreateSmallWorksView.swift`. The detail screen is the same `ProjectDetailView`, whose root title changes for small works.
- **How it differs from Projects:**
  - It uses the `smallWorks` collection with `jobType: "Small Works"`.
  - Page title: always "Small works". Menu labels use `navigationLabel("dashboard_small_works")`.
  - Search placeholder: "Search small works…".
  - Empty-state text: "No small works found" and "Add small works via the menu on the home screen."; "Show all small works".
  - Create screen: "New small works", "Create a new small works job", "Create small works", "…about this job…".
  - The site map shows small works with **red** pins.
  - Create access is gated by `canManageWorkCatalogue(.smallWorks)`.
- **In memory, small works are a subset of `projects`.** Never concatenate the two lists (`ProjectWorksMerge`).

### 6.4 Operatives (the "Manage Operatives" tab)

- **Files:**
  - `Views/OperativesView.swift` (`OperativesView`, `OperativeUserRowView`, filters, Add/Edit Operative, `FinishOperativeSetupView`, `PendingUserRowView`)
  - `Views/OperativeProfileView.swift`, `Views/CreateOperativeView.swift`, `Views/ManageOperativesSearch.swift`, `Views/OperativeQualificationsEditorView.swift`
  - `Core/OperativeStore.swift`
- **Access:** `canViewOperatives`. Page title: "Manage Operatives".
- **Screen layout, top to bottom:**
  1. **Segment tabs:** Active, Inactive, Pending.
     - Active and Inactive list the **user accounts** in operative mode, matched by `isActive` and `passwordSet`.
     - Pending lists invited users who haven't set a password yet.
  2. **Live search:** "Search operatives by name".
  3. **Filter sheet:** "Filter" / "Filter Operatives". Filter by First Name, Surname, Email, Start Date, Qualifications or Day Rate, with a text field. While a filter is active, a banner reads "Filter: {type} - {text}" with a "Clear" button.
  4. **Rows:** show badges "Pending" / "Inactive". Swipe (desktop: row menu) to delete.
- **Deleting:** the confirmation reads "Are you sure you want to delete {name}? This will also delete {n} booking. This cannot be undone.", with "bookings" when there's more than one. With no bookings, it reads "Are you sure you want to delete {name}? This cannot be undone."
- **Opening a row:** shows `OperativeProfileView` ("Profile"; "Close"; a settings button that opens Edit). It contains:
  - status chips: active or paused, and password set or pending
  - details
  - qualifications with "View certificate" links; empty state "No qualifications yet" / "Add them from Edit when needed."
- **Roster detail row** (`OperativeDetailRowView`):
  - Day rate as "{symbol}{rate}/day".
  - Qualifications with "Expires: {date}", showing up to 4 plus "+{n} more".
- **Add / Edit Operative forms:**
  - "Personal Information": First Name, Last Name, Email, Phone, Start Date, and (Edit only) Active.
  - "Qualifications".
  - Trade section.
  - "Additional Info": "Day Rate (e.g., £45, $50)", Notes.
  - Edit only: a "Delete Operative" button.
- **Finish setup:** `FinishOperativeSetupView` lists roster operatives with incomplete profiles.
- **Two layers of data:** the **account** (`users`, operative mode) and the **roster record** (`operatives`, matched by email). Editing an operative account uses the same `EditUserView` as Manage Users (§6.16). Managers who have the `operatives` flag can edit only a limited set of fields (see the rules list in `firestore.rules` `canManagerUpdateOperativeProfile`).
- **Desktop:** table view (§3.3). The profile opens in a right-hand drawer (560px) or on its own page.

### 6.5 Managers

- **Files:** `Views/ManagersView.swift` (`ManagersView`, `ManagerUserRowView`, `ManagerFilterOptionsView`), `Views/CreateManagerView.swift`
- **Access:** admin only (`canViewManagers`).
- **Header:** a custom header with a back chevron, the static title "Managers", and a filter button. Menu labels use `navigationLabel("dashboard_managers")`.
- **Screen layout:**
  - **Segments:** Active, Inactive, Pending.
  - **Who's listed:** **user accounts** with the `manager` flag. Admins, super admins and operatives are excluded; admins appear under Manage Users → Admins.
  - **Empty states:** "No Managers Added Yet", "No Active Managers", "No Inactive Managers", "No Pending Managers".
  - **Rows:** "Admin" and "Pending" badges. Clicking a row opens the profile or edit sheet.
  - **Filter sheet** ("Filter Managers"): filter by First Name, Surname, Email or Mobile Number, with a text field.
- **Create form ("New Manager")** creates a **roster** manager (`managers` collection):
  - Heading: "Create New Manager" / "Add a new manager to your organisation."
  - Fields: First Name *, Last Name *, Email *, Mobile Number *, trade, "Department (Optional)", "Notes (Optional)".
  - Button: "Create Manager".
- **Desktop:** table view, as for Operatives.

### 6.6 Annual leave

- **Files:**
  - `Views/HolidayView.swift` (`HolidayView`, `HalfDayHolidayBookingEditorSheet`, rows)
  - `Views/OperativeAnnualLeaveViews.swift` (hub, directory, approved list, requests list, per-person calendar)
  - `Views/AnnualLeaveUsageHeroView.swift`, `Views/AnnualLeaveCalendarDayDecorations.swift`, `Views/AnnualLeaveEntitlementEditor.swift`
  - `Views/HolidayReportView.swift`, `Views/HolidayChrome.swift`
  - `Core/HolidayStore.swift`, `Models/AnnualLeavePolicy.swift`, `Core/AnnualLeaveCalendarRules.swift`, `Core/BankHolidayService.swift`, `Core/BankHolidayRegionDirectory.swift`
- **Access:** `isAnnualLeaveFeatureEnabled`. If leave is turned off for the user, the screen shows "Annual leave is turned off" / "Your organisation has disabled annual leave for this account. Ask an administrator or your line manager to turn it back on in Ma…" (read the full text in 3A).
- **Screen layout** ("Annual leave"):
  1. **Team link** (only with `canAccessOperativeAnnualLeaveDirectory`): a card titled "View and manage user annual leave" / "Book leave and approve requests for your team".
  2. **Segmented control:** "Book" (or "Request" in request mode), "My Annual Leave", "Pending". It only appears for users who request leave for approval or who can approve requests; everyone else stays on Book.
  3. **Book / Request tab:**
     - Usage hero card with allowance, taken, pending and remaining.
     - "Booked annual leave" link (self-service users).
     - A Monday-first month calendar. Days are marked as weekend, bank holiday, taken (green), pending (red) or half day (orange). Tap each day to book.
     - A "Selected days" list.
     - "Duration": Full day, AM or PM.
     - The submit action.
     - Bank holiday legend: "Holidays: {region} · {n} loaded", or "Loading bank holidays…".
  4. **My Annual Leave tab:** the user's bookings; empty state "No annual leave booked."
  5. **Pending tab:** requests; empty states "No pending requests." / "No requests."
- **Other sheets and dialogs:**
  - **"Update booking":** Duration picker. Help text: "Choose full day, AM, or PM. Full days appear solid green on the calendar; half days are orange until you switch to a fu…" (full text in 3A).
  - **"Request cancellation":** shows "Cancellation pending manager approval".
  - **Overlap alert:** "Annual Leave Overlap".
  - **Remove confirmation:** "Remove annual leave?" with the green **Yes** / red **No** buttons (`AnnualLeaveRemoveBookingConfirm`).
- **Rules to keep:**
  - Users who self-book (`annualLeaveSelfBook`, or `hasNoLineManager`) create **approved** bookings directly. Everyone else creates **pending** requests that go to their line manager(s) (`assignedManagerUserIds`); if they have none, requests go to admins.
  - Approving or declining sends `holiday_request_*` notifications.
  - Turning self-book off asks "Turn off Annual Leave Management?". It clears self-booked leave and notifies the user.
  - The leave year runs from `annualLeaveYearStartMonth` to `annualLeaveYearEndMonth` and can wrap around the year end. Carry-over is optional. Half days count as 0.5.
  - Bank holidays come from Nager.Date for the org's region.
- **Desktop:**
  - A two-column page: the calendar (large, 7 columns) on the left, and the hero plus selected days plus duration plus submit on the right.
  - Team management is a separate page with a people directory and a per-person calendar.
- **Read in 3A:** `AnnualLeavePolicy.swift` in full, `AnnualLeaveCalendarRules.swift`, and `HolidayView.swift` from ~L520 onwards (calendar decorations and submit logic).

### 6.7 Site map

- **Files:** `Views/OrgSitesMapView.swift`, `Core/GeocodingCacheService.swift`, `Core/CountryCapitalDirectory.swift`
- **Access:** admin only. It opens as a sheet titled "Site Map", with "Done" on the left and a loading spinner on the right.
- **Map:**
  - Apple Maps with OpenStreetMap tiles on top, plus compass and scale.
  - **Pins:** one for every **live** job whose `siteAddress` can be geocoded.
    - Colours: Project = blue, Small Works = red, Maintenance = orange.
    - The labels "Project", "Small Works" and "Maintenance" appear in the pin info card.
  - **Initial centre**, first available of:
    1. The org's `defaultLatitude` / `defaultLongitude`.
    2. The geocoded office address.
    3. The capital of the org's country (GB uses London 51.5074, −0.1278).
  - **Zoom:** span 0.12 by default, 0.02 when a pin is selected.
- **Bottom area:**
  - With no pin selected: "Tap a pin to view job info".
  - With a pin selected, an info card shows:
    - **Title row:** the site name and a pin-type capsule.
    - **Info rows:** Job Number, Job Name, Client, Manager, Operatives On Site. Empty values show "N/A".
    - **Date and day navigation:** the day as "EEE d MMM yyyy", with "Previous" and "Next" buttons.
    - **Bookings:** rows like "{AM/PM/…} - {operative name}", or "No bookings for this day."
- **Data:** live jobs, plus bookings on the selected day that aren't cancelled.
- **Desktop:** a full-page map, with the info card as a right-hand panel (380px) instead of at the bottom. Use Leaflet or MapLibre with OSM-style tiles, coloured markers, and a geocoder. Ask Farnie which geocoding provider and API key to use.

### 6.8 Site audit

- **Files:**
  - `Views/SiteAuditView.swift` (hub, browser, project audits, create flow, success screen, project picker, add item, detail)
  - `Views/SiteAudit/SiteAuditRevampViews.swift`, `SiteAuditDesignSystem.swift`, `SiteAuditPDFBuilder.swift`, `SiteAuditMediaProcessor.swift`
  - `Core/SiteAuditOfflineStore.swift`
- **Access:** `canViewSiteAudit`.
  - Operatives see audits that are marked `visibleToOperatives` (a missing value counts as true) **or** that they created themselves, on jobs they can see (`siteAuditsForCurrentUser` ~L180).
  - Managers and admins can change the visibility setting.
  - Who can edit an audit is decided by `canEditSiteAudit`; read it in 3A.
- **Flow:**
  1. **Hub** ("Site Audit"): the text "Capture site evidence, notes, and produce a polished shareable PDF." and three tiles: **New site audit** ("Start a new walkthrough"), **Projects** ("Browse audits by project"), **Small works** ("Browse audits by small works job").
  2. **Browser** ("Projects" / "Small works"): filter chips All, Active, Upcoming, Completed; job list; then the job's audit list. Empty state: "No site audits" / "Create your first audit for this project."
  3. **Create flow**, with Back / Next pills. Types: General, Variations, Snags.
     - **Step 1, details:** Author, date, "Visible to operatives" ("Ops working on this job can view it"), custom title (placeholder "e.g. Plant room snags").
     - **Step 2, items:**
       - **Header:** "Items · {n}".
       - **Adding items:** "Add item" adds one; "Multi-add" picks several photos at once.
       - **While photos are processing:** "Preparing photos — this may take a moment for large batches."
       - **Empty state:** "No items yet" / "Tap Add item for one entry, or Multi-add to pick several photos at once."
       - **Tip:** "Photos get auto-timestamped so the PDF shows when each was taken."
     - **Step 3, preview:** "Site audit report".
  4. **New item** screen:
     - A photo (Retake / Library, or "Add photo").
     - Title (placeholder "Front courtyard"), Notes ("Notes…"), Location ("e.g. Front entrance courtyard").
     - Assignee ("Name") and Annotations ("Notes on photo").
  5. **Success screen:** "Audit submitted" (or "Audit updated"), a PDF card with "Download", and "Tap Done to return to audits list".
  6. **"Audit detail":** item photos open full screen with a Close button.
- **Data and files:**
  - `siteAudits` (§5.4).
  - Photos go to Storage at a maximum of 1280px and JPEG quality 0.72; photos embedded in the PDF are at most 720px.
  - The PDF layout is in `SiteAuditPDFBuilder.swift`. Port it faithfully, including the organisation abbreviation badge (`documentAbbreviation`).
- **Desktop:** the create flow is a full page with a left stepper. Items appear as a photo grid (3–4 columns) with an item editor drawer. Multi-add accepts a file picker or drag-and-drop.

### 6.9 Timesheets (iOS `InvoicingView`)

- **Files:**
  - `Views/InvoicingView.swift`, 5,383 lines. It contains: `InvoicingView`, `MyTimesheetsHubView`, `MyTimesheetView`, `PreviousTimesheetsView`, `OperativeTimesheetsView`, `OperativeTimesheetReviewView`, `TimesheetMoneyEntrySheet`, `SignTimesheetView`, `ManagerTimesheetSignOffView`, `InvoiceUTRBlankWarningSheet`, `InvoiceGeneratedSuccessSheet`, `GenerateInvoiceView`, `TimesheetSignaturePad`.
  - `Views/TimesheetManagerReviewSupport.swift`, `Views/OrganisationInvoicingSettingsView.swift`
  - `Core/TimesheetPayrollPolicy.swift`, `TimesheetPayrollCollector.swift`, `PayrollHoursEngine.swift`, `PayrollRateResolver.swift`, `InvoicingPeriodResolver.swift`, `PayrollTimePolicyCatalog.swift`, `WeeklyReportExportBuilder.swift`
- **Access:** `canAccessTimesheetsSurface`. The page title is "Timesheets".
  - **Self-employed users** get **My Timesheets**.
  - **Managers and admins** with operatives assigned to them also get **Operative Timesheets**.
  - **PAYE users** keep access until their open pay run is paid. After that they see the message "Timesheets follow employment type", with the text "My Timesheets is for self-employed pay. PAYE accounts keep the current pay run until it is paid, then schedule hours no longer fill the ne…" (full text in 3A).
- **Hub:**
  - A "CURRENT PAYMENT RUN" card showing "Day {a} - Day {b}" and "Paid on day {x & y}" (or "Paid every {weekday}").
  - Manager tiles:
    - "My Timesheets": "Your own hours, expenses and price work".
    - For admins, "User Timesheets" ("Review, sign off and export company timesheets"); for managers, "Operative Timesheets" ("Review, sign off and export your team's sheets"). Either shows a "{n} new" badge when timesheets are waiting.
  - A "Previous Timesheets" link ("View previous payment runs and statuses.").
- **Timesheet screen** (`MyTimesheetView`, "Timesheet"):
  - **Hours from the schedule:** hours come automatically from schedule bookings (site, office, site survey and other entries) for the pay period. If there are none: "No bookings found for this payment period yet…".
  - **Totals:** "Hours subtotal"; add-on tiles "Price Work" ("Agreed extras") and "Expenses" ("+ receipts"); "Note to manager"; "Total" (with "Includes line manager adjustments" when that applies).
  - **Actions:**
    - "Add price work"
    - "Add expense" (can be accepted with "Accept — add anyway" / "Decline")
    - "Sign timesheet": opens a signature pad and saves a base64 PNG
  - **Status lines:**
    - "Signed by {name} on {date}"
    - "Manager: {name} · {date}"
    - "Timesheet pending manager signature — Generate Invoice unlocks after your line manager counter-signs."
    - "Re-sign your timesheet to generate an invoice."
  - **Invoice:** "Generate Invoice" leads to "Before you invoice" (a warning if the UTR is blank), then "Invoice" (PDF success).
- **Manager review** ("Review Timesheet"):
  - For each payroll line: approve, decline, edit hours or change the amount.
  - Expenses and price work have their own decisions.
  - Manager sign-off ("Sign Off") and export.
  - Notifications `timesheet_pending_manager_signoff` / `timesheet_signed_by_manager` drive deep links.
- **Data:**
  - `settings/timesheet_{uid}_{weekStartEpoch}` (§5.4).
  - Bookings, manager site bookings, rate history, and the org's `invoicing` and `payrollTimePolicy` settings.
  - Export PDFs go to Storage `timesheetExports/`, and emails go through the email function.
- **Desktop:**
  - **Hub:** cards laid out in a grid.
  - **Timesheet:** a two-column page, with the day-by-day hours table on the left and the add-ons, totals, signatures and actions on the right.
  - **Manager review:** a wide table with inline decision controls.
- **Read in 3A:** port the payroll engine files as pure TypeScript with unit tests *before* building the UI (§7).

### 6.10 Qualifications

- **Files:**
  - `Views/QualificationsManagementView.swift` (hub, `AddQualificationView`, `EditOrganisationQualificationView`)
  - `Views/OperativeQualificationsEditorView.swift`, `Views/AssignQualificationsPickerView.swift`
  - `Views/HomeView.swift` `OperativeQualificationsReadOnlyView` ("My Qualifications")
  - `Core/QualificationsAccessPolicy.swift`
- **Access:**
  - Admins, and managers who have the `qualifications` flag, see a segmented control: "Organisation Qualifications" / "My Qualifications".
  - Other managers see only My Qualifications.
  - Operatives use "My qualifications".
- **Organisation tab:**
  - **Header:** "Add" button.
  - **Empty state:** "No Qualifications Added Yet" / "Add organisation qualification templates. Staff can then assign them on My Qualifications, with their own expiry dates and c…" (full text in 3A), and "Create New Qualification".
  - **"Add Qualification":** section "Qualification Details" with a "Qualification Name" field, and the note "Expiration dates and certificates are set when someone assigns this qualification on My Qualifications."
  - **"Edit Qualification":**
    - Fields: Name.
    - "Delete Qualification", with the note "Deleting removes this template from the organisation list. Existing assignments on staff profiles are not automatically remo…".
    - Confirmation message: "This cannot be undone."
- **My Qualifications tab:**
  - **Current qualifications:** empty state "You have not added any qualifications yet. Tap Add qualifications to pick from your organisation list, then set ex…".
  - **Adding:** "Add qualifications" opens a picker of organisation templates ("Add qualifications").
  - **Each qualification has:**
    - an "Expiry date" picker
    - "Upload Certificate" (with the note "PDF or JPEG only · max 10MB")
    - status text: "Ready to upload: {file}" / "Tap Save to store this certificate on your qualifications.", then "Certificate uploaded"
    - "View certificate" (in-app viewer) and "Remove Certificate"
  - A list filter is available.
- **Data:**
  - `qualifications` (the organisation templates).
  - The person's **roster operative** record: `qualifications[]`, `qualificationExpiryDates{}` and `qualificationCertificateURLs{}`, matched to the user by email. If there's no match, the screen shows "No operative record matches your email. Ask an admin to check your account email matches your operative profile."
  - Certificates are stored at the Storage path in §5.5.
  - Expiry reminders appear as `qualification_expiry` notifications, and as a "{n} expiring" badge (expiry within 30 days).
- **Important:** turning the `qualifications` permission on or off must **never** change the organisation templates or anyone's assigned qualifications (`Core/UserStore.swift` comment ~L524).
- **Desktop:** tabs across the top. The organisation tab is a list plus an editor side panel. My Qualifications is a card grid, with certificate upload by drag-and-drop.

### 6.11 Job types

- **Files:** `Views/JobTypesManagementView.swift` (`JobTypesManagementView`, `AddJobTypeView`). The store logic is in `Core/ProjectStore.swift` (`addJobType` / `removeJobType`).
- **Access:** admin only. Page title: "Job Types Management" (large).
- **List screen:**
  - **Empty state:**
    - "No Job Types Added Yet"
    - "Add job types that you can assign to your projects. These will appear as options when creating or editing projects."
    - "Recommended: Create job types like 'CAT A', 'CAT B', 'Small Works', 'Maintenance', or any custom types you use."
    - "Add Your First Job Type"
  - **List:** a purple folder icon and the name, sorted alphabetically. Swipe to delete (on desktop, use a row menu).
  - **Toolbar:** "Add Job Type".
- **Add screen:**
  - "Add New Job Type" / "Enter the name of the job type you want to add for your projects."
  - Field "Job Type Name" (placeholder "e.g., Renovation, New Build, Repair").
  - Button: "Create New Job Type".
- **Data:** the `settings/jobTypes` document (`jobTypes` string array; **the whole document is overwritten** on save). The chosen job type is saved on each job as `customJobType`.
- **Desktop:** a compact centred card (max 720px) with an inline add field.

### 6.12 Wholesalers

- **Files:**
  - `Views/WholesalersView.swift` (tab wrapper, contact add/edit)
  - `Views/WholesalersRevampViews.swift` (`WholesalersListContent`, `WholesalerListCard`, `WholesalerDetailView`, `WholesalerSendHistoryView`, `WholesalerEditorSheet`)
  - `Views/EditWholesalerView.swift`, `Views/SendToWholesalerView.swift`
- **Access:** `canAccessWholesalers` (admins and managers). Order and quote history also needs `canViewWholesalerOrderHistory`.
- **List screen** ("Wholesalers"):
  - "Add wholesaler" card.
  - Section heading "YOUR WHOLESALERS".
  - Search: "Search by name, trade or contact…".
  - Cards show a "PRIMARY" contact tag.
  - Empty state: "No wholesalers yet" / "Add your first wholesaler to send material orders and quote requests from your projects."
- **Detail screen** ("Wholesaler"):
  - **"Quote & order history"** ("Search sends across all projects and small works").
  - **"CONTACTS · {n}"** with a PRIMARY tag. Empty state: "Add your first contact in Edit."
  - **"DETAILS"**, including "ACCOUNT NUMBER".
  - **"RECENT ACTIVITY"**.
- **History screen** ("{name} history"):
  - A Type picker (quotes / orders).
  - A filters section: "Filter by materials day" with a date, and a search box "Search materials (name, brand, code)".
  - Row text: "Materials day: {date} · by {sender}".
  - Empty state: "No {type} match your filters".
  - A "Clear" button resets the filters.
- **Editor** ("Add Wholesaler" / "Edit Wholesaler"):
  - **Contacts:** each has Name and Email.
    - "Make primary" sets the primary contact, labelled "PRIMARY · order & quote emails go here".
    - "Add contact" adds another. Validation: "Add at least one contact with name and email."
  - **Delete:** "Delete Wholesaler", confirmed with "Are you sure you want to delete {name}? This cannot be undone."
- **Data:** `wholesalers` and `materialSendRecords`.
- **Desktop:** master–detail layout. History opens as a wide table.

### 6.13 Material catalogue (and project materials)

- **Catalogue files:**
  - `Views/MaterialsCatalogueFlow.swift` (`MaterialCatalogueRootView`, `MaterialCatalogueEditorSheet`, `MaterialCatalogueDetailView`, `MaterialCatalogueBulkImportView`, `MaterialCatalogueReplaceConfirm`)
  - `Core/MaterialCatalogStore.swift`, `Core/MaterialCatalogCSV.swift`, `Core/MaterialCatalogDuplicateDetection.swift`
- **Access:** `canManageMaterialCatalogue` (admins and managers).
- **Root screen** ("Material catalogue"; "Done"):
  - A "CATALOGUE" section with search ("Search by name, brand or code").
  - Rows show "Size: …" and "Length: …".
  - Empty state: "No catalogue items yet" / "Add materials manually or update the catalogue from a CSV."
- **Editor:**
  - **Fields:**
    - Name
    - Category (required; placeholder "e.g. Electrical")
    - Brand
    - Product code
    - "DEFAULT TYPE": Number, Box, Length, Drum or Pallet
    - Size (optional)
    - Length with a unit (M or MM)
  - **Buttons:** "Save" / "Cancel".
  - **Duplicate alert:** "Duplicate material", with "Cancel" or "Add anyway".
  - **Error alerts:** "Could not save material" / "Could not delete material".
- **Detail screen** ("Item details"):
  - Shows "Code: …".
  - Buttons: "Close" / "Edit".
  - Remove confirmation: "Remove from catalogue?" with "Remove" / "Cancel".
- **CSV import screen** ("Catalogue CSV"):
  - **"STEP 1 · DOWNLOAD":**
    - "Download Material Catalogue" (shows the warning "⚠️ CSV Warning … save the file as csv and not .xls (excel) or .numbers").
    - "Download blank template" ("Headers only — use this to start a brand new list").
  - **"STEP 2 · UPLOAD UPDATED CATALOGUE".**
  - **"STEP 3 · REPLACE ENTIRE CATALOGUE",** which shows a replace confirmation.
  - **Tips:** "Edit on a laptop if you can, then save as .csv and upload here. Leave Catalogue ID blank for brand new rows."
  - **Limits:** 5MB maximum. Import errors appear in an "Import error" alert.
  - **CSV header (exact):** `Catalogue ID,Name,Category,Manufacturer/Brand,Product Code,Default Type (Length Drum Box Pallet or Number),Size,Length,Length Unit (M or MM)`
  - **File names:** `material_catalogue.csv` and `material_catalogue_upload_template.csv`.
- **Project materials** (the Materials tile, §6.24):
  - **Files:** `Views/MaterialsView.swift`, `MaterialsProjectListUI.swift`, `MaterialsAddWithCatalogueSheet.swift`, `MaterialsSendListSheet.swift`, `SendToWholesalerView.swift`, `EditMaterialView.swift`, `AdminManagerMaterialsView.swift`, `Core/MaterialRequestEmailBuilder.swift`, `Core/OfflineMaterialLocalStore.swift`, `Core/MaterialOfflineService.swift`
  - **Layout:** a week navigator and day strip, then material line cards with a status pill (draft / sent for quote / ordered).
  - **Adding:** add from the catalogue or add free text.
  - **Sending:** "Send list" (quote or order) to the chosen wholesaler contacts by email, through the email function, using the HTML built by `MaterialRequestEmailBuilder`. Each send writes a `materialSendRecords` doc and updates `lastSentAt` and `status` on the lines.
  - **"Review materials"** lets the user include or exclude lines when resending.
  - **Operatives** with the materials flag can add lines but **can't send quotes or orders**.
  - **Material cut-off reminder:** see §6.17.
- **Desktop:**
  - **Catalogue:** a data table (name, category, brand, code, type, size, length) with inline search and a side editor.
  - **CSV:** a drag-and-drop upload area.
  - **Project materials:** a week grid with a lines table, and the send panel on the right.

### 6.14 Sub contractors

- **Files:** `Views/SubcontractorsView.swift` (`SubcontractorsView`, `SubcontractorFirmDetailView`, `SubcontractorFirmEditorView`, `SubcontractorOperativeEditorSheet`), `Views/ScheduleSubcontractorView.swift`, `Views/SubcontractorBookingEditSheet.swift`, `Core/SubcontractorStore.swift`
- **Access:** `canManageSubcontractors` for the directory. Booking sub contractors onto jobs stays available to managers.
- **List screen** ("Sub contractors", with a custom Back button):
  - Section heading "YOUR SUB CONTRACTORS".
  - Search: "Search firms or trades…".
  - Empty state: "No sub contractors yet" / "Add your first sub contractor to start booking them to projects and small works."
  - Cards have a "More" button.
- **"Firm details" screen:** firm info and an operatives roster. Empty state: "No operatives added yet."
- **Firm editor** ("New sub contractor" / "Edit sub contractor"):
  - Fields:
    - "Sub Contractor Name *"
    - "Trade *": suggestions come from `settings/tradeTypeInventory`, with "Search trade type suggestions".
    - "Website · optional"
    - "Address · optional"
  - Operatives section labelled "Names only · no logins".
  - Buttons: "Save" / "Cancel".
- **Operative editor** ("Add operative" / "Edit operative"):
  - Shows "Adding to this firm's roster".
  - Fields: name, email, contact number, position, trade.
- **Booking:** "Schedule Sub Contractor" books the firm onto a job for chosen dates and slots and picks contacts (`subcontractorBookings`).
- **Desktop:** master–detail layout, with the roster shown as a table.

### 6.15 Add user

- **Files:** `Views/AddUserView.swift` (with `PermissionToggle`), `Views/LineManagersMultiSelectSheet.swift`, `Views/StaffTradeTypeFormSection.swift`, `FirebaseBackend.swift` `createUserInvitation` ~L4672, `Models/UserRoleTransitionPolicy.swift`
- **Access:** `canManageUsers`. Managers who have the `operatives` flag use a 3-step variant, "managerAddingOperative": operatives only, with the manager pre-selected as line manager.
- **Wizard layout:**
  - Header with "Cancel" and "Step {n}/{total}", plus progress dots.
  - A footer with Back / Next.
  - **Steps for admins:**
    1. **"Account Type":** Administrator, Manager or Operative. Note: "Choose what kind of account this will be. Super admin is never assigned from here."
    2. **"User Details":**
       - First Name, Surname, Email Address, Mobile Number.
       - Employment Type: segmented, **Self-Employed** (the default) or **PAYE**.
       - Trade.
       - "Day rate (optional)" (placeholder "e.g. 250").
       - "VAT number (optional)", "UTR number (optional)".
       - A timesheets note.
       - "Line manager(s)", which opens a multi-select.
    3. **"Permissions":** a list of `PermissionToggle` rows. The rows and their descriptions depend on the account type (copy them exactly from ~L650–810):
       - **Administrator:** Admin Access, Operative Management, Manage Qualifications, Projects, Small Works, Operative Mode ("Off for admin accounts."), Annual Leave Management.
       - **Manager:** Operatives, Annual Leave Management, Weekly Report, Daily Overview, Sub Contractors, Manage Qualifications, Projects, Small Works, Operative Mode ("Off for manager accounts.").
       - **Operative:** operative mode explanation, then Materials ("…They will not be able to send quotes or place orders.") and Site Audit.
       - **Annual leave:** days per year (default 25), start and end month, carries over.
    4. **"Review":** "Review before sending the invitation". It shows Account (Type, Name, Email, Employment type, Mobile, Line manager, Day rate, Trade, Annual leave: "{n} days / year", "{Start} → {End}") and a "Permissions summary".
  - **Success screen:** "User Created Successfully!" / "An invitation email has been sent to {email}", with a "Done" button.
- **Permission presets** (`applyPermissionsForInvitedType` ~L1006):

| Preset | Flags turned on | Flags turned off |
|---|---|---|
| **Administrator** | adminAccess, manager, operatives, qualifications, materials, projects, smallWorks, weeklyReports, dailyOverview, wholesalersOrderHistory | — |
| **Manager** | manager, qualifications, materials, dailyOverview, siteAudit, wholesalersOrderHistory | operatives, projects, smallWorks, weeklyReports, subContractors |
| **Operative** | operativeMode, projects, smallWorks, … | Read the rest at ~L1042 |

- **What happens on submit** (same mechanism on the web; **no Auth account is created here**):
  1. **Duplicate check.** If a `users` doc already exists with the same email (lowercased) and `organizationId`, stop with the error: "A user with the email address '{email}' already exists in this organization. Each email address can only be used once per organization."
  2. **Invitation.** Write `invitations/{UPPERCASE-UUID}`.
  3. **Placeholder account.** Write `users/{new UUID}`, with the role taken from the flags (admin, then manager, then operative, otherwise basic) and `passwordSet: false`. The new user then appears under **Pending**.
  4. **Email index.** Write `organizations/{orgId}/userEmails/{emailLower}` = `{userId}`.
  5. **Invitation email.** Send it through the email function. It links to `/setup-password.html?token={invitationId}`.
  6. **Notification.** An `operative_created` or `manager_created` notification is created (check `NotificationService` in 3A).
- **Desktop:** an 800px modal wizard with a left step rail. Show the details fields in 2 columns.

### 6.16 Manage users

- **Files:** `Views/ManageUsersView.swift` (3,762 lines: `ManageUsersView`, `ManageUserRowView`, `EditUserView`, `TabButton`), `Views/ManageUserProfileChrome.swift`, `Views/HolidayReportView.swift`, `Core/UserStore.swift`, `Models/UserRoleTransitionPolicy.swift`
- **Access:**
  - `canManageUsers`: page title "Manage Users".
  - Managers with the `operatives` flag: page title "Manage Operatives", operatives only.
  - Anyone else sees: "Only users with admin access can manage users. If you need access, ask an administrator."
- **List screen:**
  - **Toolbar:** "Done" and "Add".
  - **Role tabs:** Admins, Managers, Operatives.
  - **Status segments:** Active, Inactive, Pending.
  - **Search.** Empty state: "No matches for “{q}”" / "Try another spelling, first name, surname, or email."
  - **Empty list:** "No {segment} {role}".
  - **No users at all:** "No Users Yet" / "Add your first user to get started" / "Add First User".
  - **Rows** (`ManageUserRowView`):
    - avatar, name and badges
    - employment type, with a date sheet ("Employment Type Date")
    - quick email actions
- **Delete confirmation:** there are several wordings, depending on bookings and whether the user is an operative (~L120–170). The organisation creator can't be deleted: "Cannot delete the organization creator."
- **Edit user** (`EditUserView`), in card sections:
  - **"User details":** name, email, mobile; day rate **or** hourly rate (with the note "Payroll uses either a day rate or an hourly rate, not both…"); "Previous day rates"; trade; line managers; Qualifications.
  - **Operative setup section.**
  - **"Billing details":** VAT and UTR.
  - **"Annual leave in app":** "Annual leave enabled" ("Turn off for self-employed staff who do not use paid annual leave").
  - **"Annual leave":** entitlement editor.
  - **"Permissions":**
    - The toggles depend on the user's type (see Add user).
    - The organisation creator is shown as "Super Admin": "This user is the organization creator. Core permissions cannot be changed."
    - A limited view for managers who have the `operatives` flag.
    - "Wholesalers (order & quote history)", "Materials (operative)".
  - **"Account status":** "Active" ("User can sign in and use the app").
  - **"Account actions":**
    - "Send password reset", or resend the invite if they're still pending
    - "Make Super Admin" (this transfers ownership)
    - "Annual leave report"
    - "Change user type" ("Switch between operative, manager, or administrator")
    - Deactivate ("Suspend access, keep history")
    - "Delete user" ("Permanently remove account")
  - **Confirmation dialogs:**
    - "Deactivate user?", "Change Employment Type?", "PAYE day rate"
    - Day-rate effective date: "Today" / "Tomorrow"
    - "Turn off Annual Leave Management?"
    - "Make this user an administrator?"
  - **Profile photo:** "Take Photo" / "Photo Library".
- **Rules to keep:**
  - Role changes follow `UserRoleTransitionPolicy`, which keeps `role`, the flags and annual-leave behaviour consistent. Switching a user onto self-booking deletes their pending holiday *requests*; approved bookings are never deleted.
  - Day-rate changes write to `operativeDayRateHistory`.
  - Employment-type changes can be scheduled (`employmentTypeTransitionFrom` / `employmentTypeEffectiveAt`).
  - Only the organisation creator can be super admin. iOS demotes any other super admin (`enforceSingleSuperAdminInFirestoreIfNeeded`).
- **Desktop:** a table with role tabs and status segments. Clicking a row opens `/users/[uid]` as a two-column profile page: details and permissions on the left, account status and actions on the right.

### 6.17 Settings

- **Files:**
  - `Views/SettingsView.swift`, `Views/SettingsHubSupportViews.swift` (`SettingsProfileDetailView`, `SettingsNotificationsHubView`), `Views/SettingsHubChrome.swift`
  - `Views/OrganisationSettingsHubView.swift`, `Views/CompanyDetailsEditView.swift`, `Views/OrganisationCurrencyView.swift`, `Views/OrganisationWorkingHoursView.swift`, `Views/OrganisationAnnualLeaveDefaultsView.swift`, `Views/GeneralAppSettingsView.swift` (`MyScheduleGeneralOptionsView`), `Views/OrganisationWarningsSettingsView.swift`, `Views/OrganisationMaterialCutOffSettingsView.swift`, `Views/OrganisationInvoicingSettingsView.swift`
  - `Views/AppearanceSettingsView.swift`, `Views/ChangePasswordView.swift`, `Views/SwitchOrganisationView.swift`, `Views/HelpView.swift`, `Views/PrivacyPolicyView.swift`
- **Settings hub** ("Settings"; back chevron):
  1. **Profile card.**
  2. **"Personal":**
     - **"Switch organisation"**, subtitled with the current org.
     - **"My profile"** ("Name, photo, contact details"): profile image ("Used across Home and Settings", "Change"), details, and "Billing details" (VAT, UTR).
     - **"Appearance"**, subtitled with the current theme: Light, Dark or Match system.
     - **"Sign-in & password"** ("Email, password, security"): "Change Password" with Current Password, New Password and Confirm New Password, then "Password changed successfully".
     - **"My notifications"** (not for operatives; "Material cut-off reminder").
  3. **"Company-wide"** (admins only): the **"Organisation Settings Hub"** promo card. Beneath it: "Tap to manage how {org} runs — affects everyone in your team."
  4. **"Support & legal":**
     - "Help & support" ("Get in touch, browse FAQs")
     - "Privacy & terms" ("Legal information")
  5. **Sign out**, with the confirmation "Sign Out" / "Are you sure you want to sign out?".
  6. **Footer:** "Project Planner · v{version}".
- **Organisation hub** ("Organisation", breadcrumb "Settings ›"):
  - **Header:** a company card ("{country} · Company") and an "OWNER & SUPER ADMIN" row ("· you").
  - **Rows:**

| Row | Opens | What it does |
|---|---|---|
| **Company details** ("Name, logo, address") | `CompanyDetailsEditView` | Company name; abbreviation (1–3 characters, "Only 3 characters for the abbreviation"); "Organisation has an office address" toggle, Country, address lines, "Map default: …"; company logo ("Upload logo (JPEG)", "Remove logo") |
| **Currency** | `OrganisationCurrencyView` | Currency picker with a preview; "Save currency" |
| **Working hours & overtime** | `OrganisationWorkingHoursView` | Edits `payrollTimePolicy`: standard day, break, weekday overtime multiplier, Saturday/Sunday rules, timeline preview. Changes can take effect now or on a scheduled date ("Schedule change"). Read it fully in 3A. |
| **Annual leave** | `OrganisationAnnualLeaveDefaultsView` | "Bank holiday region" and "Default annual leave for new users"; "Save settings" |
| **Schedule options** | `MyScheduleGeneralOptionsView` | "Additional Options" toggles (Office, Working From Home, Site Survey) and "Custom Items" (add with "Item name"). Saved to `settings.myScheduleOptions`. |
| **Warnings** ("Change and alter warning defaults") | `OrganisationWarningsSettingsView` | `warningDetection` settings and "Excluded users" |
| **Material cut-off** | `OrganisationMaterialCutOffSettingsView` | "Remind all managers when materials still need ordering before the daily cut-off."; "Material cut-off notification" ("Email all managers"); "Cut-off time"; "Include Saturday"; "Include Sunday" |
| **Payment Runs and Timesheets** | `OrganisationInvoicingSettingsView` | "Set payment run date ranges" (1–2 ranges, which must cover days 1–31; wrapped ranges allowed; short months are trimmed) or "Choose recurring timeframe" (start/end weekday); "Payment Day/Dates": "Set Payment date/s" or "Recurring payment date"; note to users |
| **Roles & permissions** | `ManageUsersView` | Subtitled with role counts |
| **Delete organisation** ("Permanent · cannot be undone") | Info alert | "Organisation deletion is not available in the app. Contact support if you need to close an account." |

- **Developer tools:** `SettingsView.swift` also contains "Manual Link", "Test Email" and push-diagnostic tools (~L430–680). **Don't port them** unless Farnie asks.
- **Desktop:**
  - `/settings` has a left settings nav (Personal, Company-wide, Support & legal) and the selected page on the right, at most 880px wide.
  - Each organisation page is a card form with a sticky save bar.
  - Suggested routes: `/settings/profile`, `/settings/appearance`, `/settings/security`, `/settings/notifications`, `/settings/organisation`, `/settings/organisation/company`, `…/currency`, `…/working-hours`, `…/annual-leave`, `…/schedule-options`, `…/warnings`, `…/material-cut-off`, `…/payment-runs`, `/settings/switch-organisation`.

### 6.18 Home quick actions (`Views/HomeQuickActionRegistry.swift`)

The tint names below map to these colours: green `#0F6E56`, brown `#854F0B`, rust `#993C1D`, blue `#185FA5`, rose `#993556`, purple `#534AB7`, muted `#6B737D`.

**Tiles for operatives only:**

| ID (saved; never rename) | Title | Symbol | Tint | Shown when | Opens |
|---|---|---|---|---|---|
| `op-projects` | Projects* | `folder.fill` | green | operative | Projects |
| `op-small` | Small works* | `hammer.fill` | brown | operative | Small works |
| `op-leave` | Annual leave | `sun.max.fill` | rust | operative and leave enabled | Annual leave |
| `op-audit` | Site audit* | `doc.text.viewfinder` | blue | operative and siteAudit | Site audit |
| `op-schedule` | My Schedule* | `calendar` | rose | operative | My Schedule |
| `op-settings` | Settings* | `gearshape.fill` | muted | operative | Settings |

**Tiles for everyone else:**

| ID (saved; never rename) | Title | Symbol | Tint | Shown when | Opens |
|---|---|---|---|---|---|
| `staff-weekly` | Weekly report | `chart.bar.doc.horizontal` | blue | not operative and weeklyReports | Weekly report |
| `staff-daily` | Daily overview | `calendar.badge.clock` | purple | not operative and dailyOverview | Daily overview |
| `staff-tasks` | Tasks | `plus.rectangle.on.rectangle` | blue | not operative | Tasks |
| `staff-projects` / `staff-small` | Projects* / Small works* | as above | green / brown | not operative | Projects / Small works |
| `staff-leave` | Annual leave | `sun.max.fill` | rust | not operative, leave enabled, and admin or manager | Annual leave |
| `staff-schedule` | My Schedule* | `calendar` | rose | not operative | My Schedule |
| `staff-audit` | Site audit* | `doc.text.viewfinder` | blue | not operative and canViewSiteAudit | Site audit |
| `staff-managers` | Managers* | `person.badge.key.fill` | purple | admin | Managers |
| `staff-operatives` | Operatives* | `person.3.fill` | green | canViewOperatives | Operatives |
| `staff-subs` | Sub contractors | `person.2.badge.gearshape.fill` | muted | canManageSubcontractors | Sub contractors |
| `staff-map` | Site map | `map.fill` | green | admin | Site map |
| `staff-settings` | Settings* | `gearshape.fill` | muted | not operative | Settings |
| `staff-invoicing` | Timesheets | `doc.text.fill` | blue | canAccessTimesheetsSurface (operatives too) | Timesheets |
| `staff-clients` | Clients | `person.2.fill` | blue | not operative | Clients |
| `staff-create-project` | Create project | `plus.square.fill` | green | can manage projects | New project |
| `staff-create-small` | Create small works | `hammer.fill` | brown | can manage small works | New small works |
| `staff-qualifications` | Qualifications | `graduationcap.fill` | blue | not operative and canAccessQualificationsHub | Qualifications |
| `staff-my-qualifications` | My qualifications | `graduationcap.fill` | blue | operative | My qualifications |
| `staff-job-types` | Job types | `folder.fill` | green | admin | Job types |
| `staff-wholesalers` | Wholesalers | `building.2.fill` | muted | canAccessWholesalers | Wholesalers |
| `staff-material-catalogue` | Material catalogue | `shippingbox.fill` | blue | canManageMaterialCatalogue | Catalogue |
| `staff-add-user` | Add user (managers see "Add operative") | `person.badge.plus.fill` | purple | canManageUsers, or manager with operatives | Add user |
| `staff-manage-users` | Manage users (managers see "Manage operatives") | `person.2.fill` | blue | same as above | Manage users |
| `staff-help` | Help | `questionmark.circle.fill` | muted | not operative | Help |
| `staff-general-app` | General app | `slider.horizontal.3` | purple | admin | General app settings |

**Notes:**

- **\* Shared labels:** these titles use the shared `navigationLabels`.
- **Never shown:** `staff-holiday`, `staff-skills`, `account-reset-password` and `account-sign-out` are barred, so never show them.
- **Default order (operatives):** projects, small works, leave, audit (if allowed), timesheets (if allowed), schedule, settings.
- **Default order (everyone else):** weekly, daily, tasks, projects, small works, leave, schedule, audit, managers, operatives, subs, map, settings, timesheets. Tiles the user isn't allowed to see are left out.

### 6.19 Tasks (`Views/TasksDetailView.swift`, plus task views inside `ProjectDetailView.swift`)

- **Access:** everyone. Page title "Tasks" with a "Done" button.
- **Scope chips:** "Assigned to me", "Active · n", "Overdue · n", "Completed · n".
- **Sections:**
  - "Holiday approvals" (for approvers), shown as `HolidayApprovalTaskCard`.
  - "Qualification reminders".
  - Task cards (`MyTasksRedesignTaskCard`), with a "Carry out" action and a "Pending" state.
  - A "Retry" button appears if loading fails.
- **New task** ("New task"):
  - Heading: "Create a new task" / "Assign to a manager or operative".
  - Title, with the tip "Keep titles short and action-led — \"Replace fuse board\" not \"Some work to do\"."
  - Checklist items: "Add checklist item", with the note "Assignees must tick all items to complete the task."
  - People picker, which can filter by trade.
  - Due date (required: "Every task must have a due date.").
  - Priority.
  - Attachments: images (camera or library), files ("Files up to 10MB. Photos, PDFs, drawings supported."), or a site audit.
  - Button: "Create task". While saving: "Saving…". Until it's valid: "Add a title and assignee to continue".
- **"Complete task" screen:**
  - "CHECKLIST" (required).
  - "PROOF OF WORK": photos and files.
  - "NOTES" (placeholder "Anything the manager should know about how the job went…").
  - If completion fails: "Cannot complete task".
- **Task detail** ("Task"):
  - "Assigned to", "CHECKLIST", "Carry out tasks".
  - "ATTACHMENTS", including "Site audit · Tap to open".
  - "Completed by {name}".
  - "Edit task" button.
- **Filters:** "Task Filters" (All Tasks, By Operative, By Manager, Date Range), with "Reset Filters", "Cancel" and "Apply".
- **Notifications:** creating or completing a task sends `task_created` / `task_completed`.
- **Desktop:** a board-style list with filters on the left, task cards in a grid, and the task detail in a right-hand drawer.

### 6.20 Warnings (`Views/WarningsDetailView.swift`, `Views/WarningsRevampViews.swift`, `Core/WarningsComputation.swift`, `Core/WarningsService.swift`, `Core/WarningsRefreshHelper.swift`, `Core/ScheduleBookingConflictSupport.swift`, `Models/WarningModels.swift`, `Models/OrgWarningDetectionSettings.swift`)

- **Access:** admins.
- **Screen layout:**
  - **Hero card and priority filter chips.**
  - **Empty state:** "No active warnings". The text explains that "High" covers operative, manager and admin booking clashes, plus unbooked labour.
  - **Before the first scan:** "Check for warnings" / "Tap Refresh to scan today and tomorrow. Results are saved so Home and Weekly Report stay fast.", with "Refresh now".
  - **Warning cards:**
    - Actions: "Book labour for this day", "Open daily overview", "Dismiss".
    - Material cut-off warnings add: "Managers should confirm material lists with site teams."
  - **Dismiss dialog:**
    - Title: "Dismiss this warning?"
    - Text: "Are you sure you would like to dismiss this warning? Any warnings that are dismissed will not reappear again…"
    - Note: "All admins will get a notification with who dismissed it…"
    - Buttons: "Dismiss permanently" / "Keep warning".
- **Rules to keep:**
  - Scans are computed on the device and **never run automatically on Home**. Refreshing is manual.
  - The Home badge shows the cached count.
  - **iOS stores dismissals and approvals on the device** (`Core/WarningResolutionStore.swift`, UserDefaults), so they don't sync between devices. See §8.
- **Desktop:** a full page with a filter sidebar and warning cards in 2 columns.

### 6.21 Scheduling and My Schedule

- **Files:**
  - `Views/MyScheduleView.swift` (`MyScheduleView`, manager and operative content, self-booking, `ManagerBookingSheet`, custom hours)
  - `Views/ScheduleOperativeView.swift` ("Schedule booking"), `Views/BookLabourFlowView.swift` ("Book labour"), `Views/SelectOperativesView.swift` ("Select people")
  - `Views/BookingHoursEditSheet.swift`, `Views/ScheduleSubcontractorView.swift`, `Views/ProjectSchedulingV2Support.swift`
  - Clash handling: `Views/BookingClashWarningCard.swift`, `Views/ScheduleOverlapWarningViews.swift`, `Views/ScheduleOperativeConflictViews.swift`
  - `Views/ScheduleCalendarExport.swift`, `Views/BookingConfirmationView.swift`
  - `Core/BookingStore.swift`, `Core/ManagerScheduleStore.swift`, `Core/ScheduleBookingConflictSupport.swift`, `Core/ScheduleDateSelectionPolicy.swift`, `Models/OperativeBookingInterval.swift`, `Models/ManagerScheduleInterval.swift`
- **My Schedule** ("My Schedule"):
  - **Operatives:** view only.
  - **Managers and admins:**
    - **"Book yourself in":** choose a location (project, small works, office, working from home, site survey, or custom items per the org options). Then choose FULL DAY, AM, PM, or Start/End time ("Standard day set: {start}–{end}"), and "Save booking".
    - **"Book" sheet:** "Confirm booking", "Remove booking", "You're already booked here for this slot."
  - **Day view:**
    - "Total hours" card showing "Standard {start}–{end}".
    - "Annual leave" rows.
    - "Bookings", or "No bookings for this day.".
    - Hint: "Tap + Add booking to choose company locations, projects, or small works."
  - **Add to calendar:** Google, Outlook or Apple (`.ics`).
  - **Restriction message:** "Office and site attendance booking is only available to administrators and managers."
- **Schedule booking** (from the job's Scheduling tile), in sections:
  - **DATES:** "DATES · {n} selected". The calendar uses a Monday-first grid. If the user adds people before picking dates: "Select dates first".
  - **OPERATIVES:** "Choose who is on this job. You can set hours per person after they’re selected.", with "Add people".
  - **HOURS · APPLIES TO ALL SELECTED:** Standard day, or Custom with a START time.
  - **Clash review:** "Acknowledge each clash above before you can confirm booking."; "Hours caused clashes".
  - **CONFIRM BOOKING:** Hours / Selected dates / People.
  - **Group bookings:** these share `bookingGroupId`. The day list shows "Group booking · {n} people" with "Edit group".
- **Book labour** (from Daily overview or Warnings):
  - Books unbooked team members for a day, with roles, custom hours and a rectify timeline.
  - "Other" locations need the org's My Schedule options: "Enable at least one location under App & account → General → My schedule to use Other."
- **Payroll consistency:** hours and overtime shown anywhere come from `Core/PayrollHoursEngine.swift` (§7).
- **Desktop:**
  - **Schedule booking:** three columns (dates calendar, people list, hours and confirm).
  - **My Schedule:** a week view with 7 columns and a day detail panel.

### 6.22 Daily overview (`Views/DailyOverviewView.swift`)

- **Access:** `canViewDailyOverview`. Page title "Daily overview", with "Done".
- **Sections for the selected day:**
  - "WHERE THE TEAM IS": project and small-works booking cards, including a "SMALL WORKS" group, plus manager schedule rows.
  - "Unbooked labour", with a "Book labour" button.
  - "Annual leave" (who's on leave).
  - "No bookings" when the day is empty.
- **Past dates:** "Date Overview" ("Select date").
- **Clicking a job:** opens that job's detail page in the Projects or Small Works section (`openWorkCatalogueDetail`).
- **Desktop:** a date picker in the header; job cards in a 2–3 column grid; unbooked labour and annual leave in a right-hand column.

### 6.23 Weekly report (`Views/WeeklyReportView.swift`, `Views/WeeklyReportLaunch.swift`, `Core/WeeklyReportExportBuilder.swift`)

- **Access:** `canViewWeeklyReports`.
- **Branded header:** "PROJECT" wordmark with "WEEKLY REPORT" (navy and cyan palette).
- **Controls:** "Schedule" range selection and a "CURRENT INVOICING PERIOD" shortcut ("Tap to use this range · configured in Settings → Invoicing.").
- **Warnings summary:** "All Clear" / "No warnings for this period", or "Open Warnings" / "View All Warnings".
- **Generate:**
  - "Generate Report", showing "Generating Report…" while it runs.
  - "Generates Excel (.xlsx) and PDF files ready to share."
  - Then "Report Generated Successfully" / "Your weekly report is ready to share.", or "File not ready".
  - Period warnings and pay breakdown are calculated only when the user taps Generate.
- **Desktop:** a full page with the range controls on the left and a preview of the report sections on the right. Downloads give `.xlsx` and `.pdf` files with the same layout as `WeeklyReportExportBuilder`.

### 6.24 Job detail modules (the tiles in `ProjectDetailView`)

| Tile | Files | Notes |
|---|---|---|
| **Scheduling** | `ProjectDetailView.swift` (~L700 on), `ProjectSchedulingV2Support.swift` | Job context card, week picker, two actions (book operatives or book sub contractors), week overview with per-day booking cells and a legend, and a compact/expanded week toggle. Booking hours are edited in `Views/BookingHoursEditSheet.swift` (`OperativeCustomHoursSheet`, `BookingHoursTimelineBar`). |
| **View** (visibility) | `ProjectVisibilitySettingsView` ~L2517 | Title "View". Text: "This feature can be used to select who will not be able to view the project or small works. Admins always have access and canno…". Tabs: Managers / Operatives. Filters: All, Active, Inactive, Pending. Writes `hiddenManagerUserIds` / `hiddenOperativeUserIds`. |
| **My Tasks** | `ProjectDetailView.swift` ~L2400–5500 | The job's task list with scopes and filters, plus creating, editing and completing tasks (§6.19). "Create a task" button. |
| **Materials** | §6.13 | `MaterialsView` for staff; `OperativeMaterialsView` for operatives. |
| **H&S** | `ProjectHealthSafetyView.swift` (3,523 lines), `HSComponents.swift`, `HSHealthSafetyDocuments.swift`, `HSTheme.swift`, `Resources/TOOLBOX-TALK-LIBRARY.md` | Manager tabs: Hub, Library, Tracking, RAMS, Other. Operative tabs: Toolbox, RAMS, Other. Screens: issue a toolbox talk to recipients (filtered by trade), scheduled talks, sign-off tracking, sign a talk (read confirmation plus signature), upload RAMS and other documents, document detail. Stored in `settings/healthSafety_…` and Storage `healthSafety/`. The talk library content is in `Resources/TOOLBOX-TALK-LIBRARY.md`. |
| **Deadlines** | `ProjectDeadlinesView.swift`, `DLScreens.swift`, `DLComponents.swift`, `DLModels.swift` | Deadlines screen (grouping, week rail, timeline, risk banner), detail, reschedule (with a reason, kept in history), edit, attach a site audit. Statuses: Not started, In progress, Blocked, Complete. Progress %, critical flag, dependencies, reminders a set number of days before (local notifications on iOS). Stored in `settings/deadlines_…` and `settings/deadlineAssignments`. |
| **Site Audit** | §6.8 | The audits for this job. |
| **Location** | `ProjectDetailView.swift` ~L1774 | "Site Location" map with directions options. When there's no location: "Site Location not available". |
| **Active users** | `ProjectActiveOperativesView.swift` | Title "Active users": people booked on or assigned to the job (`WorkAccess.liveUserIds`). Clicking a person shows their booking history on the job. |

### 6.25 Notifications (`Views/NotificationsView.swift`, `Core/NotificationService.swift`, `Core/LocalNotificationService.swift`)

- **Page:** "Notifications", with "Done".
- **Sort:** Newest, Oldest, or Date.
- **Empty state:** "No Notifications" / "You're all caught up!".
- **Rows:** clicking a row marks it as read and follows the deep link (§2.4).
- **Who sees what:** the inbox shows notifications targeted at the user, or with no target, filtered by `requiresPermission`.
- **iOS-only local reminders:** material cut-off, qualification expiry and deadline reminders are scheduled on the device. The web has no equivalent unless Farnie approves web push.
- **Desktop:** a slide-over panel from the bell, plus the full `/notifications` page.

### 6.26 Help, privacy, profile, organisation switching

- **Help** (`Views/HelpView.swift`, "Help & FAQs"): quick-link cards, category cards leading to category pages with steps, and FAQ cards. Copy the text exactly.
- **Privacy Policy** (`Views/PrivacyPolicyView.swift`): used in two places:
  - as the acceptance gate (`PolicyAcceptanceView`, "Saving acceptance…"; on failure, the error "Could not save acceptance")
  - as a page under Settings → Privacy & terms
- **My Profile** (from the Home avatar, `HomeProfileCardSheet`):
  - Profile rows and a Settings shortcut, with "Done".
  - Desktop: an avatar menu with the profile summary, "My profile", "Settings", "Sign out".
- **Switch organisation** (`Views/SwitchOrganisationView.swift`):
  - Heading: "Work across teams" / "Choose which organisation you want to use in the app. Your schedule, projects, and settings will update to match."
  - Rows have tags: "Trial", "Locked", "Active".
  - Empty state: "No organisations found" / "If you were invited to another organisation, pull to refresh or sign out and sign in again."
  - After switching, all organisation data reloads (as on iOS).

---

## 7. Business logic to port as pure TypeScript (with unit tests)

Port these **before** building the screens that use them. Keep the function names, write them as pure functions, and put them in `lib/` (e.g. `lib/payroll/`, `lib/leave/`, `lib/warnings/`).

- **Unit tests:** each module gets tests built from cases you read out of the Swift code, including edge cases:
  - weekends, bank holidays and half days
  - days when the clocks change (London time)
  - pay-run ranges that wrap past the end of the month
  - scheduled changes to policy or employment type
  - PAYE days
- **Time zone:** use `Europe/London` for every date calculation.
- **Weeks:** weeks start on Monday.

| Swift file | What it does | Web module |
|---|---|---|
| `Core/PayrollHoursEngine.swift` | The **single** payroll calculation for bookings. It handles slots and custom hours, break deduction, the standard window, weekday overtime outside the window, the Saturday/Sunday rules, and AM/PM paying half the standard day. | `lib/payroll/hoursEngine.ts` |
| `Core/PayrollTimePolicyCatalog.swift` (+ `OrgPayrollTimePolicyScheduledChange`) | Which policy applies on a given day (prior, current or scheduled), and `yyyy-MM-dd` day keys | `lib/payroll/policyCatalog.ts` |
| `Core/PayrollRateResolver.swift` | The pay rate on a given day: effective-dated history, hourly or day rate, and £0 on PAYE days | `lib/payroll/rateResolver.ts` |
| `Core/PayrollPolicyBookingRecalibrator.swift` | Adjusts bookings when the working-hours policy changes | `lib/payroll/recalibrator.ts` |
| `Core/TimesheetPayrollPolicy.swift` | Pay periods: the current run, the last completed run, the pay date, previous periods. Also timesheet access rules and which people appear on a manager's timesheet list. | `lib/timesheets/policy.ts` |
| `Core/TimesheetPayrollCollector.swift` | Builds payroll lines for a person and period | `lib/timesheets/collector.ts` |
| `Core/InvoicingPeriodResolver.swift` | The current invoicing period, and the date range warnings scan | `lib/timesheets/invoicingPeriod.ts` |
| `Core/WeeklyReportExportBuilder.swift` | Weekly report content for the `.xlsx` and PDF files | `lib/reports/weeklyReport.ts` |
| `Models/AnnualLeavePolicy.swift`, `Core/AnnualLeaveCalendarRules.swift` | Leave-year boundaries (including years that wrap), consumption, half days, carry-over, and which days can be booked | `lib/leave/*` |
| `Core/BankHolidayService.swift`, `Core/BankHolidayRegionDirectory.swift` | Fetching, filtering by region and caching bank holidays | `lib/leave/bankHolidays.ts` |
| `Core/WarningsComputation.swift`, `Core/WarningsService.swift`, `Core/WarningsRefreshHelper.swift`, `Models/WarningModels.swift`, `Models/OrgWarningDetectionSettings.swift` | Warning detection: clashes, unbooked labour, material cut-off and more, with priorities and exclusions | `lib/warnings/*` |
| `Core/ScheduleBookingConflictSupport.swift`, `Models/OperativeBookingInterval.swift`, `Models/ManagerScheduleInterval.swift`, `Core/ScheduleDateSelectionPolicy.swift` | Booking time intervals, overlap and clash detection, and which dates can be selected | `lib/schedule/*` |
| `Core/WorkAccess.swift` | Job visibility, live users on a job, and deadline notification text | `lib/access/workAccess.ts` |
| `Core/UserStore.swift` (permissions), `Core/QualificationsAccessPolicy.swift`, `Models/UserRoleTransitionPolicy.swift`, `Core/LineManagerSupport.swift`, `Core/ProjectManagerPickerSupport.swift` | Permissions and role changes | `lib/permissions.ts`, `lib/users/roleTransition.ts` |
| `Views/HomeUpNextSupport.swift`, `HomeOverviewMetrics` (end of `Views/HomeView.swift`) | Up Next rows and the Home metric values | `lib/home/*` |
| `Core/MaterialCatalogCSV.swift`, `Core/MaterialCatalogDuplicateDetection.swift`, `Core/MaterialRequestEmailBuilder.swift` | Catalogue CSV import/export, duplicate detection, and the quote/order email HTML | `lib/materials/*` |
| `Views/SiteAudit/SiteAuditPDFBuilder.swift` | Site audit PDF layout | `lib/pdf/siteAudit.ts` |
| `Core/OrganizationCurrencyCatalog.swift`, `Core/CountryCapitalDirectory.swift`, `Core/OrganizationMembershipSupport.swift` | Currency list, default map centres, trial policy | `lib/org/*` |

**Don't port these iOS-only mechanisms:**

- `SmartCacheService`, `PersistenceService`, `DataPersistenceManager`
- the `Offline*` stores and outbox
- `LocalNotificationService`
- the `PlaygroundDemoSeeder` demo data seeder. Never run a seeder against the live project.

The web uses the Firestore SDK instead. You may optionally turn on Firestore's persistent cache, but ask first.

---

## 8. Things Farnie should know (decide before building; don't change without approval)

1. **Warning dismissals don't sync.** iOS stores them on the device (UserDefaults), so a dismissal on the web won't show on the iPhone, or the other way round. Syncing them needs a Firestore store *and* an iOS change.
2. **iOS overwrites whole documents.** It replaces projects, small works, clients, operatives, managers, tasks, notifications, materials, catalogue items, send records, site audits, sub contractors and sub contractor bookings every time it saves (§5.1). Any web-only field on those documents will be wiped. Either keep web-only data in separate documents, or change iOS to merge.
3. **The `holidayBookings` rule is wide open.** It lets any signed-in user read and write holiday bookings in *any* organisation (the rule is commented "Temporary"). Tighten it to the organisation when you're ready. Both apps already write inside their own organisation.
4. **The email Cloud Function has no authentication.** iOS calls `sendProjectPlannerEmail` without an ID token, so anyone who finds the URL can call it. Consider requiring one; that needs an iOS update as well.
5. **Invitations are publicly readable.** The setup page needs this, but the documents include names and emails. Consider checking the token in a Cloud Function instead.
6. **Project notes are never saved.** The `notes` field exists in the model, but iOS doesn't write it.
7. **The legacy `manager` field names real people** (Adam, Billey, …). New jobs write `"Custom"`, and the web must do the same. Show manager names from `managerIds`.
8. **Web-only features need a decision:** the dashboard editor with 22 metric tiles, and `dashboardLayouts`. Keep them, hide them, or replace them with the iOS Home. They don't exist on iOS.
9. **iOS Settings has developer tools** (manual org link, test email, push diagnostics). Don't port them unless asked.
10. **`storage.rules` isn't in the iOS folder.** Confirm where it's kept.
11. **The web needs a map, tile and geocoding provider.** OSM's public tile servers aren't meant for production traffic.
12. **Web push is optional.** Web FCM tokens would join the same `pushTokens` array, so the server would start sending to browsers too.
13. **Offline support differs.** iOS queues writes while offline. The web can just show an offline banner, or turn on Firestore's offline cache.
14. **The bank-holiday API is called directly from the app.** Check that Nager.Date allows browser (CORS) requests; if not, proxy it.

---

## 9. Appendix: screen index (iOS view structs)

This lists every SwiftUI screen, sheet or large view struct, with its line number and navigation title(s). Titles are taken from the struct and its extensions. Small reusable components are left out; see §4.5. Use it to check that nothing has been missed.

| File (lines) | Screens: `L{line} Name` (title) |
|---|---|
| `Views/AddUserView.swift` (1282) | `L10 AddUserView` |
| `Views/AdminManagerMaterialsView.swift` (217) | `L8 AdminManagerMaterialsView` |
| `Views/AnnualLeaveUsageHeroView.swift` (95) | `L10 AnnualLeaveUsageHeroView` |
| `Views/AppearanceSettingsView.swift` (51) | `L10 AppearanceSettingsView` (Appearance) |
| `Views/AssignQualificationsPickerView.swift` (83) | `L5 AssignQualificationsPickerView` (Add qualifications) |
| `Views/BookLabourFlowView.swift` (1910) | `L49 BookLabourFlowView`; `L1696 BookLabourOperativeHoursSheet` (Custom hours) |
| `Views/BookingConfirmationView.swift` (56) | `L10 BookingConfirmationView` |
| `Views/BookingHoursEditSheet.swift` (928) | `L327 OperativeCustomHoursSheet` |
| `Views/ChangePasswordView.swift` (136) | `L10 ChangePasswordView` |
| `Views/ClientsView.swift` (279) | `L10 ClientsView` (Clients); `L163 ClientDetailsView` (Client Details) |
| `Views/CompanyDetailsEditView.swift` (323) | `L10 CompanyDetailsEditView` (Company details) |
| `Views/CreateClientView.swift` (116) | `L10 CreateClientView` (New Client) |
| `Views/CreateManagerView.swift` (169) | `L10 CreateManagerView` (New Manager) |
| `Views/CreateOperativeView.swift` (177) | `L10 CreateOperativeView` (New Operative) |
| `Views/CreateProjectView.swift` (896) | `L12 CreateProjectView` (New project) |
| `Views/CreateSmallWorksView.swift` (892) | `L12 CreateSmallWorksView` (New small works) |
| `Views/DLScreens.swift` (1507) | `L25 DLDeadlinesScreen`; `L375 DLDeadlineDetailSheet`; `L728 DLRescheduleSheet`; `L923 DLEditDeadlineScreen`; `L1373 DLSiteAuditAttachSheet` |
| `Views/DailyOverviewView.swift` (1876) | `L26 DailyOverviewView` (Daily overview); `L1459 HistoricDailyOverviewView` (Date Overview) |
| `Views/EditClientView.swift` (147) | `L10 EditClientView` (Edit Client) |
| `Views/EditMaterialView.swift` (188) | `L11 EditMaterialView` (Edit Material) |
| `Views/EditProjectView.swift` (750) | `L17 EditProjectView` (Set address) |
| `Views/EditWholesalerView.swift` (196) | `L10 EditWholesalerView` (Edit Wholesaler) |
| `Views/GeneralAppSettingsView.swift` (167) | `L3 GeneralAppSettingsView` (General); `L46 MyScheduleGeneralOptionsView` (My Schedule) |
| `Views/HSHealthSafetyDocuments.swift` (650) | `L49 HSRamsDocumentDetailView` (RAMS); `L180 HSOtherDocumentDetailView` (H&S document); `L293 HSCustomSignedTalkView` (Signed toolbox talk) |
| `Views/HelpView.swift` (669) | `L11 HelpView` (Help & FAQs); `L316 CategoryHelpView`; `L397 StepView` |
| `Views/HolidayReportView.swift` (179) | `L3 HolidayReportView` (Holiday Report) |
| `Views/HolidayView.swift` (1535) | `L11 HolidayView` (Annual leave / Booked annual leave); `L1354 HalfDayHolidayBookingEditorSheet` (Update booking) |
| `Views/HomeOverviewCustomization.swift` (204) | `L52 AdminHomeOverviewCustomizeSheet` (Dashboard metrics) |
| `Views/HomeView.swift` (2214) | `L11 HomeView`; `L1773 OperativeQualificationsReadOnlyView` (My Qualifications); `L1898 HomeProfileCardSheet` (My Profile); `L2034 HomeQuickActionAddSheet` (Add quick action) |
| `Views/InvoicingView.swift` (5384) | `L12 InvoicingView` (Timesheets); `L676 MyTimesheetsHubView` (My Timesheets); `L951 MyTimesheetView` (Timesheet); `L1817 PreviousTimesheetsView` (Previous Timesheets); `L2168 OperativeTimesheetsView`; `L2697 OperativeTimesheetReviewView` (Review Timesheet); `L3490 TimesheetMoneyEntrySheet`; `L3739 SignTimesheetView` (Sign Timesheet); `L3846 ManagerTimesheetSignOffView` (Sign Off); `L3893 InvoiceUTRBlankWarningSheet` (Before you invoice); `L3923 InvoiceGeneratedSuccessSheet` (Invoice); `L4130 GenerateInvoiceView` (Generate Invoice) |
| `Views/JobTypesManagementView.swift` (169) | `L3 JobTypesManagementView` (Job Types Management); `L91 AddJobTypeView` |
| `Views/LineManagersMultiSelectSheet.swift` (117) | `L3 LineManagersMultiSelectSheet` (Line managers) |
| `Views/MainMenuMoreSheet.swift` (271) | `L10 MainMenuMoreSheet` (More) |
| `Views/ManageUsersView.swift` (3763) | `L13 ManageUsersView`; `L1267 EditUserView` (Change user type) |
| `Views/ManagersView.swift` (345) | `L11 ManagersView`; `L302 ManagerFilterOptionsView` (Filter Managers) |
| `Views/MapPinPickerView.swift` (149) | `L13 MapPinPickerView` (Set pin on map) |
| `Views/MaterialsAddWithCatalogueSheet.swift` (673) | `L25 MaterialsAddWithCatalogueSheet` |
| `Views/MaterialsCatalogueFlow.swift` (1201) | `L11 MaterialCatalogueRootView` (Material catalogue); `L369 MaterialCatalogueEditorSheet`; `L636 MaterialCatalogueDetailView` (Item details); `L726 MaterialCatalogueBulkImportView` (Catalogue CSV) |
| `Views/MaterialsProjectListUI.swift` (721) | `L353 MaterialsOrderHistorySheet` (Quote & order history) |
| `Views/MaterialsSendListSheet.swift` (725) | `L8 MaterialsSendListSheet` (Send list); `L539 MaterialsResendIncludeExcludeSheet` (Review materials); `L693 MaterialsSendConfirmationView` |
| `Views/MaterialsView.swift` (870) | `L12 MaterialsView`; `L199 OperativeMaterialsView`; `L550 AddMaterialView` (Add Materials) |
| `Views/MyScheduleView.swift` (2657) | `L399 ManagerCustomHoursSheet` (Custom hours); `L468 MyScheduleView` (My Schedule); `L543 ManagerScheduleContentView`; `L1774 ManagerSelfBookingLocationPickerSheet`; `L2036 ManagerSelfBookingEntryView` (Book yourself in); `L2229 ManagerSelfBookingJobListView`; `L2288 ManagerBookingSheet` (Book); `L2352 OperativeScheduleContentView` |
| `Views/NotificationsView.swift` (229) | `L10 NotificationsView` (Notifications) |
| `Views/OfflineStatusBanner.swift` (172) | `L117 OfflineSyncQueueSheet` (Changes to sync) |
| `Views/OperativeAnnualLeaveViews.swift` (1355) | `L48 OperativeAnnualLeaveHubView` (View and manage user annual leave); `L115 OperativeAnnualLeaveDirectoryView` (Operative annual leave); `L228 OperativeAnnualLeaveApprovedListView`; `L320 OperativeAnnualLeaveRequestsListView`; `L413 OperativeAnnualLeaveCalendarView` |
| `Views/OperativeProfileView.swift` (408) | `L12 OperativeProfileView` (Profile) |
| `Views/OperativeQualificationsEditorView.swift` (669) | `L12 OperativeQualificationsEditorView` (Filter list) |
| `Views/OperativesView.swift` (1277) | `L15 OperativesView` (Manage Operatives); `L493 OperativeFilterOptionsView` (Filter); `L630 AddOperativeView` (Add Operative); `L797 EditOperativeView` (Edit Operative); `L1088 FinishOperativeSetupView` (Finish Operative Setup); `L1159 FilterOptionsView` (Filter Operatives) |
| `Views/OrgSitesMapView.swift` (453) | `L4 OrgSitesMapView` (Site Map) |
| `Views/OrganisationAnnualLeaveDefaultsView.swift` (123) | `L8 OrganisationAnnualLeaveDefaultsView` (Annual leave) |
| `Views/OrganisationCurrencyView.swift` (100) | `L8 OrganisationCurrencyView` (Currency) |
| `Views/OrganisationInvoicingSettingsView.swift` (404) | `L8 OrganisationInvoicingSettingsView` (Payment Runs and Timesheets) |
| `Views/OrganisationMaterialCutOffSettingsView.swift` (240) | `L10 OrganisationMaterialCutOffSettingsView` (Material cut-off) |
| `Views/OrganisationSettingsHubView.swift` (533) | `L10 OrganisationSettingsHubView` (Organisation) |
| `Views/OrganisationWarningsSettingsView.swift` (732) | `L10 OrganisationWarningsSettingsView` (Warnings); `L630 WarningExcludedUsersPickerView` (Excluded users) |
| `Views/OrganisationWorkingHoursView.swift` (1298) | `L30 OrganisationWorkingHoursView` (Schedule change) |
| `Views/PolicyAcceptanceView.swift` (102) | `L11 PolicyAcceptanceView` |
| `Views/PrivacyPolicyView.swift` (246) | `L10 PrivacyPolicyView` (Privacy Policy); `L206 SectionView` |
| `Views/ProjectActiveOperativesView.swift` (369) | `L31 ProjectActiveOperativesView` (Active users); `L242 ProjectBookedPersonHistoryView` |
| `Views/ProjectDeadlinesView.swift` (290) | `L5 ProjectDeadlinesView` |
| `Views/ProjectDetailView.swift` (6348) | `L47 ProjectDetailView`; `L2517 ProjectVisibilitySettingsView` (View); `L2858 ProjectTaskFilterSheet` (Task Filters); `L3020 TaskPeoplePickerSheet`; `L3369 AddProjectTaskView` (New task); `L4354 EditProjectTaskView` (Edit Task); `L4652 TaskCompletionPopupView` (Complete task); `L5496 CompletedTaskDetailView` (Task); `L6243 OperativeMultiSelectView` (Select Operatives); `L6299 ManagerMultiSelectView` (Select Managers) |
| `Views/ProjectHealthSafetyView.swift` (3524) | `L624 ProjectHealthSafetyView`; `L1678 HSIssueTalkSheet` (Issue Toolbox Talk); `L2016 HSToolboxTalkDetailView` (Toolbox Talk); `L2120 HSScheduledTalksView` (Scheduled Toolbox Talks); `L2172 HSScheduledTalkDetailView` (Scheduled Talk); `L2301 HSAddRecipientsSheet` (Add Recipients); `L2446 HSTrackIssueView` (Sign-off tracking); `L2563 HSSignTalkView` (Sign Toolbox Talk); `L2730 HSSignedTalkView` (Signed Talk); `L2786 HSUploadTalkSheet`; `L2893 HSRamsUploadSheet`; `L2983 HSOtherDocumentUploadSheet` |
| `Views/ProjectsView.swift` (632) | `L10 ProjectsView` (Projects); `L509 AddProjectView` (Add Project) |
| `Views/QualificationsManagementView.swift` (445) | `L24 QualificationsManagementView` (Qualifications); `L241 AddQualificationView` (Add Qualification); `L318 EditOrganisationQualificationView` (Edit Qualification) |
| `Views/QuickMenuSheet.swift` (426) | `L10 QuickMenuSheet` |
| `Views/ScheduleOperativeView.swift` (1665) | `L12 ScheduleOperativeView` (Schedule booking) |
| `Views/ScheduleSubcontractorView.swift` (596) | `L3 ScheduleSubcontractorView` (Schedule Sub Contractor) |
| `Views/SelectOperativesView.swift` (363) | `L8 SelectOperativesView` (Select people) |
| `Views/SendToWholesalerView.swift` (289) | `L10 SendToWholesalerView` (Send to Wholesaler) |
| `Views/SettingsHubSupportViews.swift` (431) | `L98 SettingsProfileDetailView` (My profile); `L365 SettingsNotificationsHubView` (My notifications) |
| `Views/SettingsView.swift` (945) | `L13 SettingsView` (Settings / Manual Link / Test Email) |
| `Views/SiteAudit/SiteAuditRevampViews.swift` (795) | `L13 SiteAuditProjectListView` (Site audits); `L208 SiteAuditDetailsStepView`; `L370 SiteAuditItemsStepView`; `L605 SiteAuditPreviewStepView` |
| `Views/SiteAuditView.swift` (1993) | `L199 SiteAuditHubView` (Site Audit); `L283 SiteAuditProjectsBrowserView`; `L485 SiteAuditProjectAuditsView`; `L562 SiteAuditProjectHubView`; `L629 SiteAuditCreateFlowView`; `L1260 SiteAuditSubmitSuccessView`; `L1410 SiteAuditProjectPickerView` (Select Project); `L1454 SiteAuditAddItemView` (New item); `L1633 SiteAuditDetailView` (Audit detail) |
| `Views/SmallWorksView.swift` (537) | `L11 SmallWorksView` (Small works) |
| `Views/SubcontractorBookingEditSheet.swift` (132) | `L8 SubcontractorBookingEditSheet` |
| `Views/SubcontractorsView.swift` (1068) | `L3 SubcontractorsView` (Sub contractors); `L345 SubcontractorFirmDetailView` (Firm details); `L593 SubcontractorFirmEditorView`; `L846 SubcontractorOperativeEditorSheet` |
| `Views/SwitchOrganisationView.swift` (215) | `L10 SwitchOrganisationView` (Switch organisation) |
| `Views/TasksDetailView.swift` (1009) | `L24 TasksDetailView` (Tasks) |
| `Views/TimesheetManagerReviewSupport.swift` (532) | `L319 TimesheetPayrollLineEditHoursSheet`; `L459 TimesheetManagerAmountEditSheet` |
| `Views/WarningsDetailView.swift` (855) | `L46 WarningsDetailView`; `L712 WarningDismissConfirmationSheet` |
| `Views/WeeklyReportView.swift` (1577) | `L19 WeeklyReportView` |
| `Views/WholesalersRevampViews.swift` (1297) | `L28 WholesalersListContent` (Wholesalers); `L355 WholesalerDetailView` (Wholesaler); `L722 WholesalerSendHistoryView` (\(wholesaler.name) history); `L1004 WholesalerEditorSheet` |
| `Views/WholesalersView.swift` (222) | `L8 WholesalersView`; `L37 EditWholesalerContactView` (Edit Contact); `L160 AddWholesalerContactView` (Add Contact) |
| `AuthenticationView.swift` (469) | `L28 AuthenticationView` |
| `PasswordResetView.swift` (132) | `L4 PasswordResetView` (Reset Password) |
| `ContentView.swift` (970) | `L32 ContentView` |
| `ProjectPlannerRootView.swift` (331) | `L167 ProjectPlannerRootView` |
| `AppBranding.swift` (37) | `L20 AppLaunchSplashView` |
